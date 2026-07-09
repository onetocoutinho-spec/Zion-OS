-- ============================================================
-- Zion OS — Migração 015: Composição de kit/combo por produto
--
-- INCREMENTAL. Rode UMA vez no SQL Editor, depois da 014.
--
-- Um produto do tipo "kit"/"combo" carrega seus COMPONENTES (jsonb). Cobre
-- todos os casos: N unidades do mesmo produto, produtos diferentes juntos,
-- grade fechada e combo/brinde. O preço do kit é o próprio produto.preco_venda.
--
-- componentes = [{ "produtoId": "...", "nome": "...", "sku": "...",
--                  "quantidade": 3, "brinde": false }]
-- ============================================================

alter table public.produtos
  add column if not exists componentes jsonb not null default '[]'::jsonb;
