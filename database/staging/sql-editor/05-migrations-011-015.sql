-- ============================================================
-- Zion OS — STAGING (SQL EDITOR) · 05 · Migrações 011–015
-- ============================================================
-- ⚠️ RODE SOMENTE no projeto Supabase **zion-os-staging**. NUNCA em produção.
--    Confirme o nome do projeto no topo do painel do Supabase ANTES de rodar.
-- Canal do cliente, fila de otimização, tabelas de medidas, kit/componentes.
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
-- Fonte: database/migrations/011-canal-cliente-conecta.sql
-- ------------------------------------------------------------
-- ============================================================
-- Zion OS v2.3 — Migração 011: cliente conecta o próprio canal (OAuth ML)
--
-- INCREMENTAL. Rode UMA vez no SQL Editor, depois da 010.
--
-- O cliente autoriza a PRÓPRIA conta do Mercado Livre pelo portal, então
-- precisa criar/atualizar o próprio registro em canais_marketplace. A equipe
-- mantém acesso total (equipe_total, migração 009). O refresh_token que fica
-- na linha é o token da conta DO PRÓPRIO cliente.
-- ============================================================

drop policy if exists "cliente_escopo" on public.canais_marketplace;
create policy "cliente_escopo" on public.canais_marketplace
  for all to authenticated
  using (cliente_id = public.cliente_do_usuario())
  with check (cliente_id = public.cliente_do_usuario());

-- ------------------------------------------------------------
-- Fonte: database/migrations/012-fila-otimizacao-produto.sql
-- ------------------------------------------------------------
-- ============================================================
-- Zion OS — Migração 012: Fila de otimização por produto
--
-- INCREMENTAL. Rode UMA vez no SQL Editor, depois da 011.
--
-- Fila para o "Otimizar tudo" rodar no SERVIDOR (worker + Vercel Cron), sem
-- depender da aba aberta. O cliente enfileira os produtos; o worker consome
-- (service_role, ignora RLS) rodando a esteira e gravando os anúncios.
-- ============================================================

create table if not exists public.fila_otimizacao_produto (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  -- pendente | processando | concluido | erro
  status text not null default 'pendente',
  tentativas integer not null default 0,
  erro text default '',
  anuncio_id uuid references public.anuncios_gerados (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (produto_id) -- 1 item de fila por produto (reenfileirar atualiza)
);
create index if not exists idx_fila_op_status on public.fila_otimizacao_produto (status);
create index if not exists idx_fila_op_cliente on public.fila_otimizacao_produto (cliente_id);
create trigger trg_fila_op_updated_at
  before update on public.fila_otimizacao_produto
  for each row execute function public.set_updated_at();

-- RLS: o cliente enfileira e lê o status da PRÓPRIA fila; a equipe vê tudo.
-- (O worker usa a chave service_role e ignora a RLS.)
alter table public.fila_otimizacao_produto enable row level security;
drop policy if exists "cliente_escopo" on public.fila_otimizacao_produto;
create policy "cliente_escopo" on public.fila_otimizacao_produto
  for all to authenticated
  using (cliente_id = public.cliente_do_usuario() or public.eh_equipe())
  with check (cliente_id = public.cliente_do_usuario() or public.eh_equipe());

-- ------------------------------------------------------------
-- Fonte: database/migrations/013-tabela-medidas-produto.sql
-- ------------------------------------------------------------
-- ============================================================
-- Zion OS — Migração 013: Override da tabela de medidas por produto
--
-- INCREMENTAL. Rode UMA vez no SQL Editor, depois da 012.
--
-- A tabela de medidas (numeração → comprimento do pé) é, por padrão, por
-- MARCA (arquivo src/lib/data/tabelasMedidas.ts). Esta coluna guarda um
-- OVERRIDE por produto — só quando o produto foge do padrão da marca.
-- ============================================================

alter table public.produtos
  add column if not exists tabela_medidas text default '';

-- ------------------------------------------------------------
-- Fonte: database/migrations/014-tabelas-medidas-cliente.sql
-- ------------------------------------------------------------
-- ============================================================
-- Zion OS — Migração 014: Tabelas de medidas gerenciáveis por cliente
--
-- INCREMENTAL. Rode UMA vez no SQL Editor, depois da 013.
--
-- Cada cliente cria suas próprias tabelas de medidas (calçado, roupa P/M/G,
-- etc.). Quando `marca` está preenchida, a tabela aplica a TODOS os produtos
-- daquela marca (massa). O override por produto (produtos.tabela_medidas)
-- continua tendo prioridade sobre esta.
-- ============================================================

create table if not exists public.tabelas_medidas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null default '',
  -- Quando preenchida, a tabela vale para todos os produtos desta marca.
  marca text default '',
  como_medir text default '',
  -- Linhas: [{ "rotulo": "37/38", "valor": "24,5 cm" }, ...]
  linhas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tabmed_cliente on public.tabelas_medidas (cliente_id);
create index if not exists idx_tabmed_marca on public.tabelas_medidas (cliente_id, marca);
create trigger trg_tabmed_updated_at
  before update on public.tabelas_medidas
  for each row execute function public.set_updated_at();

alter table public.tabelas_medidas enable row level security;
drop policy if exists "cliente_escopo" on public.tabelas_medidas;
create policy "cliente_escopo" on public.tabelas_medidas
  for all to authenticated
  using (cliente_id = public.cliente_do_usuario() or public.eh_equipe())
  with check (cliente_id = public.cliente_do_usuario() or public.eh_equipe());

-- ------------------------------------------------------------
-- Fonte: database/migrations/015-kit-componentes.sql
-- ------------------------------------------------------------
-- ============================================================
-- Zion OS — Migração 015: Composição de kit/combo por produto
--
-- INCREMENTAL. Rode UMA vez no SQL Editor, depois da 014.
--
-- Um produto do tipo "kit"/"combo" carrega seus COMPONENTES (jsonb). Cobre
-- todos os casos: N unidades do mesmo produto, produtos diferentes juntos,
-- grade fechada e combo/brinde. O preço do kit é o próprio produto.preco_venda.
--
-- componentes = [{ "produtoId": "...", "nome": "...", "sku": "...",
--                  "quantidade": 3, "brinde": false }]
-- ============================================================

alter table public.produtos
  add column if not exists componentes jsonb not null default '[]'::jsonb;
