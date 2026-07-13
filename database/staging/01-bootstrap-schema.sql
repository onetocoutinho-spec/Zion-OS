-- ============================================================
-- Zion OS — STAGING · 01 · BOOTSTRAP DO SCHEMA (base + migrações 001–015)
--
-- ESTE ARQUIVO NÃO DUPLICA AS MIGRAÇÕES. Ele é um MANIFESTO de execução
-- ordenada via psql (comando \ir = include relative). NÃO altera a
-- organização das migrações existentes.
--
-- >>> USO COM psql (recomendado para rodar tudo de uma vez):
--     psql "<STAGING_DB_CONNECTION_STRING>" -f database/staging/01-bootstrap-schema.sql
--     (rode a partir da RAIZ do repositório, ou ajuste os caminhos \ir)
--
-- >>> USO NO SQL EDITOR (Supabase, web): o \ir NÃO funciona lá. Nesse caso
--     abra cada arquivo abaixo NA MESMA ORDEM e cole/execute um por um.
--     Ver docs/staging-setup/06-APLICACAO-DAS-MIGRACOES.md.
--
-- ⚠️ NÃO inclui o seed de demonstração (_legado/seed.sql) nem o 001b
--    (dados de amostra) — staging usa dados de teste próprios (03-seed-...).
-- ⚠️ A migração 016 é aplicada DEPOIS, por 02-apply-security-016.sql, só
--    após o backfill dos perfis de teste (senão trava o acesso).
-- ============================================================

\echo '== [staging] marcando ambiente + aplicando base e migrações 001–015 =='

-- 0) Guardrail: marca este banco como STAGING (usado pelos scripts de escrita).
create table if not exists public.environment_metadata (
  environment text primary key,
  criado_em   timestamptz not null default now()
);
insert into public.environment_metadata (environment)
values ('staging')
on conflict (environment) do nothing;

-- 1) BASE LEGADA (tabelas clientes/produtos/anuncios/agentes/…, set_updated_at,
--    RLS base e realtime). SEM o seed de demonstração.
\ir ../_legado/supabase-schema.sql
\ir ../_legado/supabase-rls.sql
\ir ../_legado/supabase-realtime.sql

-- 2) MIGRAÇÕES DE PRODUTO/MARKETPLACE/PORTAL/SEGURANÇA, em ordem (pula 001b).
\ir ../migrations/001-modelagem-produtos-marketplace.sql
\ir ../migrations/002-auditoria-em-massa.sql
\ir ../migrations/003-modelo-marketplace-real.sql
\ir ../migrations/004-anuncios-gerados.sql
\ir ../migrations/005-portal-cliente.sql
\ir ../migrations/006-self-service-cliente.sql
\ir ../migrations/007-self-service-fase2.sql
\ir ../migrations/008-portal-cliente-leituras.sql
\ir ../migrations/009-marketplace-ml.sql
\ir ../migrations/010-imagens-storage.sql
\ir ../migrations/011-canal-cliente-conecta.sql
\ir ../migrations/012-fila-otimizacao-produto.sql
\ir ../migrations/013-tabela-medidas-produto.sql
\ir ../migrations/014-tabelas-medidas-cliente.sql
\ir ../migrations/015-kit-componentes.sql

\echo '== [staging] base + 001–015 aplicadas. PRÓXIMO: criar usuários/perfis de teste, depois 02-apply-security-016.sql =='

-- OPCIONAL (dados de amostra do produto — NÃO recomendado p/ teste de isolamento):
--   \ir ../migrations/001b-seed-modelagem.sql
