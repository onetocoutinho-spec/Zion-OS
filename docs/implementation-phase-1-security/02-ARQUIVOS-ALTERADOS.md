# 02 — Arquivos criados / alterados

## Criados

| Arquivo | Razão |
|---------|-------|
| `database/migrations/016-fix-multitenancy-security.sql` | R1: `perfis.ativo` + `eh_equipe()`/`cliente_do_usuario()` deny-by-default. Aditiva/reversível. |
| `database/checks/check-users-without-profile.sql` | Diagnóstico (só leitura) antes da 016. |
| `database/checks/fix-missing-profiles-template.sql` | Template de correção assistida (placeholders, sem execução). |
| `src/lib/auth/serverAuthorization.ts` | R6: validação de sessão + decisão de acesso (401/403) no servidor. |
| `src/lib/auth/serverAuthorization.test.ts` | Testes das funções puras de autorização. |
| `src/lib/supabase/sessao.ts` | Cliente: anexa `Authorization: Bearer <jwt>` nas chamadas a `/api/*`. |
| `src/lib/marketplaces/canalServidor.ts` | R3: leitura/rotação do refresh_token no servidor (via RLS). |
| `docs/implementation-phase-1-security/*`, `docs/security-validation-checklist.md` | Documentação desta fase. |

## Alterados

| Arquivo | O que mudou | Risco |
|---------|-------------|-------|
| `src/lib/services/perfil.ts` | `meuPerfil()` retorna `Perfil \| null`; sem perfil/inativo = `null` (sem acesso); erro real propaga (não vira equipe). | R1 |
| `src/components/auth/AuthGate.tsx` | Não cai mais para equipe por omissão; tela "Acesso não liberado" para logado sem perfil válido; timeout → sem-acesso (com retry). | R1 |
| `src/lib/services/canaisMarketplace.ts` | Tipo/consulta **públicos** (sem `refresh_token`); `atualizarRefreshToken` (browser) removido; `salvarCanal` só trata status/config. | R3 |
| `src/app/api/ml/conectar/route.ts` | Recebe `clienteId`; autoriza; **salva** o token no canal (server); resposta sem token. | R3, R6 |
| `src/app/api/ml/publicar/route.ts` | Recebe `clienteId` (não o token); autoriza; lê/rotaciona token no server; resposta sem token. | R3, R6 |
| `src/app/api/ml/vendas/route.ts` | idem publicar (fluxo de vendas). | R3, R6 |
| `src/app/api/ml/importar-anuncios/route.ts` | idem publicar (fluxo de importação). | R3, R6 |
| `src/lib/services/publicacaoML.ts` | Envia `clienteId` + `Authorization`; checa `canal.ativo`; não lê/reenvia token. | R3 |
| `src/lib/services/vendasML.ts` | idem (envia `clienteId`, sem token). | R3 |
| `src/lib/services/importarAnunciosML.ts` | idem (envia `clienteId`, sem token). | R3 |
| `src/app/cliente/conectar-ml/page.tsx` | Envia `code`+`clienteId`+sessão; não recebe/salva token no browser; `conectado` = `ativo`. | R3 |
| `src/app/cliente/configuracoes/page.tsx` | "Conectado" passa a depender de `canal.ativo` (sem `refresh_token`). | R3 |
| `src/app/api/agentes/esteira/route.ts` | `exigirAutenticado` no topo do POST. | R6 |
| `src/app/api/agentes/executar/route.ts` | `exigirAutenticado`. | R6 |
| `src/app/api/imagens/gerar/route.ts` | `exigirAutenticado`. | R6 |
| `tsconfig.json` | Exclui `**/*.test.ts` do build/typecheck do app. | — |

## Não alterado de propósito
- `src/lib/marketplaces/mercadolivre.ts` (adaptador puro; assinaturas mantidas).
- `src/lib/marketplaces/mlPayload.ts` / `mlUserProducts.ts` (payload não foi tocado — fora de escopo).
- Worker `src/app/api/otimizar/worker/route.ts` (usa `service_role`, sem sessão; não muda).
- Nenhuma migração antiga foi editada; nenhuma tabela renomeada/removida.
