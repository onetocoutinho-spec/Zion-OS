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
