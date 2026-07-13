-- ============================================================
-- Zion OS — Migração 018: Origem do Produto
--
-- Fundação canônica (PR-006). Ver 000-business-domain / 001-product-master §Origem.
-- INCREMENTAL, IDEMPOTENTE e REVERSÍVEL. NÃO destrói dados.
-- Rode UMA vez no SQL Editor, DEPOIS da 017. Valide em staging primeiro.
--
-- O QUE FAZ:
--   Cria `origem_produto` — DE ONDE o produto vem (fornecedor | fabricante |
--   importador | distribuidor | marca_propria). Âncora do `sku_origem` (chave 1a
--   de conciliação). Tabela NOVA e dormente; nenhuma tabela existente é tocada.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabela origem_produto
-- ------------------------------------------------------------
create table if not exists public.origem_produto (
  id              uuid primary key default gen_random_uuid(),
  organizacao_id  uuid not null references public.organizacoes (id) on delete cascade,
  cliente_id      uuid not null references public.clientes (id)     on delete cascade,
  tipo            text not null,          -- fornecedor|fabricante|importador|distribuidor|marca_propria
  nome            text not null,
  documento       text,                   -- CNPJ/ref (nullable)
  interna         boolean not null default false,  -- true = fabricação/marca própria
  status          text not null default 'ativo',   -- ativo | inativo
  observacoes     text default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint origem_produto_tipo_chk
    check (tipo in ('fornecedor','fabricante','importador','distribuidor','marca_propria')),
  constraint origem_produto_status_chk
    check (status in ('ativo','inativo'))
);

-- ------------------------------------------------------------
-- 2) Índices (conciliação/consulta por tenant e tipo)
-- ------------------------------------------------------------
create index if not exists idx_origem_produto_cliente     on public.origem_produto (cliente_id);
create index if not exists idx_origem_produto_organizacao on public.origem_produto (organizacao_id);
create index if not exists idx_origem_produto_tipo        on public.origem_produto (tipo);

-- ------------------------------------------------------------
-- 3) Trigger updated_at (idempotente)
-- ------------------------------------------------------------
drop trigger if exists trg_origem_produto_updated_at on public.origem_produto;
create trigger trg_origem_produto_updated_at
  before update on public.origem_produto
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4) RLS: escopo por cliente (cliente vê a própria; equipe vê tudo) — mesmo
--    padrão de fila_otimizacao_produto (012). Deny-by-default herdado (016).
-- ------------------------------------------------------------
alter table public.origem_produto enable row level security;

drop policy if exists "cliente_escopo" on public.origem_produto;
create policy "cliente_escopo" on public.origem_produto
  for all to authenticated
  using (cliente_id = public.cliente_do_usuario() or public.eh_equipe())
  with check (cliente_id = public.cliente_do_usuario() or public.eh_equipe());

-- ============================================================
-- REVERTER (não afeta nenhuma tabela existente):
--   drop policy if exists "cliente_escopo" on public.origem_produto;
--   drop trigger if exists trg_origem_produto_updated_at on public.origem_produto;
--   drop table if exists public.origem_produto;   -- só se 019–021 já revertidas
-- ============================================================
