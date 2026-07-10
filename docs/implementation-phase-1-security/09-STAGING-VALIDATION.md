# 09 — Validação em Staging (Etapa 1)

> **Status: NÃO EXECUTADA — BLOQUEADA POR AMBIENTE.**
> A validação de staging **não pôde ser executada** porque não há ambiente de staging comprovável nem ferramentas de banco disponíveis nesta máquina. Conforme a Parte 1 do roteiro ("caso não seja possível comprovar que o banco é staging, interrompa a execução e informe"), a execução foi **interrompida** e nada foi rodado contra o banco. **Nenhuma alteração foi feita em produção.**

## Metadados

| Campo | Valor |
|-------|-------|
| Data/hora | 2026-07-10 (halt na Parte 1) |
| Branch | `fix/multitenancy-security` |
| Commit | `3c0e0c731d94b64c5bcacef218af55811a81da08` (presente e conferido) |
| Ambiente validado | **Nenhum** (sem staging comprovável) |
| Migração 016 aplicada | **Não** (em lugar nenhum) |
| Rollback | **Não executado** (documentado abaixo) |

## Por que foi bloqueada (fatos, sem expor segredos)

Levantamento feito nesta máquina:
- **Um único ambiente configurado:** `.env.local` com `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`. (Valores não exibidos.)
- **Sem `.env.staging`** e **sem diretório `supabase/`** (não há projeto de staging nem runner de migração local).
- **Sem `psql`** e **sem Supabase CLI** instalados → **não há como executar SQL** (nem os `database/checks/*.sql`, nem a migração 016, nem o rollback) contra qualquer banco.
- **Sem `DATABASE_URL`/conexão direta** no ambiente.
- O histórico do projeto indica que o único Supabase configurado é o de **produção** (domínio `zioncompany.online`; migrações 008–015 já aplicadas em produção). **Não foi possível comprovar que seja staging** — a evidência aponta para produção.
- Não há app de staging publicado para exercer sessões reais, OAuth do ML e inspeção de DevTools.

Como o roteiro proíbe qualquer ação em produção e exige confirmar staging antes de rodar SQL, a única ação correta foi **interromper**. Não foram executados os `check-*.sql`, a migração 016, nem os testes de rota — para não tocar o único banco alcançável (produção) e para não reportar resultado que não foi medido.

## O que JÁ está validado (da etapa anterior, sem banco)

Estes não dependem de staging e foram executados de verdade (ver [06-TESTES](./06-TESTES.md)):
- `tsc --noEmit` → exit 0.
- `node --test src/lib/auth/serverAuthorization.test.ts` → 13/13 (lógica pura de 401/403 e isolamento A×B).
- `npm run lint` → 0 erros (49 warnings pré-existentes).
- Varredura de segredos no commit → nenhum valor real de token.

## Checklist de aprovação — estado atual

Todos **NÃO EXECUTADOS** (bloqueados por falta de staging):

```
[BLOQUEADO] Sem sessão → 401
[BLOQUEADO] Sem perfil → 403
[BLOQUEADO] Perfil inativo → 403
[BLOQUEADO] Cliente A não acessa Empresa B
[BLOQUEADO] Cliente B não acessa Empresa A
[BLOQUEADO] clienteId forjado não burla autorização
[BLOQUEADO] Equipe continua com acesso
[BLOQUEADO] Refresh token não aparece no navegador
[BLOQUEADO] Refresh token não aparece nas respostas
[BLOQUEADO] Refresh token não aparece nos logs
[BLOQUEADO] OAuth continua funcionando
[BLOQUEADO] Importação continua funcionando
[BLOQUEADO] Vendas continuam funcionando
[BLOQUEADO] Dry-run continua funcionando
[BLOQUEADO] Migração 016 aplicada apenas em staging
[PARCIAL   ] Rollback documentado (bloco no arquivo 016 + 07-ROLLBACK); NÃO validado em execução
```

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
Nenhuma **de código** (o bloqueio é de ambiente). Os testes que rodam sem banco passaram.

## Correções necessárias
Nenhuma no código. Necessário **prover um ambiente de staging** (Supabase + deploy + app ML de teste) e as ferramentas de execução de SQL para completar a validação.

## Veredito
**NÃO CONCLUÍDA — BLOQUEADA (sem ambiente de staging).** Não é possível marcar como aprovada sem executar; e não há defeito de código que justifique reprovação. A execução foi interrompida na Parte 1, conforme o próprio roteiro determina.
