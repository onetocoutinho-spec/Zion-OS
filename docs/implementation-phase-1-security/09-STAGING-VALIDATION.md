# 09 — Validação em Staging (Etapa 1)

> **Status ATUALIZADO: AUTENTICAÇÃO E ISOLAMENTO MULTIEMPRESA APROVADOS EM STAGING.**
> Um ambiente de staging (Supabase Staging + Vercel Preview) foi provisionado e a validação de **autenticação, redirecionamento por papel e isolamento multiempresa foi executada e APROVADA**. A validação de **credenciais e fluxos do Mercado Livre permanece PENDENTE**. **Nenhum teste foi feito em produção.**
>
> Detalhe completo do isolamento em [10-VALIDACAO-ISOLAMENTO-CONCLUIDA.md](./10-VALIDACAO-ISOLAMENTO-CONCLUIDA.md). O histórico de "bloqueio por ambiente" abaixo fica registrado para rastreabilidade (era o estado antes de o staging existir).

## Metadados

| Campo | Valor |
|-------|-------|
| Ambiente validado | **Supabase Staging + Vercel Preview** (nunca produção) |
| Branch | `fix/multitenancy-security` |
| Migrações base + 001–015 | **Aplicadas em staging** ✅ |
| Migração 016 | **Aplicada em staging** ✅ (só staging) |
| Autenticação + isolamento | **Aprovados em staging** ✅ |
| Fluxos do Mercado Livre | **Pendentes** ⏳ |
| Rollback | Documentado (bloco no 016 + [07-ROLLBACK](./07-ROLLBACK.md)) |

## Histórico (estado anterior — antes de o staging existir)

O bloco a seguir era verdadeiro **antes** de o ambiente de staging ser provisionado, e fica aqui só para rastreabilidade:
- **Um único ambiente configurado** nesta máquina de trabalho: `.env.local` (Supabase de produção). Sem `.env.staging`, sem `psql`/Supabase CLI locais.
- Por isso a validação foi **inicialmente interrompida** (não se tocava produção nem se reportava resultado não medido).

Depois disso, o operador provisionou o **Supabase Staging** e o **Vercel Preview**, aplicou as migrações e executou a validação — cujos resultados reais estão registrados abaixo e no doc 10.

## O que JÁ está validado (da etapa anterior, sem banco)

Estes não dependem de staging e foram executados de verdade (ver [06-TESTES](./06-TESTES.md)):
- `tsc --noEmit` → exit 0.
- `node --test src/lib/auth/serverAuthorization.test.ts` → 13/13 (lógica pura de 401/403 e isolamento A×B).
- `npm run lint` → 0 erros (49 warnings pré-existentes).
- Varredura de segredos no commit → nenhum valor real de token.

## Checklist de aprovação — estado atual (staging)

Autenticação e isolamento — **APROVADOS**; fluxos do Mercado Livre — **PENDENTES**:

```
[APROVADO] Migrações base e 001–015 aplicadas no Supabase Staging
[APROVADO] Migração 016 aplicada no Supabase Staging (apenas staging)
[APROVADO] Usuário da equipe continua com acesso
[APROVADO] Equipe é direcionada ao Painel da Agência em /
[APROVADO] Equipe acessa todos os clientes e produtos
[APROVADO] Equipe em /cliente é redirecionada para /
[APROVADO] Cliente A acessa somente Empresa A e Produto A
[APROVADO] Cliente B acessa somente Empresa B e Produto B
[APROVADO] Cliente em rota administrativa é redirecionado para /cliente
[APROVADO] Usuário sem perfil recebe "Acesso não liberado"
[APROVADO] Perfil com ativo=false recebe "Acesso não liberado"
[APROVADO] /clientes não é confundido com /cliente
[APROVADO] Isolamento multiempresa funcionando no fluxo real

[PENDENTE] Conectar uma conta Mercado Livre de teste no staging
[PENDENTE] Confirmar no DevTools que refresh_token não aparece nas requisições
[PENDENTE] Confirmar que refresh_token não aparece nas respostas
[PENDENTE] Confirmar que refresh_token não aparece nos logs
[PENDENTE] Validar OAuth do Mercado Livre
[PENDENTE] Validar importação de anúncios
[PENDENTE] Validar consulta de vendas
[PENDENTE] Validar dry-run e publicação controlada
```

> A matriz completa de perfis/redirecionamentos/isolamento está em [10-VALIDACAO-ISOLAMENTO-CONCLUIDA.md](./10-VALIDACAO-ISOLAMENTO-CONCLUIDA.md). O runbook abaixo continua válido para executar as etapas **pendentes** do Mercado Livre.

---

## Runbook para executar quando houver staging (o que falta)

> Requisitos: um **projeto Supabase de staging separado** (ou uma cópia/restore do backup de produção num projeto novo), um **deploy de staging** do app (Vercel Preview) apontando para esse Supabase, e um **app ML de teste** (ou o mesmo com Redirect URI de staging). Nada disso deve ser produção.

### Passo 0 — Provisionar staging
1. Criar um projeto Supabase novo (staging) **ou** restaurar o backup de produção nele.
2. Rodar as migrações **em ordem** (`database/migrations/001…015`) no SQL Editor do staging (se partiu de projeto vazio).
3. Configurar um deploy de staging com `.env` apontando para o Supabase de staging (URL/anon próprios), `ML_CLIENT_ID/SECRET` de teste e `ML_REDIRECT_URI` de staging.

### Passo 1 — Diagnóstico pré-migração
Rodar no SQL Editor do **staging**: `database/checks/check-users-without-profile.sql` (só leitura). Registrar os totais sanitizados (contagens, sem e-mails/UUIDs). **Não** aplicar a 016 se houver usuário de equipe sem perfil.

