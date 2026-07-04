-- ============================================================
-- Zion OS v1.8 — Migração 002: Auditoria em Massa
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor, depois da 001.
-- Cria as tabelas para lidar com clientes de 500, 1.000+ anúncios ativos.
-- ============================================================

-- ------------------------------------------------------------
-- 1) IMPORTACOES_ANUNCIOS — cada carga de base de anúncios
-- ------------------------------------------------------------
create table if not exists public.importacoes_anuncios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  marketplace text default 'Mercado Livre',
  nome_arquivo text default '',
  origem text not null default 'manual',      -- planilha | csv | api | manual
  quantidade_anuncios integer not null default 0,
  quantidade_processada integer not null default 0,
  status text not null default 'aguardando_processamento',
  data_importacao date default current_date,
  responsavel text default '',
  observacoes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_imp_cliente on public.importacoes_anuncios (cliente_id);
create index if not exists idx_imp_status on public.importacoes_anuncios (status);
create trigger trg_imp_updated_at
  before update on public.importacoes_anuncios
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2) AUDITORIAS_ANUNCIOS — um registro por anúncio auditado
-- ------------------------------------------------------------
create table if not exists public.auditorias_anuncios (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null references public.importacoes_anuncios (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  anuncio_id uuid references public.anuncios (id) on delete set null,
  produto_id uuid references public.produtos (id) on delete set null,
  marketplace text default 'Mercado Livre',
  link_anuncio text default '',
  titulo_atual text default '',
  categoria text default '',
  preco numeric(12,2) not null default 0,
  estoque integer not null default 0,
  vendas integer not null default 0,
  visitas integer not null default 0,
  conversao numeric(6,2) not null default 0,
  score_qualidade integer not null default 0,       -- 0..100
  classificacao_abc text not null default 'C',       -- A | B | C
  prioridade text not null default 'baixa',           -- critica | alta | media | baixa
  status_auditoria text not null default 'pendente',
  problemas_encontrados text default '',
  oportunidades text default '',
  proxima_acao text default '',
  agente_recomendado text default '',
  responsavel text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_aud_importacao on public.auditorias_anuncios (importacao_id);
create index if not exists idx_aud_cliente on public.auditorias_anuncios (cliente_id);
create index if not exists idx_aud_prioridade on public.auditorias_anuncios (prioridade);
create index if not exists idx_aud_abc on public.auditorias_anuncios (classificacao_abc);
create index if not exists idx_aud_status on public.auditorias_anuncios (status_auditoria);
create index if not exists idx_aud_score on public.auditorias_anuncios (score_qualidade);
create trigger trg_aud_updated_at
  before update on public.auditorias_anuncios
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3) PROBLEMAS_ANUNCIO — problemas detalhados por auditoria
-- ------------------------------------------------------------
create table if not exists public.problemas_anuncio (
  id uuid primary key default gen_random_uuid(),
  auditoria_id uuid not null references public.auditorias_anuncios (id) on delete cascade,
  tipo_problema text not null,
  gravidade text not null default 'media',
  descricao text default '',
  sugestao_correcao text default '',
  agente_recomendado text default '',
  status text not null default 'aberto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_prb_auditoria on public.problemas_anuncio (auditoria_id);
create index if not exists idx_prb_tipo on public.problemas_anuncio (tipo_problema);
create trigger trg_prb_updated_at
  before update on public.problemas_anuncio
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4) FILA_OTIMIZACAO — fila de execução da equipe
-- ------------------------------------------------------------
create table if not exists public.fila_otimizacao (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  auditoria_id uuid not null references public.auditorias_anuncios (id) on delete cascade,
  anuncio_id uuid references public.anuncios (id) on delete set null,
  prioridade text not null default 'media',
  tipo_acao text not null default 'otimizar_completo',
  agente_responsavel text default '',
  responsavel_humano text default '',
  status text not null default 'pendente',
  prazo date,
  resultado_esperado text default '',
  observacoes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_fila_cliente on public.fila_otimizacao (cliente_id);
create index if not exists idx_fila_prioridade on public.fila_otimizacao (prioridade);
create index if not exists idx_fila_status on public.fila_otimizacao (status);
create trigger trg_fila_updated_at
  before update on public.fila_otimizacao
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 5) EXECUCOES_LOTE — execução de agentes por lote
-- ------------------------------------------------------------
create table if not exists public.execucoes_lote (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  agente_id uuid references public.agentes (id) on delete set null,
  tipo_execucao text not null default 'auditoria_seo',
  quantidade_itens integer not null default 0,
  status text not null default 'pendente',
  entrada_resumo text default '',
  saida_resumo text default '',
  erros text default '',
  responsavel text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_exl_cliente on public.execucoes_lote (cliente_id);
create index if not exists idx_exl_agente on public.execucoes_lote (agente_id);
create trigger trg_exl_updated_at
  before update on public.execucoes_lote
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS: acesso apenas para equipe autenticada
-- ------------------------------------------------------------
alter table public.importacoes_anuncios enable row level security;
alter table public.auditorias_anuncios  enable row level security;
alter table public.problemas_anuncio     enable row level security;
alter table public.fila_otimizacao       enable row level security;
alter table public.execucoes_lote        enable row level security;

create policy "equipe_autenticada" on public.importacoes_anuncios
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.auditorias_anuncios
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.problemas_anuncio
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.fila_otimizacao
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.execucoes_lote
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- Realtime
-- ------------------------------------------------------------
alter publication supabase_realtime add table
  public.importacoes_anuncios,
  public.auditorias_anuncios,
  public.problemas_anuncio,
  public.fila_otimizacao,
  public.execucoes_lote;
