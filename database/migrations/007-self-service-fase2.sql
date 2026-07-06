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
