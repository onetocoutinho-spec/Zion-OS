# `database/staging/` — Scripts de bootstrap e validação (STAGING)

Scripts para preparar um banco Supabase **de staging** e validar a Etapa 1 de segurança. **Nenhum** destes scripts deve rodar em produção. Vários têm um **guardrail** que aborta se o banco não estiver marcado como `staging`.

> Estes arquivos **não duplicam** as migrações. Eles orquestram a execução na ordem certa (via `psql \ir`) ou apontam qual arquivo rodar no SQL Editor. A fonte da verdade continua em `database/migrations/` e `database/_legado/`.

## Ordem de uso

| # | Arquivo | O que faz | Escrita? |
|---|---------|-----------|----------|
| 0 | `00-preflight.sql` | Confirma que você está no banco certo (staging) e mostra contagens. | Leitura |
| 1 | `01-bootstrap-schema.sql` | Cria o marcador `environment_metadata='staging'`, aplica a **base legada** (`_legado/schema+rls+realtime`, **sem seed**) e as **migrações 001–015**. | Escrita |
| — | *(criar usuários no Auth + rodar `database/checks/check-users-without-profile.sql`)* | Diagnóstico + backfill de perfis. | — |
| 2 | `03-seed-test-data-template.sql` | Empresas/produtos/perfis de **teste** (placeholders de UUID). | Escrita |
| 3 | `02-apply-security-016.sql` | Aplica a migração **016** (deny-by-default) — só após os perfis existirem. | Escrita |
| 4 | `04-validation-queries.sql` | Confere funções, `perfis.ativo`, RLS, dados de teste. | Leitura |
| 5 | `05-cleanup-test-data.sql` | Remove os dados de teste (marcados `[TESTE STAGING]`). | Escrita |

> Passo "criar usuários no Auth" vem **antes** do 016 para o backfill; o seed de perfis (03) insere sem `ativo` (a coluna só nasce na 016) e o usuário inativo recebe `ativo=false` num UPDATE **após** a 016.

## Guardrail contra produção
Os scripts de escrita abortam com `raise exception` se não existir `public.environment_metadata` com `environment='staging'`. Esse marcador é criado pelo `01-bootstrap-schema.sql`. Produção não o tem → os scripts falham de propósito lá. Ver `docs/staging-setup/`.

## Rodando
- **psql (recomendado p/ tudo de uma vez):**
  `psql "<STAGING_DB_CONNECTION_STRING>" -f database/staging/01-bootstrap-schema.sql` (a partir da raiz do repo).
- **SQL Editor (Supabase, web):** o `\ir` não funciona; abra cada arquivo listado dentro do `01-bootstrap-schema.sql` **na mesma ordem** e execute um a um. Detalhes em `docs/staging-setup/06-APLICACAO-DAS-MIGRACOES.md`.

## Não incluído de propósito
- `_legado/seed.sql` (7 clientes fictícios de demonstração) — **não** rodar.
- `001b-seed-modelagem.sql` (dados de amostra) — opcional; evite no teste de isolamento.
