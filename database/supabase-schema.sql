-- ============================================================
-- Zion OS v1.2 — Schema do banco (Supabase / PostgreSQL)
--
-- Como usar: cole este arquivo inteiro no SQL Editor do Supabase
-- e execute. Depois rode supabase-rls.sql e, por fim, seed.sql.
-- ============================================================

-- Função compartilhada para manter updated_at atualizado
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- 1. CLIENTES
-- ------------------------------------------------------------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  responsavel text default '',
  segmento text default '',
  marketplaces jsonb not null default '[]',
  plano text default '—',
  status text not null default 'Lead',
  data_entrada date default current_date,
  proxima_reuniao date,
  proxima_acao text default '',
  risco text not null default 'Baixo',
  observacoes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clientes_status on public.clientes (status);
create index if not exists idx_clientes_risco on public.clientes (risco);

create trigger trg_clientes_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. ONBOARDINGS (um por cliente)
-- ------------------------------------------------------------
create table if not exists public.onboardings (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  pendencias_cliente jsonb not null default '[]',
  observacoes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id)
);

create index if not exists idx_onboardings_cliente on public.onboardings (cliente_id);

create trigger trg_onboardings_updated_at
  before update on public.onboardings
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3. ONBOARDING_ITEMS (14 itens do checklist por onboarding)
-- ------------------------------------------------------------
create table if not exists public.onboarding_items (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.onboardings (id) on delete cascade,
  chave text not null,           -- ex.: 'contratoFechado', 'acessosML'…
  status text not null default 'Pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (onboarding_id, chave)
);

create index if not exists idx_onboarding_items_onboarding on public.onboarding_items (onboarding_id);

create trigger trg_onboarding_items_updated_at
  before update on public.onboarding_items
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4. PRODUTOS
-- ------------------------------------------------------------
create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null,
  marca text default '',
  modelo text default '',
  categoria text default '',
  sku text default '',
  cor text default '—',
  tamanho text default '—',
  custo numeric(12,2) not null default 0,
  preco_venda numeric(12,2) not null default 0,
  estoque integer not null default 0,
  marketplace text default 'Mercado Livre',
  status_cadastro text not null default 'Não iniciado',
  status_seo text not null default 'Pendente',
  status_descricao text not null default 'Pendente',
  status_imagens text not null default 'Pendente',
  status_precificacao text not null default 'Pendente',
  prioridade text not null default 'Média',
  observacoes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_produtos_cliente on public.produtos (cliente_id);
create index if not exists idx_produtos_status_cadastro on public.produtos (status_cadastro);
create index if not exists idx_produtos_prioridade on public.produtos (prioridade);

create trigger trg_produtos_updated_at
  before update on public.produtos
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 5. ANÚNCIOS
-- ------------------------------------------------------------
create table if not exists public.anuncios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  marketplace text default 'Mercado Livre',
  link text default '—',
  titulo_atual text default '—',
  titulo_otimizado text default '',
  status_seo text not null default 'Pendente',
  status_descricao text not null default 'Pendente',
  status_imagens text not null default 'Pendente',
  status_precificacao text not null default 'Pendente',
  status_concorrencia text not null default 'Pendente',
  status_revisao text not null default 'Pendente',
  status_publicacao text not null default 'Pendente',
  proxima_acao text default '',
  responsavel text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_anuncios_cliente on public.anuncios (cliente_id);
create index if not exists idx_anuncios_produto on public.anuncios (produto_id);
create index if not exists idx_anuncios_marketplace on public.anuncios (marketplace);
create index if not exists idx_anuncios_status_publicacao on public.anuncios (status_publicacao);

create trigger trg_anuncios_updated_at
  before update on public.anuncios
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 6. AGENTES IA
-- ------------------------------------------------------------
create table if not exists public.agentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  area text not null default 'Agência',
  objetivo text default '',
  quando_usar text default '',
  entrada_necessaria text default '',
  saida_esperada text default '',
  prompt_resumido text default '',
  status_implantacao text not null default 'Planejado',
  frequencia_uso text not null default 'Sob demanda',
  agentes_conectados jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agentes_area on public.agentes (area);
