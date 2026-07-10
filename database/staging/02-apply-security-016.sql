-- ============================================================
-- Zion OS — STAGING · 02 · APLICAR A MIGRAÇÃO DE SEGURANÇA 016
--
-- Aplica database/migrations/016-fix-multitenancy-security.sql em STAGING.
-- NÃO duplica a migração — apenas a inclui (psql \ir) após um GUARDRAIL.
--
-- PRÉ-REQUISITOS (senão você trava o acesso da equipe de teste):
--   1) 01-bootstrap-schema.sql já rodou (base + 001–015).
--   2) Você já criou os usuários de teste (Auth) e os PERFIS de equipe/cliente
--      (ver 03-seed-test-data-template.sql). Rode o diagnóstico
--      database/checks/check-users-without-profile.sql e confirme 0 usuários
--      de equipe sem perfil.
--
-- >>> psql:  psql "<STAGING_DB>" -f database/staging/02-apply-security-016.sql
-- >>> SQL Editor: cole e rode database/migrations/016-fix-multitenancy-security.sql
--     (depois de conferir o guardrail abaixo manualmente).
-- ============================================================

-- GUARDRAIL: só roda se o banco estiver marcado como staging.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema='public' and table_name='environment_metadata'
  ) or not exists (
    select 1 from public.environment_metadata where environment='staging'
  ) then
    raise exception 'GUARDRAIL: ambiente NAO marcado como staging. Rode 01-bootstrap-schema.sql (que cria environment_metadata=staging) ou confirme que este NAO e producao.';
  end if;
end $$;

\echo '== [staging] aplicando migração 016 (deny-by-default + perfis.ativo) =='
\ir ../migrations/016-fix-multitenancy-security.sql
\echo '== [staging] 016 aplicada. Rode 04-validation-queries.sql =='
