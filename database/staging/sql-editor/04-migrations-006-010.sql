-- ============================================================
-- Zion OS — STAGING (SQL EDITOR) · 04 · Migrações 006–010
-- ============================================================
-- ⚠️ RODE SOMENTE no projeto Supabase **zion-os-staging**. NUNCA em produção.
--    Confirme o nome do projeto no topo do painel do Supabase ANTES de rodar.
-- Self-service do cliente, leituras do portal, marketplace ML, storage.
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
-- Fonte: database/migrations/006-self-service-cliente.sql
-- ------------------------------------------------------------
-- ============================================================
-- Zion OS v1.9 — Migração 006: Self-service do cliente (Fase 1)
--
-- INCREMENTAL e reversível. Rode UMA vez no SQL Editor, depois da 005.
--
-- O cliente autenticado passa a AGIR nos próprios dados (não só ver):
--   * lê seus produtos e variações;
--   * cria/edita seus próprios anúncios gerados (rodar esteira + aprovar).
-- Tudo escopado por cliente_do_usuario(); a equipe mantém acesso total.
--
-- Cota mensal por cliente (limite_esteira_mes) — controla o custo de IA e
-- vira a base de cobrança por plano.
-- ============================================================

-- 1) Cota mensal de anúncios (rodadas de esteira) por cliente
alter table public.clientes
  add column if not exists limite_esteira_mes integer not null default 30;

-- 2) RLS: leitura escopada dos produtos e variações do próprio cliente
--    (no self-service o produto/custo é do próprio cliente — pode ver).
do $$
declare t text;
begin
  foreach t in array array['produtos','produto_variantes'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists "cliente_leitura" on public.%I', t);
      execute format(
        'create policy "cliente_leitura" on public.%I for select to authenticated using (cliente_id = public.cliente_do_usuario())', t);
    end if;
  end loop;
end $$;

-- 3) RLS: o cliente cria e edita os PRÓPRIOS anúncios gerados (esteira + aprovar)
drop policy if exists "cliente_escopo" on public.anuncios_gerados;
create policy "cliente_escopo" on public.anuncios_gerados
  for all to authenticated
  using (cliente_id = public.cliente_do_usuario())
  with check (cliente_id = public.cliente_do_usuario());

-- 4) Cota da esteira no mês (usado x limite) para o cliente logado
create or replace function public.quota_esteira()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'limite', coalesce((select limite_esteira_mes from public.clientes where id = public.cliente_do_usuario()), 0),
    'usado',  (select count(*) from public.anuncios_gerados
               where cliente_id = public.cliente_do_usuario()
                 and created_at >= date_trunc('month', now()))
  );
$$;
grant execute on function public.quota_esteira() to authenticated;

-- ------------------------------------------------------------
-- Fonte: database/migrations/007-self-service-fase2.sql
-- ------------------------------------------------------------
-- ============================================================
-- Zion OS v1.9 — Migração 007: Self-service do cliente (Fase 2)
--
-- INCREMENTAL e reversível. Rode UMA vez no SQL Editor, depois da 006.
--
-- Completa o self-service: o cliente IMPORTA a própria base e AUDITA
-- sozinho. RLS com escrita escopada (cria/edita só os próprios dados);
-- a equipe mantém acesso total (eh_equipe()).
-- ============================================================

