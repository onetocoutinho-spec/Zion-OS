-- ============================================================
-- Zion OS v1.9 — Migração 003: alinhamento com o modelo real
-- (SKU pai do ERP do cliente + precificação Zion nos produtos)
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
-- O ERP varia por cliente (Magazord na Chinelaria; Bling/Tiny/Linx em outros),
-- por isso o campo é genérico: cod_erp.
-- ============================================================

alter table public.produtos
  add column if not exists cod_erp         text,
  add column if not exists preco_minimo    numeric(12,2),
  add column if not exists margem          numeric(6,2),
  add column if not exists confianca_custo text default '';

-- O id externo do anúncio (MLB/…) já existe como id_externo_marketplace (migração 001).
-- Índice para conciliar por SKU do ERP entre canais.
create index if not exists idx_produtos_cod_erp on public.produtos (cod_erp);
