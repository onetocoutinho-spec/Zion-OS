-- ============================================================
-- Zion OS — Migração 026: System Authorship (E5.9)
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
-- Completa a assinatura do sistema nas Ofertas (fecha a S-30): além de
-- QUEM agiu (autor_da_oferta, desde a 025) e do contrato (versao_contrato),
-- toda oferta passa a gravar QUAL VERSÃO de cada mecanismo agiu.
--
-- Colunas ADITIVAS e NULLABLE: o log é append-only — as ofertas anteriores
-- à E5.9 permanecem intocadas (NULL = "anterior ao versionamento completo",
-- leitura honesta; nenhum backfill inventa história).
-- ============================================================

alter table public.ofertas
  add column if not exists versao_engine text,
  add column if not exists versao_confidence text,
  add column if not exists versao_explainability text;

comment on column public.ofertas.versao_engine is
  'Release do componente que gerou a oferta (E5.9). NULL = oferta anterior ao versionamento.';
comment on column public.ofertas.versao_confidence is
  'Versão do conjunto de regras de confidence usado no instante (E5.9).';
comment on column public.ofertas.versao_explainability is
  'Versão da função de explicação usada no instante (E5.9).';

-- ------------------------------------------------------------
-- VERIFICAÇÃO (somente leitura):
--   select column_name from information_schema.columns
--    where table_name = 'ofertas' and column_name like 'versao_%';
--   -- esperado: versao_contrato, versao_engine, versao_confidence, versao_explainability
--
-- REVERTER (remove só as colunas novas; nenhuma linha é tocada):
--   alter table public.ofertas
--     drop column if exists versao_engine,
--     drop column if exists versao_confidence,
--     drop column if exists versao_explainability;
--   delete from public.migracoes_aplicadas where numero = '026';
-- ------------------------------------------------------------

-- ★ Auto-registro (convenção ≥024):
insert into public.migracoes_aplicadas (numero, nome, observacao)
values ('026','026-system-authorship','assinatura versionada do sistema nas ofertas — E5.9 (fecha S-30)')
on conflict (numero) do nothing;