-- Produtos e variações: leitura vira escrita completa (o cliente monta a base)
do $$
declare t text;
begin
  foreach t in array array['produtos','produto_variantes'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists "cliente_leitura" on public.%I', t);
      execute format('drop policy if exists "cliente_escopo" on public.%I', t);
      execute format(
        'create policy "cliente_escopo" on public.%I for all to authenticated
           using (cliente_id = public.cliente_do_usuario())
           with check (cliente_id = public.cliente_do_usuario())', t);
    end if;
  end loop;
end $$;

-- Importações e auditorias: cliente cria/lê as próprias (têm cliente_id)
do $$
declare t text;
begin
  foreach t in array array['importacoes_anuncios','auditorias_anuncios'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists "cliente_escopo" on public.%I', t);
      execute format(
        'create policy "cliente_escopo" on public.%I for all to authenticated
           using (cliente_id = public.cliente_do_usuario())
           with check (cliente_id = public.cliente_do_usuario())', t);
    end if;
  end loop;
end $$;

-- Problemas do anúncio: sem cliente_id — escopa pela auditoria pai.
drop policy if exists "cliente_escopo" on public.problemas_anuncio;
create policy "cliente_escopo" on public.problemas_anuncio
  for all to authenticated
  using (auditoria_id in (select id from public.auditorias_anuncios where cliente_id = public.cliente_do_usuario()))
  with check (auditoria_id in (select id from public.auditorias_anuncios where cliente_id = public.cliente_do_usuario()));

-- ------------------------------------------------------------
-- Fonte: database/migrations/008-portal-cliente-leituras.sql
-- ------------------------------------------------------------
-- ============================================================
-- Zion OS v2.0 — Migração 008: leituras do Portal do Cliente
--
-- INCREMENTAL e reversível. Rode UMA vez no SQL Editor, depois da 007.
--
-- O Portal do Cliente (/cliente/*) ganha telas de Pendências e Relatórios.
-- Aqui só liberamos LEITURA escopada (o cliente vê apenas o que é dele);
-- a escrita continua sendo da equipe. eh_equipe()/cliente_do_usuario()
-- já existem desde a 005.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['pendencias','relatorios','tarefas'] loop
    if to_regclass('public.'||t) is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = t and column_name = 'cliente_id'
       ) then
      execute format('drop policy if exists "cliente_leitura" on public.%I', t);
      execute format(
        'create policy "cliente_leitura" on public.%I for select to authenticated
           using (cliente_id = public.cliente_do_usuario())', t);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- Fonte: database/migrations/009-marketplace-ml.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Fonte: database/migrations/010-imagens-storage.sql
-- ------------------------------------------------------------
-- ============================================================
-- Zion OS v2.2 — Migração 010: Imagens no Supabase Storage (Fase 3.1)
--
-- INCREMENTAL. Rode UMA vez no SQL Editor, depois da 009.
--
-- O cliente sobe fotos reais dos produtos (single ou pasta por produto/cor).
-- Bucket público (o ML precisa baixar a imagem por URL); escrita escopada por
-- cliente (pasta = cliente_id) ou equipe.
-- ============================================================

-- 1) Bucket público de imagens de produto.
insert into storage.buckets (id, name, public)
values ('produtos-imagens', 'produtos-imagens', true)
on conflict (id) do nothing;

-- 2) Políticas do Storage (storage.objects).
--    Leitura: pública (o ML e o navegador baixam a imagem).
drop policy if exists "produtos_imagens_leitura" on storage.objects;
create policy "produtos_imagens_leitura" on storage.objects
  for select to public
  using (bucket_id = 'produtos-imagens');

--    Escrita: cliente só na SUA pasta (primeiro segmento = cliente_id), ou equipe.
drop policy if exists "produtos_imagens_escrita" on storage.objects;
create policy "produtos_imagens_escrita" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'produtos-imagens'
    and ((storage.foldername(name))[1] = public.cliente_do_usuario()::text or public.eh_equipe())
  )
  with check (
    bucket_id = 'produtos-imagens'
    and ((storage.foldername(name))[1] = public.cliente_do_usuario()::text or public.eh_equipe())
  );

-- 3) imagens_produto: escopo de escrita do cliente (tem cliente_id).
drop policy if exists "cliente_escopo" on public.imagens_produto;
create policy "cliente_escopo" on public.imagens_produto
  for all to authenticated
  using (cliente_id = public.cliente_do_usuario())
  with check (cliente_id = public.cliente_do_usuario());
