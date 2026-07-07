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