### Passo 2 — Backfill de perfis
Com `database/checks/fix-missing-profiles-template.sql`, cadastrar os perfis faltantes (equipe/cliente) **confirmados** — sem adivinhar. Reconferir: bloco 1 do check = 0 linhas.

### Passo 3 — Criar cenário de teste (dados claramente de staging)
- Empresa A + Usuário Cliente A (perfil `cliente`, `cliente_id=A`, ativo) + Produto A.
- Empresa B + Usuário Cliente B (perfil `cliente`, `cliente_id=B`, ativo) + Produto B.
- Usuário de Equipe (perfil `equipe`, ativo).
- Usuário autenticado **sem** perfil.
- Usuário com perfil **inativo** (`ativo=false`).

### Passo 4 — Aplicar a migração 016 (só staging)
Rodar `database/migrations/016-fix-multitenancy-security.sql`. Registrar hora, objetos alterados (funções `eh_equipe`/`cliente_do_usuario`, coluna `perfis.ativo`), avisos. Verificar com os `pg_get_functiondef(...)` do próprio arquivo.

### Passo 5 — Testes de rota (HTTP real)
Para cada rota, com `BASE` = URL do staging. Substituir `<...>` por valores de teste (JWTs de sessão do staging — **nunca** reproduzir em log/documento). Exemplo de forma (não são segredos reais):

```bash
BASE="https://<staging-host>"

# 401 — sem token de sessão
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/ml/vendas" \
  -H 'Content-Type: application/json' -d '{"clienteId":"<A>"}'          # esperado: 401

# 401 — token inválido
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/ml/vendas" \
  -H 'Authorization: Bearer token-invalido' \
  -H 'Content-Type: application/json' -d '{"clienteId":"<A>"}'          # esperado: 401

# 403 — sem perfil / perfil inativo (JWT de usuário sem perfil ou inativo)
curl ... -H "Authorization: Bearer <JWT_SEM_PERFIL>" -d '{"clienteId":"<A>"}'   # esperado: 403

# 200/authorized — Cliente A no próprio cliente
curl ... -H "Authorization: Bearer <JWT_CLIENTE_A>" -d '{"clienteId":"<A>"}'    # esperado: 200/aviso de negócio

# 403 — Cliente A tentando Empresa B (clienteId forjado)
curl ... -H "Authorization: Bearer <JWT_CLIENTE_A>" -d '{"clienteId":"<B>"}'    # esperado: 403

# Equipe acessa A e B
curl ... -H "Authorization: Bearer <JWT_EQUIPE>" -d '{"clienteId":"<A>"}'       # esperado: autorizado
curl ... -H "Authorization: Bearer <JWT_EQUIPE>" -d '{"clienteId":"<B>"}'       # esperado: autorizado
```

Repetir a matriz para: `/api/ml/conectar`, `/api/ml/publicar` (usar `go:false` p/ dry-run), `/api/ml/importar-anuncios`; e para `/api/agentes/esteira`, `/api/agentes/executar`, `/api/imagens/gerar` (estas exigem só sessão → 401 sem token, autorizado com qualquer perfil ativo). Registrar o código HTTP de cada célula. **Não** registrar o conteúdo dos JWTs.

### Passo 6 — DevTools (refresh_token fora do navegador)
No app de staging, abrir DevTools → Network e exercer: conectar ML, carregar configurações, importar anúncios, consultar vendas, gerar preview (dry-run), publicar controlado. Confirmar que **nenhuma** requisição do navegador **envia** e **nenhuma resposta retorna** um valor de `refresh_token`/`access_token`/`client_secret`. Conferir console/logs (app + Vercel) sem credenciais. Se algum segredo aparecer, **parar** e reportar só a rota/arquivo (sem o valor).

### Passo 7 — Fluxo ML (sem mudar o modelo de publicação)
Confirmar: OAuth conecta; callback salva o canal no servidor; frontend recebe só dados públicos (`ativo`/`sellerId`/`tipoAnuncio`); importação e vendas funcionam; dry-run funciona; publicação busca o token internamente; Cliente A não publica com `clienteId` de B (403). Se for publicar de verdade, usar **um item de teste** claramente identificado. **Não** implementar User Products.

### Passo 8 — Rollback (só em staging)
Executar o bloco "REVERTER" do fim de `016-*.sql` (recria `eh_equipe`/`cliente_do_usuario` antigas; `perfis.ativo` pode ficar). Confirmar que **nenhum** usuário/cliente/perfil é removido. Reaplicar a 016 se o staging deve seguir atualizado. Ver [07-ROLLBACK](./07-ROLLBACK.md).

## Falhas encontradas
Nenhuma na validação de autenticação/isolamento em staging — todos os itens aprovados. Os fluxos do Mercado Livre ainda não foram exercidos (pendentes), então não há resultado a reportar sobre eles.

## Correções necessárias
Nenhuma no código. Falta apenas **executar as etapas pendentes do Mercado Livre** em staging (conectar conta de teste, DevTools do refresh_token, OAuth/importação/vendas/dry-run) — ver runbook acima.

## Veredito
```
ETAPA 1 — AUTENTICAÇÃO E ISOLAMENTO MULTIEMPRESA APROVADOS EM STAGING

A validação de credenciais e fluxos do Mercado Livre permanece pendente.
```
Autenticação, redirecionamento por papel e isolamento multiempresa: **aprovados em staging**. Credenciais/fluxos do ML: **pendentes**. Nada foi testado em produção. Detalhe em [10-VALIDACAO-ISOLAMENTO-CONCLUIDA.md](./10-VALIDACAO-ISOLAMENTO-CONCLUIDA.md).
