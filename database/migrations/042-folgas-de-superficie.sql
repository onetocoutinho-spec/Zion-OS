-- ============================================================
-- Zion OS — Migração 042: fecha as folgas de superfície (DB-FIX-005)
--
-- INCREMENTAL. NÃO destrutiva de dados. Mexe em GRANT e em política de storage.
--
-- ============================================================
-- O QUE SÃO
-- ============================================================
--
-- Três achados do advisor de segurança do Supabase, todos anteriores ao Copilot e
-- nenhum criado pelas migrações 035–041. Nenhum deles é vazamento hoje; os três
-- são superfície a mais do que a necessária — o tipo de folga que só vira
-- problema quando outra coisa dá errado ao lado.
--
-- ============================================================
-- 1) `set_updated_at` com search_path mutável
-- ============================================================
--
-- É uma função de TRIGGER, e trigger roda com o `search_path` de quem disparou a
-- escrita. Sem `search_path` fixo, quem controla o caminho de busca controla qual
-- objeto a função enxerga. A função é trivial (`new.updated_at = now()`), então o
-- risco prático hoje é pequeno — mas fixar custa uma linha e remove a categoria
-- inteira do problema.
--
-- `pg_temp` vai por último de propósito: é a recomendação padrão para que um
-- objeto temporário criado por um chamador não se anteponha ao esquema real.
--
-- ============================================================
-- 2) Sete funções SECURITY DEFINER executáveis por `anon`
-- ============================================================
--
-- `SECURITY DEFINER` roda com os privilégios de quem a criou. Executável por
-- `anon` significa alcançável por `/rest/v1/rpc/<nome>` SEM sessão nenhuma.
--
-- Duas delas ESCREVEM: `portal_definir_custos_do_lojista` e
-- `portal_definir_margem_minima`.
--
-- Por que o efeito prático era nulo: todas se escopam por
-- `cliente_do_usuario()`, que devolve `null` sem sessão, e `where cliente_id =
-- null` não casa com linha nenhuma. A proteção existia — mas dependia de uma
-- propriedade de outra função, e não do privilégio. Privilégio é a camada certa.
--
-- CONFERIDO ANTES DE REVOGAR: o código anterior ao login toca apenas
-- `auth.signUp`, `auth.signInWithPassword`, `auth.updateUser` e
-- `auth.getSession` (`AuthGate.tsx`, `definir-senha/page.tsx`). Nenhuma chamada a
-- `.rpc()` acontece sem sessão.
--
-- Revogamos de `public` E de `anon`: cinco das sete tinham o EXECUTE implícito de
-- `PUBLIC` (`=X/postgres` na ACL) além do explícito de `anon`. Revogar só de
-- `anon` deixaria a porta aberta pela herança de `PUBLIC` — e a migração
-- pareceria ter funcionado.
--
-- ============================================================
-- 3) Bucket público `produtos-imagens` permite listar tudo
-- ============================================================
--
-- A política `produtos_imagens_leitura` dá SELECT em `storage.objects` para
-- `public`, com `bucket_id = 'produtos-imagens'` como única condição. Isso não
-- serve para ver imagem — serve para LISTAR o bucket inteiro, de todos os
-- lojistas.
--
-- O bucket é público (`storage.buckets.public = true`), e leitura por URL pública
-- (`/object/public/...`) NÃO passa por RLS. Conferido no código: todo o uso de
-- storage é `upload` e `getPublicUrl` — não existe `.list()` nem `.download()` em
-- lugar nenhum.
--
-- Quem continua lendo pelo caminho autenticado: `produtos_imagens_escrita`, que é
-- `for ALL` (e portanto inclui SELECT) escopada à pasta do próprio tenant ou à
-- equipe. Ou seja, o SELECT certo já existe; só o aberto sai.
--
-- REVERSÃO, se alguma tela quebrar:
--   create policy produtos_imagens_leitura on storage.objects
--     for select using (bucket_id = 'produtos-imagens');
--
-- ============================================================
-- 4) O que esta migração NÃO resolve
-- ============================================================
--
-- A proteção contra senha vazada (HaveIBeenPwned) do Supabase Auth está
-- DESLIGADA. É configuração de Auth, não objeto de banco: não há SQL que a ligue.
-- Tem que ser no painel — Authentication > Policies > Password protection.
-- Fica registrado aqui porque o advisor a reporta junto, e porque um item que
-- some da lista sem ter sido resolvido é pior que um item aberto.
-- ============================================================

