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
