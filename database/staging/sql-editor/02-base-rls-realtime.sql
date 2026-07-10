-- ============================================================
-- Zion OS — STAGING (SQL EDITOR) · 02 · RLS base + Realtime
-- ============================================================
-- ⚠️ RODE SOMENTE no projeto Supabase **zion-os-staging**. NUNCA em produção.
--    Confirme o nome do projeto no topo do painel do Supabase ANTES de rodar.
-- Políticas RLS base (v1.x) e publication supabase_realtime.
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
-- Fonte: database/_legado/supabase-rls.sql
-- ------------------------------------------------------------
-- ============================================================
-- Zion OS v1.2 — Row Level Security
--
-- Rode DEPOIS do supabase-schema.sql, no SQL Editor do Supabase.
--
-- Modelo da v1.2: acesso total para usuários AUTENTICADOS,
-- nada para acesso anônimo. A estrutura está pronta para, na
-- v1.3+, evoluir para permissões por função/equipe/cliente
-- (basta substituir o "using (true)" por regras de negócio).
--
-- IMPORTANTE:
-- * A chave service_role ignora RLS — por isso ela NUNCA pode
--   ir para o navegador. No frontend, use apenas a anon key.
-- ============================================================

-- Ativar RLS em todas as tabelas
alter table public.clientes           enable row level security;
alter table public.onboardings        enable row level security;
alter table public.onboarding_items   enable row level security;
alter table public.produtos           enable row level security;
alter table public.anuncios           enable row level security;
alter table public.agentes            enable row level security;
alter table public.tarefas            enable row level security;
alter table public.relatorios         enable row level security;
alter table public.financeiro         enable row level security;
alter table public.execucoes_agentes  enable row level security;
alter table public.reunioes           enable row level security;
alter table public.pendencias         enable row level security;

-- Políticas: equipe autenticada tem acesso total (v1.2)
create policy "equipe_autenticada" on public.clientes
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.onboardings
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.onboarding_items
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.produtos
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.anuncios
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.agentes
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.tarefas
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.relatorios
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.financeiro
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.execucoes_agentes
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.reunioes
  for all to authenticated using (true) with check (true);
create policy "equipe_autenticada" on public.pendencias
  for all to authenticated using (true) with check (true);

-- ============================================================
-- ⚠️ BLOCO TEMPORÁRIO DE DESENVOLVIMENTO (OPCIONAL) ⚠️
--
-- Desde a v1.3 o Zion OS TEM tela de login (Supabase Auth).
-- O fluxo recomendado é: criar os usuários da equipe no
-- dashboard (Authentication → Users → Add user) e entrar pelo
-- login — sem precisar deste bloco.
--
-- Use as políticas anônimas abaixo SOMENTE se quiser testar o
-- banco sem criar usuários. Remova depois com:
--   drop policy "dev_anon_temporario" on public.<tabela>;
--
-- NÃO use isso em produção com dados reais de clientes.
-- ============================================================

-- create policy "dev_anon_temporario" on public.clientes
--   for all to anon using (true) with check (true);
-- create policy "dev_anon_temporario" on public.onboardings
--   for all to anon using (true) with check (true);
-- create policy "dev_anon_temporario" on public.onboarding_items
--   for all to anon using (true) with check (true);
-- create policy "dev_anon_temporario" on public.produtos
--   for all to anon using (true) with check (true);
-- create policy "dev_anon_temporario" on public.anuncios
--   for all to anon using (true) with check (true);
-- create policy "dev_anon_temporario" on public.agentes
--   for all to anon using (true) with check (true);
-- create policy "dev_anon_temporario" on public.tarefas
--   for all to anon using (true) with check (true);
-- create policy "dev_anon_temporario" on public.relatorios
--   for all to anon using (true) with check (true);
-- create policy "dev_anon_temporario" on public.financeiro
--   for all to anon using (true) with check (true);
-- create policy "dev_anon_temporario" on public.execucoes_agentes
--   for all to anon using (true) with check (true);
-- create policy "dev_anon_temporario" on public.reunioes
--   for all to anon using (true) with check (true);
-- create policy "dev_anon_temporario" on public.pendencias
--   for all to anon using (true) with check (true);

-- ------------------------------------------------------------
-- Fonte: database/_legado/supabase-realtime.sql
-- ------------------------------------------------------------
-- ============================================================
-- Zion OS v1.3 — Realtime
--
-- Adiciona as tabelas à publication do Supabase Realtime para
-- que as telas abertas atualizem automaticamente quando outra
-- pessoa da equipe criar/editar/excluir registros.
--
-- Rode UMA vez no SQL Editor, depois do supabase-schema.sql.
-- (Se rodar duas vezes, o Postgres acusa que a tabela já está
-- na publication — é inofensivo.)
-- ============================================================

alter publication supabase_realtime add table
  public.clientes,
  public.onboardings,
  public.onboarding_items,
  public.produtos,
  public.anuncios,
  public.agentes,
  public.tarefas,
  public.relatorios,
  public.financeiro,
  public.execucoes_agentes,
  public.reunioes,
  public.pendencias;
