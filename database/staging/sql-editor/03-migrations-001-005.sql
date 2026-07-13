-- ============================================================
-- Zion OS — STAGING (SQL EDITOR) · 03 · Migrações 001–005
-- ============================================================
-- ⚠️ RODE SOMENTE no projeto Supabase **zion-os-staging**. NUNCA em produção.
--    Confirme o nome do projeto no topo do painel do Supabase ANTES de rodar.
-- Modelagem de produto, auditoria, anuncios_gerados, portal/RLS por papel.
-- Consolidado a partir dos arquivos REAIS do repositório (sem \ir, sem seed,
-- sem 001b, sem dados de demonstração). A lógica das migrações é preservada.
-- ============================================================

-- [guardrail de staging] aborta se o banco não estiver marcado como staging
-- (o marcador é criado por 01-base-schema.sql). Não é destrutivo.
do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='environment_metadata')
     or not exists (select 1 from public.environment_metadata where environment='staging') then
    raise exception 'GUARDRAIL: ambiente nao confirmado como staging. Rode 01-base-schema.sql no zion-os-staging antes deste arquivo.';
  end if;
end $$;

-- ------------------------------------------------------------
-- Fonte: database/migrations/001-modelagem-produtos-marketplace.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Fonte: database/migrations/002-auditoria-em-massa.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Fonte: database/migrations/003-modelo-marketplace-real.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Fonte: database/migrations/004-anuncios-gerados.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Fonte: database/migrations/005-portal-cliente.sql
-- ------------------------------------------------------------
-- ============================================================
-- Zion OS v1.9 — Migração 005: Portal do Cliente (login + acesso read-only)
--
-- INCREMENTAL e reversível. Rode UMA vez no SQL Editor.
--
-- Modelo:
--   * Cada usuário do Supabase Auth tem um PERFIL: papel 'equipe' ou 'cliente'.
--   * Usuário SEM perfil = EQUIPE (fail-safe — a equipe atual NÃO perde acesso).
--   * Cliente autenticado NÃO lê as tabelas cruas (RLS bloqueia). Ele enxerga
--     a operação dele SÓ pelas funções portal_* (SECURITY DEFINER), que
--     devolvem apenas campos seguros (sem custo/margem/observações internas).
--
-- Reverter (voltar ao acesso total da equipe): recrie as políticas
--   "equipe_total" trocando public.eh_equipe() por true, e drope os perfis.
-- ============================================================

-- 1) Perfis (mapeia usuário do Auth -> papel/cliente)
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete cascade,
  papel text not null default 'equipe',   -- equipe | cliente
  nome text default '',
  created_at timestamptz not null default now()
);

-- 2) Funções de identidade (SECURITY DEFINER — ignoram RLS por dentro,
--    evitando recursão; sempre com search_path fixo por segurança)
create or replace function public.eh_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.papel = 'equipe' from public.perfis p where p.id = auth.uid()),
    true  -- sem perfil = equipe (não quebra os usuários atuais)
  );
$$;

create or replace function public.cliente_do_usuario()
returns uuid language sql stable security definer set search_path = public as $$
  select p.cliente_id from public.perfis p
  where p.id = auth.uid() and p.papel = 'cliente';
$$;

-- 3) RLS das tabelas: troca "equipe_autenticada (using true)" por
--    "equipe_total (using eh_equipe())". Clientes deixam de ler as cruas.
do $$
declare t text;
begin
  foreach t in array array[
    'clientes','onboardings','onboarding_items','produtos','anuncios','agentes',
    'tarefas','relatorios','financeiro','execucoes_agentes','reunioes','pendencias',
    'produto_variantes','produto_atributos','categoria_templates','anuncio_variantes',
    'precificacao_variantes','imagens_produto','importacoes_anuncios','auditorias_anuncios',
    'problemas_anuncio','fila_otimizacao','execucoes_lote','anuncios_gerados'
  ]
  loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "equipe_autenticada" on public.%I', t);
      execute format('drop policy if exists "equipe_total" on public.%I', t);
      execute format(
        'create policy "equipe_total" on public.%I for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe())', t);
    end if;
  end loop;
end $$;

-- 4) RLS de perfis
alter table public.perfis enable row level security;
drop policy if exists "perfil_proprio" on public.perfis;
create policy "perfil_proprio" on public.perfis
  for select to authenticated using (id = auth.uid() or public.eh_equipe());
drop policy if exists "perfil_equipe_admin" on public.perfis;
create policy "perfil_equipe_admin" on public.perfis
  for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());

-- 5) Funções do PORTAL (read-only, escopadas pelo cliente do usuário).
--    Só devolvem campos seguros para o cliente ver.
create or replace function public.portal_resumo()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'cliente',       (select empresa from public.clientes where id = public.cliente_do_usuario()),
    'proximaAcao',   (select proxima_acao from public.clientes where id = public.cliente_do_usuario()),
    'totalProdutos', (select count(*) from public.produtos where cliente_id = public.cliente_do_usuario()),
    'emProducao',    (select count(*) from public.anuncios_gerados where cliente_id = public.cliente_do_usuario() and status in ('rascunho','aguardando_aprovacao')),
    'aprovados',     (select count(*) from public.anuncios_gerados where cliente_id = public.cliente_do_usuario() and status = 'aprovado'),
    'publicados',    (select count(*) from public.anuncios_gerados where cliente_id = public.cliente_do_usuario() and status = 'publicado')
  );
$$;

create or replace function public.portal_proximas_acoes()
returns table(tarefa text, proxima_acao text, status text, prazo date)
language sql stable security definer set search_path = public as $$
  select t.tarefa, t.proxima_acao, t.status, t.prazo
  from public.tarefas t
  where t.cliente_id = public.cliente_do_usuario() and coalesce(t.status,'') <> 'Concluído'
  order by t.prazo asc nulls last
  limit 40;
$$;

create or replace function public.portal_anuncios()
returns table(titulo text, status text, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(ag.anuncio->>'tituloOtimizado',''), '(sem título)') as titulo,
         ag.status, ag.created_at
  from public.anuncios_gerados ag
  where ag.cliente_id = public.cliente_do_usuario()
  order by ag.created_at desc
  limit 60;
$$;

-- 6) Permissões: authenticated pode chamar as funções (a segurança está no
--    escopo por cliente_do_usuario() dentro de cada uma).
grant execute on function public.eh_equipe() to authenticated;
grant execute on function public.cliente_do_usuario() to authenticated;
grant execute on function public.portal_resumo() to authenticated;
grant execute on function public.portal_proximas_acoes() to authenticated;
grant execute on function public.portal_anuncios() to authenticated;

-- ============================================================
-- Depois de rodar: para dar acesso a um cliente
--   1. Authentication → Users → Add user (e-mail + senha do cliente).
--   2. Copie o User UID e rode (troque os valores):
--      insert into public.perfis (id, cliente_id, papel, nome)
--      values ('<USER_UID>', '<CLIENTE_ID>', 'cliente', 'Nome do cliente');
--   Para achar o CLIENTE_ID: select id, empresa from public.clientes;
-- ============================================================
