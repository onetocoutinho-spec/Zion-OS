# Diagnóstico Completo — Estabilização do Zion OS (staging)

> **Somente diagnóstico.** Nenhum arquivo de código foi alterado, nenhum commit/push feito, nenhuma migração executada, produção intocada. Branch: `fix/staging-stabilization` (a partir de `fix/multitenancy-security`, HEAD `62a9be2`). Sem exibir valores de segredos.

## Resumo executivo

O sistema **compila, tipa, lint-a e testa sem erros**. Não há falha de build/inicialização (**0 P0**). Autenticação e isolamento multiempresa foram **corrigidos e aprovados em staging** (migração 016 + `RoteadorPapel`). Os problemas remanescentes são de **escala/integridade da publicação no ML**, **higiene de segredo em disco**, e diversas melhorias de **UX/observabilidade**. A parte de **credenciais/fluxos do Mercado Livre** (OAuth/DevTools/importação/vendas/publicação) ainda **não foi exercida end-to-end** em staging.

| Métrica | Estado |
|---|---|
| Build de produção (`next build`) | ✅ **PASSOU** (exit 0) |
| Typecheck (`tsc --noEmit`) | ✅ **PASSOU** (exit 0) |
| Lint (`eslint`) | ✅ 0 erros (49 warnings pré-existentes) |
| Testes unitários (`node --test`) | ✅ **23/23** (roteamentoPapel 10 + serverAuthorization 13) |
| Testes de integração | ⚠️ **Não existem** (sem framework instalado) |

## Estado do build / testes (Parte 2)

Comandos executados nesta máquina (node v24.18.0, npm 11, `package-lock.json`):

| Comando | Resultado |
|---|---|
| `npm ls --depth=0` | sem `missing/invalid/UNMET` |
| `npx tsc --noEmit` | exit 0 |
| `node --test src/lib/auth/*.test.ts` | 23 pass / 0 fail |
| `npm run lint` | 0 erros, 49 warnings |
| `npm run build` | exit 0 (todas as rotas compiladas) |

**Não há falhas** de build/typecheck/lint/testes a reportar (nenhum "comando → mensagem de erro"). Warnings relevantes: 49 do ESLint (React Compiler/`react-hooks` rebaixados a `warn` e `no-unused-vars`) em arquivos NÃO alterados nesta estabilização — não bloqueiam o build. Registrados como P3.

> Observação: **não existe rota `/login`** — o login é uma tela inline no `AuthGate`. A menção a `/login` no roteiro não se aplica.

## Variáveis de ambiente (Parte 3)

