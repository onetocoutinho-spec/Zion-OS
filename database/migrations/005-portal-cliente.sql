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