create index if not exists idx_agentes_status on public.agentes (status_implantacao);

create trigger trg_agentes_updated_at
  before update on public.agentes
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 7. TAREFAS
-- ------------------------------------------------------------
create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  produto_id uuid references public.produtos (id) on delete set null,
  anuncio_id uuid references public.anuncios (id) on delete set null,
  agente_id uuid references public.agentes (id) on delete set null,
  area text default 'Agência',
  tarefa text not null,
  responsavel text default '',
  prioridade text not null default 'Média',
  status text not null default 'Não iniciado',
  prazo date,
  proxima_acao text default '',
  observacoes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tarefas_cliente on public.tarefas (cliente_id);
create index if not exists idx_tarefas_produto on public.tarefas (produto_id);
create index if not exists idx_tarefas_anuncio on public.tarefas (anuncio_id);
create index if not exists idx_tarefas_status on public.tarefas (status);
create index if not exists idx_tarefas_prioridade on public.tarefas (prioridade);
create index if not exists idx_tarefas_prazo on public.tarefas (prazo);
create index if not exists idx_tarefas_responsavel on public.tarefas (responsavel);

create trigger trg_tarefas_updated_at
  before update on public.tarefas
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 8. RELATÓRIOS
-- ------------------------------------------------------------
create table if not exists public.relatorios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  periodo text not null,
  o_que_foi_feito text default '',
  produtos_trabalhados integer not null default 0,
  anuncios_revisados integer not null default 0,
  problemas_encontrados text default '—',
  oportunidades text default '—',
  pendencias text default '—',
  proximas_acoes text default '',
  status text not null default 'Em elaboração',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_relatorios_cliente on public.relatorios (cliente_id);
create index if not exists idx_relatorios_status on public.relatorios (status);

create trigger trg_relatorios_updated_at
  before update on public.relatorios
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 9. FINANCEIRO
-- ------------------------------------------------------------
create table if not exists public.financeiro (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  plano text default '—',
  valor_mensal numeric(12,2) not null default 0,
  data_vencimento date,
  status_pagamento text not null default 'Pendente',
  servicos_extras text default '—',
  custo_operacional numeric(12,2) not null default 0,
  lucro_estimado numeric(12,2) not null default 0,
  observacoes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_financeiro_cliente on public.financeiro (cliente_id);
create index if not exists idx_financeiro_status on public.financeiro (status_pagamento);
create index if not exists idx_financeiro_vencimento on public.financeiro (data_vencimento);

create trigger trg_financeiro_updated_at
  before update on public.financeiro
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 10. EXECUÇÕES DE AGENTES (histórico simulado)
-- ------------------------------------------------------------
create table if not exists public.execucoes_agentes (
  id uuid primary key default gen_random_uuid(),
  agente_id uuid not null references public.agentes (id) on delete cascade,
  data_hora timestamptz not null default now(),
  contexto text default '',
  resultado text default '',
  tipo text not null default 'Simulada', -- 'IA' quando executada via API Claude (v1.4)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_execucoes_agente on public.execucoes_agentes (agente_id);

create trigger trg_execucoes_updated_at
  before update on public.execucoes_agentes
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 11. REUNIÕES (preparação para v1.3 — ainda não usada nas telas)
-- ------------------------------------------------------------
create table if not exists public.reunioes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  titulo text not null,
  data_hora timestamptz,
  pauta text default '',
  status text not null default 'Agendada',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reunioes_cliente on public.reunioes (cliente_id);
create index if not exists idx_reunioes_data on public.reunioes (data_hora);

create trigger trg_reunioes_updated_at
  before update on public.reunioes
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 12. PENDÊNCIAS (preparação para v1.3 — hoje as pendências de
--     onboarding vivem em onboardings.pendencias_cliente)
-- ------------------------------------------------------------
create table if not exists public.pendencias (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  tarefa_id uuid references public.tarefas (id) on delete set null,
  descricao text not null,
  resolvida boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pendencias_cliente on public.pendencias (cliente_id);
create index if not exists idx_pendencias_resolvida on public.pendencias (resolvida);

create trigger trg_pendencias_updated_at
  before update on public.pendencias
  for each row execute function public.set_updated_at();
