# 09 — Rollback e Limpeza (Staging)

## Rollback da migração 016 (só staging)
A `016` é reversível. Rode o bloco "REVERTER" comentado no fim de `database/migrations/016-fix-multitenancy-security.sql`: recria `eh_equipe()`/`cliente_do_usuario()` no comportamento anterior (`coalesce(..., true)` / sem exigir `ativo`). A coluna `perfis.ativo` pode **permanecer** (inofensiva).

Confirme que o rollback **não** remove usuários, clientes nem perfis (ele só troca a definição de 2 funções). Verifique com contagens antes/depois:
```sql
select (select count(*) from auth.users) as u,
       (select count(*) from public.clientes) as c,
       (select count(*) from public.perfis) as p;
```
Se o staging deve seguir com a segurança ligada, **reaplique** a 016 após o teste (`database/staging/02-apply-security-016.sql`).

## Rollback do código
O código da Etapa 1 está na branch `fix/multitenancy-security` (2 commits). Em staging (Preview), reverter = apontar o Preview para outro commit/branch, ou `git revert`. Ver `docs/implementation-phase-1-security/07-ROLLBACK.md`.

## Limpeza dos dados de teste
Rode `database/staging/05-cleanup-test-data.sql` (tem guardrail): apaga empresas `[TESTE STAGING]` (cascata → produtos/variações/anúncios/canais/perfis ligados) e perfis `[TESTE]`. **Não** apaga usuários do Auth — remova-os pelo painel Authentication se quiser.

## Descartar o ambiente de staging
- **Supabase:** apague o projeto `zion-os-staging` (Settings → General → Delete project) quando não precisar mais.
- **Vercel:** remova as variáveis de **Preview** de staging (não toque nas de Production) e, se criou projeto/branch dedicados, remova-os.
- **Mercado Livre:** desconecte a conta de teste e, se criou um app de staging, mantenha-o só para testes ou remova.

## Nunca
- Nunca teste rollback em produção.
- Nunca rode os scripts de escrita sem o marcador `environment_metadata='staging'` (eles abortam sozinhos, mas confirme o `00-preflight.sql` antes).
