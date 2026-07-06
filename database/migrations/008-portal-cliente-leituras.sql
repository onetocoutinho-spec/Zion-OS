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
