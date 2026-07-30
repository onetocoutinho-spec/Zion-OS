-- ============================================================
-- Zion OS — Migração 019: Catálogo (lote recebido de uma Origem)
--
-- Fundação canônica (PR-006). Ver 001-product-master §Catálogo (Catálogo ≠ Produto
-- Mestre: aqui é o REGISTRO do lote recebido, imutável em conteúdo; o status muda).
-- INCREMENTAL, IDEMPOTENTE e REVERSÍVEL. NÃO destrói dados.
-- Rode UMA vez no SQL Editor, DEPOIS da 018. Valide em staging primeiro.
--
-- Nota de modelagem: `created_at` É o "recebido_em" (evita coluna redundante);
-- `cliente_id`/`organizacao_id` são denormalizados para RLS direta e consistente
-- com o padrão da plataforma (toda tabela operacional carrega cliente_id).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabela catalogo
-- ------------------------------------------------------------
create table if not exists public.catalogo (
  id                uuid primary key default gen_random_uuid(),
  organizacao_id    uuid not null references public.organizacoes (id)   on delete cascade,
  cliente_id        uuid not null references public.clientes (id)       on delete cascade,
  origem_produto_id uuid not null references public.origem_produto (id) on delete cascade,
  formato           text not null,          -- excel|csv|pdf|xml|api|drive|b2b
  referencia        text default '',        -- arquivo/URL/endpoint (SEM segredo)
  quantidade        integer not null default 0,
  status            text not null default 'recebido',  -- recebido|processado|erro
  observacoes       text default '',
  created_at        timestamptz not null default now(),  -- = recebido_em
  updated_at        timestamptz not null default now(),
  constraint catalogo_formato_chk
    check (formato in ('excel','csv','pdf','xml','api','drive','b2b')),
  constraint catalogo_status_chk
    check (status in ('recebido','processado','erro')),
  constraint catalogo_quantidade_chk
    check (quantidade >= 0)
);

-- ------------------------------------------------------------
-- 2) Índices
-- ------------------------------------------------------------
create index if not exists idx_catalogo_cliente     on public.catalogo (cliente_id);
create index if not exists idx_catalogo_organizacao on public.catalogo (organizacao_id);
create index if not exists idx_catalogo_origem      on public.catalogo (origem_produto_id);
create index if not exists idx_catalogo_status      on public.catalogo (status);

-- ------------------------------------------------------------
-- 3) Trigger updated_at (idempotente)
-- ------------------------------------------------------------
drop trigger if exists trg_catalogo_updated_at on public.catalogo;
create trigger trg_catalogo_updated_at
  before update on public.catalogo
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4) RLS: escopo por cliente (mesmo padrão da 012/018). Deny-by-default (016).
-- ------------------------------------------------------------
alter table public.catalogo enable row level security;

drop policy if exists "cliente_escopo" on public.catalogo;
create policy "cliente_escopo" on public.catalogo
  for all to authenticated
  using (cliente_id = public.cliente_do_usuario() or public.eh_equipe())
  with check (cliente_id = public.cliente_do_usuario() or public.eh_equipe());

-- ============================================================
-- REVERTER (não afeta nenhuma tabela existente):
--   drop policy if exists "cliente_escopo" on public.catalogo;
--   drop trigger if exists trg_catalogo_updated_at on public.catalogo;
--   drop table if exists public.catalogo;   -- só se 020–021 já revertidas
-- ============================================================
