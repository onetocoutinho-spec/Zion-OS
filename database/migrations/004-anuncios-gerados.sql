-- ============================================================
-- Zion OS v1.9 — Migração 004: anúncios gerados pela Esteira
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
-- Persiste o que a esteira produz (fila de aprovação → publicação).
-- ============================================================

create table if not exists public.anuncios_gerados (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  produto_id uuid references public.produtos (id) on delete set null,
  -- referência lógica à auditoria (migração 002); sem FK para não exigi-la
  auditoria_id uuid,
  marketplace text default 'Mercado Livre',
  origem text not null default 'esteira',            -- esteira | esteira_lote
  tipo_execucao text not null default 'Simulada',    -- IA | Simulada
  nota_diagnostico integer not null default 0,       -- 0..100 (A1)
  veredito_a10 text not null default 'reprovado',    -- aprovado | reprovado
  qtd_pendencias integer not null default 0,
  anuncio jsonb not null default '{}'::jsonb,        -- payload completo da esteira
  status text not null default 'rascunho',
  -- rascunho | aguardando_aprovacao | aprovado | rejeitado | publicado
  aprovado_por text default '',
  aprovado_em timestamptz,
  observacoes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ang_cliente on public.anuncios_gerados (cliente_id);
create index if not exists idx_ang_status on public.anuncios_gerados (status);
create index if not exists idx_ang_produto on public.anuncios_gerados (produto_id);

create trigger trg_ang_updated_at
  before update on public.anuncios_gerados
  for each row execute function public.set_updated_at();

alter table public.anuncios_gerados enable row level security;

create policy "equipe_autenticada" on public.anuncios_gerados
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.anuncios_gerados;
