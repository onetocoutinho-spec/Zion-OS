-- ============================================================
-- Zion OS — Migração 013: Override da tabela de medidas por produto
--
-- INCREMENTAL. Rode UMA vez no SQL Editor, depois da 012.
--
-- A tabela de medidas (numeração → comprimento do pé) é, por padrão, por
-- MARCA (arquivo src/lib/data/tabelasMedidas.ts). Esta coluna guarda um
-- OVERRIDE por produto — só quando o produto foge do padrão da marca.
-- ============================================================

alter table public.produtos
  add column if not exists tabela_medidas text default '';