`process.env.*` usados (13, todos no `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REDIRECT_URI`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_IMAGE_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `IA_PROVEDOR`, `CRON_SECRET`. **Valores não exibidos.**

| Verificação | Resultado |
|---|---|
| Segredos só no servidor | ✅ `SUPABASE_SERVICE_ROLE_KEY` só em `src/lib/supabase/admin.ts` + `api/otimizar/worker`; `ML_CLIENT_SECRET` só em `mercadolivre.ts` + rotas `api/ml/*` |
| `NEXT_PUBLIC_*` só para dados públicos | ✅ URL/anon apenas em `supabase/client.ts` e `serverAuthorization.ts` |
| Uso de var pública p/ segredo | ✅ nenhum |
| Valores hardcoded | ✅ nenhum segredo hardcoded encontrado |
| `ML_CLIENT_ID` em client component | ⚠️ apenas como **texto de UI** em `esteira/aprovacoes/page.tsx:385` (não é `process.env`) — **não** é vazamento |
| Duplicidade / nomes divergentes | ✅ nenhum (nomes consistentes) |
| Fallback perigoso | ⚠️ `api/ml/autorizar` monta `redirect_uri` de `ML_REDIRECT_URI` **ou** do header `x-forwarded-host` (origem) — aceitável, mas o fallback por header pode divergir do Redirect URI do app ML (P3) |
| `.env.example` / `.env.staging.example` / `vercel.json` / next config | ✅ conferidos: `.env.example` cobre as vars; `vercel.json` só tem o cron; `next.config.ts` sem exposição de segredo |

## Auditoria de autenticação (Parte 4)

Arquitetura: Supabase **no navegador** (anon); rotas `/api/*` sem sessão de cookie — autorização via `Authorization: Bearer` (Etapa 1). `AuthGate` resolve perfil (`meuPerfil`) → `RoteadorPapel` (`decidirRota`).

| Fluxo | Estado |
|---|---|
| Login / logout | ✅ inline no `AuthGate` (`signInWithPassword` / `signOut`) |
| Restauração de sessão | ⚠️ `AuthGate` faz `Promise.race([meuPerfil, timeout 8s→reject])`; timeout/erro transitório → `TelaSemAcesso` mesmo p/ usuário válido (fail-closed, mas UX ruim) — **A-01 (P2)** |
| Equipe → Painel da Agência (`/`) | ✅ `decidirRota` (aprovado em staging) |
| Cliente → Portal (`/cliente`) | ✅ |
| Sem perfil / inativo / cliente sem empresa | ✅ "Acesso não liberado" |
| Equipe em `/cliente` → `/` | ✅ |
| Cliente em rota admin → `/cliente` | ✅ |
| `/clientes` ≠ `/cliente` | ✅ (`estaNoPortalCliente` com barra final) |
| Loop de redirecionamento | ✅ nenhum (regras não se apontam) |
| Proteção de rotas de API | ⚠️ `api/ml/{conectar,publicar,vendas,importar-anuncios}` e `api/agentes/*` + `api/imagens/gerar` exigem sessão; **`api/ml/autorizar` é público** (GET que redireciona ao ML) — **A-02 (P3)** |
| Proteção de páginas (client-side) | ⚠️ `AuthGate` é client-side; defesa real é o RLS (aceitável, documentado) — **A-03 (P3)** |

## Auditoria de multitenancy / RLS (Parte 5)

Modelo real usa **`cliente_id`** (não existe `team_id`/`company_id`). Equipe = acesso a todos; cliente = escopo próprio.

| Item | Estado |
|---|---|
| `eh_equipe()` / `cliente_do_usuario()` deny-by-default (016) | ✅ aplicado em staging |
| Isolamento Cliente A × B | ✅ aprovado em staging (RLS + redirect) |
| Agência acessa todos os clientes | ✅ |
| Rotas que aceitam `clienteId` do navegador | ✅ `api/ml/*` validam com `exigirAcessoAoCliente` antes de usar; o token é lido no servidor |
| Consultas com `service_role` | ✅ só no worker (`api/otimizar/worker`), escopadas por `cliente_id` no código |
| Sem `team_id` / escopo por membro de equipe | ⚠️ toda a equipe vê todos os clientes (por design da agência) — **M-01 (P3)** |
| Tabelas sem RLS / políticas permissivas | ✅ 016 re-liga RLS nas tabelas sensíveis; políticas usam as funções deny-by-default. (Confirmar em staging que nenhuma tabela nova ficou sem policy — **M-02 (P3, verificação)**) |

## Auditoria da integração Mercado Livre (Parte 6)

| Item | Estado |
|---|---|
| `client_id` | `ML_CLIENT_ID` (server) |
| `redirect_uri` | `ML_REDIRECT_URI` ou origem do request (fallback por header) — **P3** |
| Armazenamento de tokens | `canais_marketplace.refresh_token` (server; RLS). **Nunca** vai ao navegador (R3 corrigido) |
| Renovação de access token | `renovarToken` (refresh grant); rotacionado e persistido **no servidor** |
| Token expirado | erro do ML sobe como mensagem; sem retry/backoff dedicado — **ML-03 (P2)** |
| Proteção das rotas | ✅ conectar/publicar/vendas/importar exigem acesso ao cliente; autorizar é público (A-02) |
| Segredo ao frontend | ✅ nenhum `refresh_token`/`access_token` em `Response.json` (confirmado por varredura) |
| `service_role` indevido | ✅ não usado nas rotas ML |
| Conexão duplicada | ✅ `upsert onConflict (cliente_id, marketplace)` — 1 canal por cliente |
| Publicação — idempotência | ❌ **ML-01 (P1)**: `publicacaoML` publica **síncrono, 1‑a‑1, do navegador**, sem chave de idempotência → risco de **anúncio duplicado** e não escala |
| Modelo User Products (calçado) | ❌ **ML-02 (P1)**: `mlPayload` monta o modelo **clássico**; a conta de calçado (MLB273770) exige User Products → publicação real **rejeitada**. `mlUserProducts.ts` existe mas **não ligado** |
| Logs com credenciais | ✅ não encontrados (mensagens de erro genéricas) |

## Auditoria dos fluxos principais (Parte 7)

**A. Clientes** — CRUD em `/clientes` + `/clientes/[id]`; associação usuário↔cliente via `perfis`; ativação via `perfis.ativo` (após 016). OK. (Criar cliente + criar o `perfis` do usuário é passo manual — **F-01, P2**: sem fluxo único de convite.)

**B. Produtos** — listagem/CRUD/variações/SKU/preço/estoque/imagens vinculados a `cliente_id` (RLS). Import por planilha (lote com retry). OK. **F-02 (P2)**: tamanhos vêm "sujos" do ML (não normalizados) — impacta grade/SIZE_GRID.

**C. Mercado Livre** — conexão OK; importação **idempotente** (dedup por MLB no modo "novos"; "substituir" apaga+reimporta); vendas OK; dry-run OK; **publicação real** bloqueada por ML-01/ML-02; falha parcial/duplicidade sem tratamento de idempotência (ML-01).

**D. Interface** — **UI-01 (P2)**: escritas server-side (worker) não disparam `notificarMudanca()` → telas só atualizam no refresh (Realtime declarado mas não usado). **UI-02 (P2)**: A-01 (timeout de perfil) leva a tela "Acesso não liberado" transitória. Estados de carregamento/erro existem nas telas principais; não foi feita varredura visual completa (precisa de sessão em staging — ver "fluxos não testáveis").

## Análise de segurança (Parte 8)

| Verificação | Resultado |
|---|---|
| `client_secret` / `service_role` / `refresh_token` / `access_token` no frontend | ✅ nenhum |
| Token em resposta de API | ✅ nenhum |
| Logs com tokens | ✅ nenhum |
| Endpoints sem autenticação | ⚠️ só `api/ml/autorizar` (redirect OAuth, sem segredo) — A-02 |
| Endpoint confia só no `clienteId` recebido | ✅ não — valida acesso no servidor |
| `localStorage` inseguro | ✅ só dados de demonstração (`store.ts`); sem tokens |
| Dado sensível em query string | ⚠️ `clienteId` (UUID) vai no `state` do OAuth (`api/ml/autorizar`) — padrão OAuth, baixo risco — P3 |
| SQL injection | ✅ supabase-js (parametrizado); migrações usam `format(%I)` |
| Mass assignment / validação de payload | ⚠️ **S-01 (P2)**: rotas validam presença de campos, mas **sem validação de schema** do payload (ex.: `api/ml/publicar` confia no `payload` montado no cliente) |
| Mensagens de erro revelando interno | ✅ `respostaErroAutorizacao` genérica; erros do ML podem repassar mensagem do ML (P3) |
| **`credenciais.md` (segredos em texto) no working tree** | ⚠️ **S-02 (P1 higiene)**: arquivo com tokens reais existe em disco (gitignored, mas presente) — risco de vazamento por backup/compartilhamento |

## Classificação (Parte 9)

| ID | Título | Módulo | Gravidade | Impacto | Causa provável | Arquivo | Correção recomendada | Dependências | Risco da correção | Teste necessário |
|----|--------|--------|-----------|---------|----------------|---------|----------------------|--------------|-------------------|------------------|
| ML-01 | Publicação sem fila/idempotência | ML | **P1** | Anúncio duplicado; não escala | Publish síncrono no browser | `src/lib/services/publicacaoML.ts`, `api/ml/publicar` | Enfileirar + chave idempotência `(cliente,produto,marketplace)`; checar `ml_item_id` existente | tabela de fila | Médio | Publicar N itens de teste sem duplicar |
| ML-02 | User Products não ligado | ML | **P1** | Publicação real rejeitada (calçado) | `mlPayload` só clássico | `src/lib/marketplaces/mlPayload.ts`, `mlUserProducts.ts` | Escolher clássico×UserProducts por categoria; criar guia de tamanhos | ML-01 opcional | Médio | 1 item real de calçado (controlado) |
| S-02 | `credenciais.md` com segredos em disco | Segurança | **P1** | Vazamento de credenciais | Arquivo de trabalho versionável | `credenciais.md` (raiz) | Mover p/ cofre; rotacionar; nunca versionar | — | Baixo | `git check-ignore` + ausência no repo |
| A-01 | Timeout de perfil → "Acesso não liberado" | Auth | **P2** | Falso bloqueio em rede lenta | `Promise.race` rejeita em 8s | `src/components/auth/AuthGate.tsx` | Distinguir erro transitório de sem-perfil; retry explícito | — | Baixo | Simular rede lenta / erro de rede |
| ML-03 | Token expirado sem retry/backoff | ML | **P2** | Falha esporádica de publicar/vendas | `renovarToken` sem retry | `src/lib/marketplaces/mercadolivre.ts` | Retry/backoff em 401/refresh | — | Baixo | Forçar token expirado em staging |
| UI-01 | Worker não atualiza a tela | UI | **P2** | Anúncios "não aparecem" sem refresh | Polling em vez de Realtime | `src/lib/repositorio.ts`, worker | Realtime nas tabelas do portal/fila | — | Baixo | Otimizar tudo e ver a tela atualizar |
| F-02 | Tamanhos de variação não normalizados | Produtos | **P2** | Grade/SIZE_GRID inconsistente | Import cru do ML | import/edição de variante | Normalizador de grade BR | ML-02 | Médio | Importar e conferir grade |
| S-01 | Sem validação de schema de payload | Segurança | **P2** | Payload malformado/abuso | Rotas confiam no corpo | `api/ml/publicar` e afins | Validar schema (zod ou manual) | — | Baixo | Enviar payloads inválidos → 400 |
| F-01 | Sem fluxo único de convite/criação de usuário+perfil | Auth | **P2** | Perfil esquecido → sem acesso | Criação manual em 2 passos | (serviço a criar) | Serviço central usuário+perfil atômico | — | Médio | Criar usuário e checar perfil |
| A-02 | `api/ml/autorizar` público | Auth/ML | **P3** | Iniciar OAuth sem sessão | GET de redirect | `api/ml/autorizar/route.ts` | `exigirAcessoAoCliente` antes de redirecionar | — | Baixo | Chamar sem sessão → 401 |
| A-03 | Proteção de rota client-side | Auth | **P3** | Depende do RLS | `AuthGate` | `AuthGate.tsx` | Revalidar papel no servidor nas rotas sensíveis restantes | — | Médio | Acessos diretos |
| M-01 | Sem escopo por membro de equipe | Multitenancy | **P3** | Toda equipe vê tudo | Por design | RLS `eh_equipe()` | (futuro) carteira por gestor | — | Médio | — |
| M-02 | Verificar tabelas novas sem RLS | Multitenancy | **P3** | Possível policy faltante | — | migrações | Auditar `pg_policies` em staging | — | Baixo | Query de auditoria |
| S-03 | Ledger de custo de IA / auditoria de alteração | Observab. | **P3** | Custo cego, sem trilha | Não implementado | — | `ai_execucoes` + `auditoria_log` | — | Médio | — |
| P3-LINT | 49 warnings ESLint | Qualidade | **P3** | Dívida técnica | React Compiler/hooks | vários | Limpar aos poucos | — | Baixo | `npm run lint` |
| P3-TEST | Sem testes de integração | Qualidade | **P3** | Cobertura limitada | Sem framework | — | Adicionar Vitest/RTL quando fizer sentido | — | Baixo | — |

## Riscos de segurança (consolidado)
P1: **S-02** (credenciais.md em disco). P2: **S-01** (validação de payload). P3: A-02 (autorizar público), A-03 (client-side), query string com clienteId. **Nenhum** segredo exposto ao frontend, em resposta de API ou em log (confirmado).

## Erros de autenticação
A-01 (P2, timeout→bloqueio), A-02 (P3), A-03 (P3), F-01 (P2). O núcleo (016 + RoteadorPapel) está **aprovado em staging**.

## Erros de multitenancy
Isolamento **correto** (aprovado). Itens abertos: M-01 (P3, sem escopo por membro), M-02 (P3, verificação de policies).

## Erros da integração Mercado Livre
ML-01 (P1, idempotência), ML-02 (P1, User Products), ML-03 (P2, retry de token), + `redirect_uri` por header (P3).

## Fluxos ainda não testáveis (sem execução end-to-end em staging)
- OAuth ML real, DevTools do `refresh_token`, importação de anúncios, consulta de vendas, dry-run e publicação controlada (dependem de conectar uma conta ML de teste — pendências da Etapa 1).
- Varredura visual completa da UI (estados vazios, botões, responsividade) — precisa de sessões logadas em staging.

## Ordem recomendada de correção
1. **S-02 (P1)** — tirar `credenciais.md` do disco de trabalho + rotacionar. *(Baixo risco, alto valor.)*
2. **ML-02 (P1)** — ligar User Products por categoria (desbloqueia publicar real). 
3. **ML-01 (P1)** — enfileirar publicação + idempotência.
4. **A-01 (P2)** — corrigir o timeout de perfil (não bloquear usuário válido).
5. **S-01 / ML-03 / UI-01 / F-02 / F-01 (P2)**.
6. **P3** (autorizar auth, escopo de equipe, ledger, lint, testes de integração).

## Plano de testes após cada correção
- **Após cada mudança:** `tsc --noEmit` + `node --test` + `npm run lint` + `npm run build` (todos devem seguir verdes).
- **S-02:** confirmar ausência do arquivo no repo e no working tree; `git check-ignore`.
- **ML-02/ML-01:** publicar 1 item de calçado de teste (controlado) sem duplicar; conferir `ml_item_id`.
- **A-01:** simular rede lenta/erro de rede → usuário válido não é deslogado.
- **UI-01:** "Otimizar tudo" → a tela reflete sem refresh manual.
- **Isolamento (regressão):** repetir a matriz do doc `10-VALIDACAO-ISOLAMENTO-CONCLUIDA.md` em staging.
- **Segurança (regressão):** DevTools sem `refresh_token`; rotas sem sessão → 401/403.
