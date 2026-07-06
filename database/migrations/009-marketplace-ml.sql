-- ============================================================
-- Zion OS v2.1 — Migração 009: Publicação no Mercado Livre (Fase 3)
--
-- INCREMENTAL e reversível. Rode UMA vez no SQL Editor, depois da 008.
--
-- Guarda a conexão de cada cliente com o marketplace (canal) e o resultado
-- da publicação. NÃO guarda o segredo do app ML (client_secret) — esse fica
-- só no .env do servidor (ML_CLIENT_ID / ML_CLIENT_SECRET). Aqui só o
-- refresh_token do cliente + config do canal.
-- ============================================================

-- 1) Canais de marketplace por cliente (credenciais/config do cliente).
create table if not exists public.canais_marketplace (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  marketplace   text not null default 'Mercado Livre',
  -- OAuth do cliente no ML. O client_secret do APP fica no .env do servidor.
  refresh_token text,
  seller_id     text,
  tipo_anuncio  text not null default 'Premium', -- Premium (gold_pro) | Clássico (gold_special)
  ativo         boolean not null default true,
  atualizado_em timestamptz not null default now(),
  unique (cliente_id, marketplace)
);

alter table public.canais_marketplace enable row level security;

-- Só a equipe gerencia canais (segredos de integração não são do cliente).
drop policy if exists "equipe_total" on public.canais_marketplace;
create policy "equipe_total" on public.canais_marketplace
  for all to authenticated
  using (public.eh_equipe())
  with check (public.eh_equipe());

-- 2) Resultado da publicação no anúncio gerado.
alter table public.anuncios_gerados add column if not exists ml_item_id  text;
alter table public.anuncios_gerados add column if not exists ml_permalink text;