-- ---------- 1) search_path fixo ----------

alter function public.set_updated_at() set search_path = public, pg_temp;

-- ---------- 2) tirar o alcance anônimo ----------

revoke execute on function public.cliente_do_usuario()            from public, anon;
revoke execute on function public.eh_equipe()                     from public, anon;
revoke execute on function public.quota_esteira()                 from public, anon;
revoke execute on function public.portal_custos_do_lojista()      from public, anon;
revoke execute on function public.portal_margem_minima()          from public, anon;
revoke execute on function public.portal_definir_margem_minima(numeric) from public, anon;
revoke execute on function public.portal_definir_custos_do_lojista(numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon;

-- `authenticated` e `service_role` continuam com EXECUTE. Reafirmado aqui e não
-- deixado por herança: se um `revoke ... from public` amanhã pegar mais do que se
-- espera, o grant explícito é o que sustenta o portal de pé.
grant execute on function public.cliente_do_usuario()             to authenticated, service_role;
grant execute on function public.eh_equipe()                      to authenticated, service_role;
grant execute on function public.quota_esteira()                  to authenticated, service_role;
grant execute on function public.portal_custos_do_lojista()       to authenticated, service_role;
grant execute on function public.portal_margem_minima()           to authenticated, service_role;
grant execute on function public.portal_definir_margem_minima(numeric) to authenticated, service_role;
grant execute on function public.portal_definir_custos_do_lojista(numeric, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated, service_role;

-- ---------- 3) o bucket deixa de ser listável ----------

drop policy if exists "produtos_imagens_leitura" on storage.objects;

-- ---------- a prova ----------
--
-- Mesmo padrão da 041: a migração confere o próprio efeito e ABORTA se não bater.

do $$
declare
  com_anon int;
  lista_aberta int;
  sem_search_path int;
begin
  select count(*) into com_anon
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('cliente_do_usuario','eh_equipe','quota_esteira',
                       'portal_custos_do_lojista','portal_margem_minima',
                       'portal_definir_margem_minima','portal_definir_custos_do_lojista')
     and (has_function_privilege('anon', p.oid, 'EXECUTE'));

  if com_anon > 0 then
    raise exception
      'MIGRACAO 042 INCOMPLETA: % funcao(oes) SECURITY DEFINER ainda executaveis por anon.', com_anon;
  end if;

  select count(*) into lista_aberta
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'produtos_imagens_leitura';

  if lista_aberta > 0 then
    raise exception 'MIGRACAO 042 INCOMPLETA: o bucket ainda tem politica de listagem aberta.';
  end if;

  select count(*) into sem_search_path
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'set_updated_at'
     and (p.proconfig is null or not exists (
       select 1 from unnest(p.proconfig) c where c like 'search_path=%'));

  if sem_search_path > 0 then
    raise exception 'MIGRACAO 042 INCOMPLETA: set_updated_at continua com search_path mutavel.';
  end if;

  -- O que PRECISA continuar funcionando. Uma migração de endurecimento que não
  -- confere o que preservou é uma tela quebrada esperando para ser descoberta.
  if not has_function_privilege('authenticated', 'public.cliente_do_usuario()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.portal_margem_minima()', 'EXECUTE') then
    raise exception 'MIGRACAO 042 QUEBROU O PORTAL: authenticated perdeu EXECUTE.';
  end if;

  raise notice '042 conferida: anon sem EXECUTE, bucket nao listavel, search_path fixo, authenticated intacto.';
end $$;

-- ============================================================
-- Conferência manual
-- ============================================================
-- select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_executa
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname='public' and p.prosecdef order by 1;
-- Esperado: anon_executa = false em todas.
--
-- select policyname from pg_policies where schemaname='storage' and tablename='objects';
-- Esperado: só produtos_imagens_escrita.
--
-- Depois de aplicar, ABRA O PORTAL e confira que as imagens dos produtos
-- aparecem. É leitura por URL pública e não deve ser afetada — mas "não deve ser"
-- é hipótese até alguém olhar.
