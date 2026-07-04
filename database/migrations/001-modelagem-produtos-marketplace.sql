-- ============================================================
-- Zion OS v1.7 — Migração 001: modelagem de produtos marketplace
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor do Supabase,
-- depois do setup completo já existente. Só ADICIONA colunas e tabelas —
-- não apaga nem altera dados existentes.
-- ============================================================

-- 1) Produto pai ganha campos de modelagem (aditivo)
alter table public.produtos
  add column if not exists tipo_produto text not null default 'simples',
  add column if not exists categoria_marketplace_sugerida text default '',
  add column if not exists descricao_base text default '',
  add column if not exists beneficios text default '',
  add column if not exists cuidados text default '';

-- 2) Anúncio ganha campos de marketplace (aditivo)
alter table public.anuncios
  add column if not exists categoria_marketplace text default '',
  add column if not exists descricao text default '',
  add column if not exists id_externo_marketplace text default '',
  add column if not exists observacoes text default '';

-- ------------------------------------------------------------
-- 3) PRODUTO_VARIANTES — cada derivação vendável (SKU)
-- ------------------------------------------------------------
create table if not exists public.produto_variantes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  sku text default '',
  codigo_interno text default '',
  ean text default '',
  cor text default '',
  tamanho text default '',
  voltagem text default '',
  sabor text default '',
  aroma text default '',
  modelo_variacao text default '',
  custo numeric(12,2) not null default 0,
  preco_base numeric(12,2) not null default 0,
  estoque integer not null default 0,
  peso numeric(10,3) not null default 0,
  altura numeric(10,2) not null default 0,
  largura numeric(10,2) not null default 0,
  comprimento numeric(10,2) not null default 0,
  status text not null default 'Ativa',
  observacoes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_variantes_produto on public.produto_variantes (produto_id);
create index if not exists idx_variantes_cliente on public.produto_variantes (cliente_id);
create index if not exists idx_variantes_status on public.produto_variantes (status);
create index if not exists idx_variantes_sku on public.produto_variantes (sku);
create trigger trg_variantes_updated_at
  before update on public.produto_variantes
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4) PRODUTO_ATRIBUTOS — ficha técnica dinâmica
-- ------------------------------------------------------------
create table if not exists public.produto_atributos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos (id) on delete cascade,
  nome_atributo text not null,
  valor_atributo text default '',
  tipo_atributo text not null default 'texto',
  obrigatorio boolean not null default false,
  origem text not null default 'Manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_atributos_produto on public.produto_atributos (produto_id);
create trigger trg_atributos_updated_at
  before update on public.produto_atributos
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 5) CATEGORIA_TEMPLATES — molde por nicho
-- ------------------------------------------------------------
create table if not exists public.categoria_templates (
  id uuid primary key default gen_random_uuid(),
  categoria_zion text not null,
  marketplace text not null default 'Todos',
  nome_template text not null,
  descricao text default '',
  campos_obrigatorios jsonb not null default '[]',
  campos_recomendados jsonb not null default '[]',
  atributos_marketplace jsonb not null default '[]',
  regras_variacao text default '',
  checklist_categoria jsonb not null default '[]',
  agentes_recomendados jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_templates_categoria on public.categoria_templates (categoria_zion);
create trigger trg_templates_updated_at
  before update on public.categoria_templates
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 6) ANUNCIO_VARIANTES — derivações vinculadas a um anúncio
-- ------------------------------------------------------------
create table if not exists public.anuncio_variantes (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references public.anuncios (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  variante_id uuid not null references public.produto_variantes (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  sku_enviado text default '',
  preco_enviado numeric(12,2) not null default 0,
  estoque_enviado integer not null default 0,
  status_envio text not null default 'Não enviada',
  id_variacao_marketplace text default '',
  observacoes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (anuncio_id, variante_id)
);
create index if not exists idx_anv_anuncio on public.anuncio_variantes (anuncio_id);
create index if not exists idx_anv_variante on public.anuncio_variantes (variante_id);
create trigger trg_anv_updated_at
  before update on public.anuncio_variantes
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 7) PRECIFICACAO_VARIANTES — precificação por derivação
-- ------------------------------------------------------------
create table if not exists public.precificacao_variantes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  variante_id uuid not null references public.produto_variantes (id) on delete cascade,
  marketplace text not null default 'Mercado Livre',
  custo_produto numeric(12,2) not null default 0,
  embalagem numeric(12,2) not null default 0,
  imposto_percentual numeric(6,2) not null default 0,
  taxa_marketplace_percentual numeric(6,2) not null default 0,
  taxa_fixa numeric(12,2) not null default 0,
  comissao_gestor_percentual numeric(6,2) not null default 0,
  outros_custos numeric(12,2) not null default 0,
  preco_venda numeric(12,2) not null default 0,
  lucro_bruto numeric(12,2) not null default 0,
  lucro_liquido numeric(12,2) not null default 0,
  margem_liquida_percentual numeric(6,2) not null default 0,
  preco_minimo numeric(12,2) not null default 0,
  status_margem text not null default 'Saudável',
  observacoes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pcv_produto on public.precificacao_variantes (produto_id);
create index if not exists idx_pcv_variante on public.precificacao_variantes (variante_id);
create trigger trg_pcv_updated_at
  before update on public.precificacao_variantes
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 8) IMAGENS_PRODUTO — imagens por produto/variação/anúncio
-- ------------------------------------------------------------
create table if not exists public.imagens_produto (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  variante_id uuid references public.produto_variantes (id) on delete set null,
  anuncio_id uuid references public.anuncios (id) on delete set null,
  tipo_imagem text not null default 'Principal',
  url text default '',
  status text not null default 'Pendente',
  observacoes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_img_produto on public.imagens_produto (produto_id);
create index if not exists idx_img_anuncio on public.imagens_produto (anuncio_id);
create trigger trg_img_updated_at
  before update on public.imagens_produto
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS: acesso apenas para equipe autenticada (mesmo modelo do resto)
-- ------------------------------------------------------------
alter table public.produto_variantes       enable row level security;
alter table public.produto_atributos       enable row level security;
alter table public.categoria_templates     enable row level security;
alter table public.anuncio_variantes       enable row level security;
alter table public.precificacao_variantes  enable row level security;
alter table public.imagens_produto         enable row level security;

create policy "equipe_autenticada" on public.produto_variantes
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.produto_atributos
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.categoria_templates
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.anuncio_variantes
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.precificacao_variantes
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.imagens_produto
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- Realtime: incluir as novas tabelas na publication
-- ------------------------------------------------------------
alter publication supabase_realtime add table
  public.produto_variantes,
  public.produto_atributos,
  public.categoria_templates,
  public.anuncio_variantes,
  public.precificacao_variantes,
  public.imagens_produto;
