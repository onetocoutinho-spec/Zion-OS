-- ============================================================
-- Zion OS — Migração 020: Produto Mestre (identidade universal)
--
-- Fundação canônica (PR-006). Ver 001-product-master — a Fonte da Verdade do
-- marketplace. Tabela NOVA e PARALELA ao legado `produtos` (Strangler Fig): o
-- app atual continua usando `produtos`/`anuncios`; o Produto Mestre nasce ao lado,
-- populado daqui pra frente pelo Zion Intake (PR-005). Nada existente é tocado.
--
-- INCREMENTAL, IDEMPOTENTE e REVERSÍVEL. NÃO destrói dados.
-- Rode UMA vez no SQL Editor, DEPOIS da 019. Valide em staging primeiro.
--
-- Fronteira de Fonte da Verdade (000/001): esta tabela é dona de CONTEÚDO e
-- PREÇO/identidade; estoque/custo (espelho do ERP) e listings ficam em tabelas
-- próprias (PRs futuros). Aqui só a identidade + conteúdo + ciclo de vida + versão.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabela produto_mestre
-- ------------------------------------------------------------
create table if not exists public.produto_mestre (
  id                uuid primary key default gen_random_uuid(),
  organizacao_id    uuid not null references public.organizacoes (id)   on delete cascade,
  cliente_id        uuid not null references public.clientes (id)       on delete cascade,
  origem_produto_id uuid not null references public.origem_produto (id) on delete restrict, -- protege o mestre
  origem_tipo       text not null,          -- espelho do tipo da origem
  catalogo_id       uuid references public.catalogo (id) on delete set null, -- nullable (revenda)
  modo_operacao     text not null,          -- revenda | fabricacao_propria
  sku_origem        text not null,          -- chave 1a de conciliação
  ean               text,                   -- complementar
  erp_sku           text,                   -- código do ERP (pai)
  nome              text not null,
  marca             text,
  modelo            text,
  categoria_zion    text,
  descricao_base    text,
  seo               jsonb not null default '{}'::jsonb,
  status            text not null default 'rascunho',  -- ciclo de vida (001)
  versao_atual      integer not null default 1,
  observacoes       text default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint produto_mestre_modo_chk
    check (modo_operacao in ('revenda','fabricacao_propria')),
  constraint produto_mestre_origem_tipo_chk
    check (origem_tipo in ('fornecedor','fabricante','importador','distribuidor','marca_propria')),
  constraint produto_mestre_status_chk
    check (status in ('rascunho','enriquecido','pendente_aprovacao','aprovado','publicado','pausado','arquivado')),
  constraint produto_mestre_versao_chk
    check (versao_atual >= 1),
  -- Coerência 001 §5/F2: fabricação própria NÃO deriva de catálogo.
  constraint produto_mestre_fabricacao_sem_catalogo_chk
    check (modo_operacao <> 'fabricacao_propria' or catalogo_id is null),
  -- Identidade universal (001): sku_origem único por (cliente, origem).
  constraint produto_mestre_identidade_uk
    unique (cliente_id, origem_produto_id, sku_origem)
);

-- ------------------------------------------------------------
-- 2) Índices
--    idx (cliente_id, sku_origem): suporta a busca de conciliação atual
--    (RepositorioProdutoMestre.porSkuOrigem). Ver nota no PR sobre incluir a
--    origem na assinatura do repositório.
-- ------------------------------------------------------------
create index if not exists idx_produto_mestre_cliente      on public.produto_mestre (cliente_id);
create index if not exists idx_produto_mestre_organizacao  on public.produto_mestre (organizacao_id);
create index if not exists idx_produto_mestre_origem       on public.produto_mestre (origem_produto_id);
create index if not exists idx_produto_mestre_catalogo     on public.produto_mestre (catalogo_id);
create index if not exists idx_produto_mestre_sku_origem   on public.produto_mestre (cliente_id, sku_origem);
create index if not exists idx_produto_mestre_ean          on public.produto_mestre (ean);
create index if not exists idx_produto_mestre_erp_sku      on public.produto_mestre (erp_sku);
create index if not exists idx_produto_mestre_status       on public.produto_mestre (status);

-- ------------------------------------------------------------
-- 3) Trigger updated_at (idempotente)
-- ------------------------------------------------------------
drop trigger if exists trg_produto_mestre_updated_at on public.produto_mestre;
create trigger trg_produto_mestre_updated_at
  before update on public.produto_mestre
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4) RLS: escopo por cliente (mesmo padrão da 012/018/019). Deny-by-default (016).
-- ------------------------------------------------------------
alter table public.produto_mestre enable row level security;

drop policy if exists "cliente_escopo" on public.produto_mestre;
create policy "cliente_escopo" on public.produto_mestre
  for all to authenticated
  using (cliente_id = public.cliente_do_usuario() or public.eh_equipe())
  with check (cliente_id = public.cliente_do_usuario() or public.eh_equipe());

-- ============================================================
-- REVERTER (não afeta o legado `produtos`, que permanece intacto):
--   drop policy if exists "cliente_escopo" on public.produto_mestre;
--   drop trigger if exists trg_produto_mestre_updated_at on public.produto_mestre;
--   drop table if exists public.produto_mestre;   -- só se 021 já revertida
-- ============================================================
