-- 059 — a credencial do Mercado Livre sai do alcance do navegador
--
-- Findings: ZION-AGENCY-001 (P0) e ZION-SECRET-001 (P1), auditoria de 2026-08-21.
--
-- ============================================================
-- O QUE HAVIA
-- ============================================================
--
-- `canais_marketplace.refresh_token` é o token OAuth de vida longa da conta
-- do lojista no Mercado Livre. Quem o tem renova access_tokens e opera a conta
-- FORA do Zion OS, sem trilha aqui, e continua podendo depois que a relação
-- com a agência acabar. É o ativo de maior valor desta base depois da
-- service_role — e estava em texto puro, legível por duas vias:
--
--   1. `agencia_escopo` (054). O laço da 054 criou a política em TODA tabela
--      com `cliente_id` e RLS, exceto `perfis`. `canais_marketplace` entrou
--      porque tem a forma — mas não é operação da loja, é credencial dela.
--      A 055a (financeiro) e a 055b (tarefas, reunioes) já aplicaram este
--      mesmo critério; esta tabela não foi revisada na mesma passada.
--      Efeito: uma sessão de agência, direto no PostgREST com a anon key,
--      lia e REESCREVIA o refresh_token de cada loja que opera.
--
--   2. `cliente_escopo` (011), `for all`. A sessão do próprio lojista lia a
--      coluna do navegador. A rota /api/ml/conectar prometia "o refresh_token
--      NUNCA é devolvido ao navegador" — e de fato não devolvia; mas o RLS
--      deixava o navegador buscá-lo sozinho. Um XSS, uma extensão, um script
--      no console: a garantia não se sustentava no nível do dado.
--
-- ============================================================
-- O QUE MUDA
-- ============================================================
--
-- Duas camadas, porque atacam problemas diferentes:
--
--   A) DROP de `agencia_escopo` em `canais_marketplace`. A agência publica
--      pelas rotas /api/ml/*, que leem o canal no SERVIDOR depois de
--      `exigirAcessoAoCliente`. Nenhuma tela precisa que o navegador dela
--      alcance a linha. Mesmo critério da 055a/055b.
--
--   B) REVOKE da COLUNA `refresh_token` para `authenticated`. RLS decide a
--      linha; GRANT por coluna decide o campo. Depois disto NENHUMA sessão de
--      navegador — lojista, agência ou equipe — lê ou escreve o token. Só
--      `service_role`, que é o que as rotas de servidor passam a usar.
--
--      Conferido no código antes de revogar (cada leitor, um a um):
--        · src/lib/services/canaisMarketplace.ts (navegador) já seleciona
--          COLUNAS_PUBLICAS sem o token. Sobrevive.
--        · O "desconectar" do portal gravava `refresh_token = null` do
--          navegador. Passa a ir por /api/ml/desconectar (service_role).
--        · src/modules/integration/infrastructure/canalServidor.ts é chamado
--          pelas rotas /api/ml/* com `ctx.supabase` (papel authenticated).
--          Todas migram para o cliente admin no mesmo commit — sem isso,
--          publicar quebraria. Aplicar esta migração ANTES do deploy do
--          código quebra a publicação; DEPOIS, não.
--
-- ============================================================
-- O QUE ESTA MIGRAÇÃO NÃO FAZ
-- ============================================================
--
-- NÃO cifra o token em repouso. É o passo seguinte (Vault/pgcrypto), e é
-- outra decisão com outro raio de impacto. Esta fecha a exposição; aquela
-- reduz o dano de um dump do banco.
--
-- NÃO mexe em `cliente_escopo` nem em `equipe_total`: as linhas continuam
-- visíveis para status/config (`ativo`, `tipo_anuncio`, `seller_id`). Só a
-- coluna da credencial fecha.
-- ============================================================

drop policy if exists agencia_escopo on public.canais_marketplace;

-- O REVOKE de coluna só vale se o grant de tabela inteira não o sobrepuser.
-- No Supabase, `authenticated` tem GRANT ALL na tabela (padrão), e REVOKE de
-- coluna sobre um GRANT de tabela é ignorado pelo PostgreSQL. Então: revoga
-- tudo da tabela e devolve, explicitamente, tudo MENOS a coluna.
revoke all on table public.canais_marketplace from authenticated;
grant select (id, cliente_id, marketplace, seller_id, tipo_anuncio, ativo, atualizado_em)
  on table public.canais_marketplace to authenticated;
grant insert (id, cliente_id, marketplace, seller_id, tipo_anuncio, ativo, atualizado_em)
  on table public.canais_marketplace to authenticated;
grant update (seller_id, tipo_anuncio, ativo, atualizado_em)
  on table public.canais_marketplace to authenticated;
grant delete on table public.canais_marketplace to authenticated;

-- anon nunca precisou de nada aqui. A 041 registrou que não mexia nos
-- grants de anon por ser "outra decisão"; nesta tabela a decisão é óbvia.
revoke all on table public.canais_marketplace from anon;

-- ---------- a prova, no padrão da 041: alega e confere, ou aborta ----------

do $$
declare
  pol int;
  col int;
begin
  select count(*) into pol
    from pg_policies
   where schemaname = 'public'
     and tablename = 'canais_marketplace'
     and policyname = 'agencia_escopo';
  if pol > 0 then
    raise exception 'MIGRACAO 059 INCOMPLETA: agencia_escopo ainda existe em canais_marketplace.';
  end if;

  -- authenticated NÃO pode ter privilégio de coluna em refresh_token, nem de
  -- tabela inteira (que implicaria a coluna).
  select count(*) into col
    from information_schema.column_privileges
   where table_schema = 'public'
     and table_name = 'canais_marketplace'
     and column_name = 'refresh_token'
     and grantee = 'authenticated';
  if col > 0 then
    raise exception 'MIGRACAO 059 INCOMPLETA: authenticated ainda alcanca refresh_token.';
  end if;

  raise notice '059 conferida: sem agencia_escopo; refresh_token fora do alcance de authenticated.';
end $$;

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('059', '059-a-credencial-do-ml-sai-do-alcance-do-navegador', now(),
        'ZION-AGENCY-001 + ZION-SECRET-001. DROP de agencia_escopo em canais_marketplace (o laco da 054 incluiu uma tabela de credencial por ter a forma de tabela de operacao — mesmo criterio da 055a/055b). REVOKE da coluna refresh_token para authenticated e anon, via revoke-tabela + grant por coluna (REVOKE de coluna sobre GRANT de tabela e ignorado pelo Postgres). O token passa a ser lido e escrito so por service_role, nas rotas /api/ml/* e /api/assistente. Requer o deploy do codigo que troca ctx.supabase pelo cliente admin em canalServidor; aplicar antes do deploy quebra a publicacao.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   grant all on table public.canais_marketplace to authenticated;
--   create policy agencia_escopo on public.canais_marketplace for all
--     using (cliente_id in (select public.lojas_da_agencia()))
--     with check (cliente_id in (select public.lojas_da_agencia()));
--
-- Só faz sentido se a decisão for que o navegador deve carregar a credencial
-- da conta do ML. Não há caso de uso hoje que exija isso.
-- ============================================================
