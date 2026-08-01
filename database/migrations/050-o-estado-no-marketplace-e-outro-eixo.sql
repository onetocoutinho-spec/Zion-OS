-- ============================================================
-- 050 — `anuncios_gerados` ganha o estado NO MARKETPLACE
-- ============================================================
--
-- O DEFEITO
-- ---------
-- `status` de `anuncios_gerados` é o eixo da ESTEIRA do Zion:
--
--   rascunho → aguardando_aprovacao → aprovado → rejeitado → publicado
--
-- O importador do Mercado Livre gravava `status = 'publicado'` FIXO em todo
-- anúncio que trazia, qualquer que fosse o estado real dele no ML.
--
-- Medido em 2026-08-01, com a leitura completa da conta da Chinelaria (781
-- anúncios, depois que o teto mudo de 500 caiu):
--
--     No ML (781)          já no Zion      faltando
--     546 active              398             148
--     155 under_review         52             103
--      66 paused               38              28
--      12 closed               12               0
--       2 inactive              2               0
--                             ───             ───
--                             502             279
--
-- Ou seja: dos 511 anúncios que o Zion diz `publicado`, **104 não estão no ar**
-- — 52 em revisão, 38 pausados, 12 encerrados, 2 inativos. E importar os 279 que
-- faltam somaria outros 131 rótulos falsos.
--
-- POR QUE UMA COLUNA, E NÃO MAIS VALORES EM `status`
-- --------------------------------------------------
-- São dois eixos independentes, não dois valores do mesmo eixo. Um anúncio pode
-- estar `publicado` pela esteira do Zion E `paused` no ML ao mesmo tempo — as
-- duas afirmações são verdadeiras e nenhuma substitui a outra.
--
-- Empilhar `pausado` dentro de `status` obrigaria a esquecer que o Zion publicou
-- para lembrar que o ML pausou. E quebraria os 10 lugares que hoje comparam com
-- `'publicado'` de um jeito que nenhum deles pediu.
--
-- O eixo do marketplace volta em preço, em estoque e em pausar anúncio. Os três
-- precisam saber se está no ar, e nenhum deveria perguntar isso à coluna da
-- esteira.
--
-- O VALOR É O DO MARKETPLACE, VERBATIM
-- ------------------------------------
-- Guardamos `active`, `paused`, `under_review`, `closed`, `inactive` — a palavra
-- do ML, sem tradução. Normalizar exigiria um mapa nosso, e no dia em que o ML
-- criar um estado novo o mapa o engoliria em silêncio. A tradução para a lojista
-- acontece na tela, onde errar é visível.
--
-- A coluna `marketplace` já existe nesta tabela, então o par
-- (marketplace, status_marketplace) é sempre não-ambíguo — o TikTok pode ter
-- vocabulário próprio sem colidir com o do ML.
--
-- POR QUE `status_marketplace_em` VEM JUNTO
-- ----------------------------------------
-- Um estado sem data parece atual e não é. "paused" lido há três semanas é um
-- palpite vestido de fato — exatamente a classe de mentira que esta migração
-- existe para acabar. Com a data, quem lê sabe de quando é.
--
-- NULL SIGNIFICA "NÃO SABEMOS"
-- ----------------------------
-- As duas colunas são NULLABLE, e ficam nulas nas 90 linhas que nunca foram a
-- marketplace nenhum (80 rascunhos, 9 rejeitados, 1 aprovado).
--
-- E ficam nulas TAMBÉM nas 511 linhas já importadas: nós não sabemos o estado
-- delas hoje, sabemos o que a leitura de agora diz — e são coisas diferentes.
-- Backfill com `'active'` fabricaria origem para dado histórico, que é
-- justamente o que não se faz aqui. A próxima importação preenche o que ela
-- própria observar.
--
-- SEM DEFAULT, DE PROPÓSITO
-- -------------------------
-- Um `default 'active'` faria toda linha nova nascer afirmando que está no ar.
-- Ausência tem que continuar significando ausência.
-- ============================================================

alter table public.anuncios_gerados
  add column if not exists status_marketplace text;

alter table public.anuncios_gerados
  add column if not exists status_marketplace_em timestamptz;

-- Consultar "o que está realmente no ar deste cliente" é a pergunta que motivou
-- a coluna. O índice parcial cobre só as linhas que têm resposta.
create index if not exists idx_anuncios_gerados_status_marketplace
  on public.anuncios_gerados (cliente_id, status_marketplace)
  where status_marketplace is not null;

-- RLS: NADA a fazer. A tabela já tem as políticas, e coluna nova herda a linha.
-- Registrado aqui porque "não mexi" é uma afirmação, não um esquecimento.

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('050', '050-o-estado-no-marketplace-e-outro-eixo', now(),
        'anuncios_gerados ganha status_marketplace + status_marketplace_em (nullable, sem default, sem backfill). O estado no ML e outro eixo que o status da esteira: medido em 2026-08-01, 104 dos 511 publicado nao estavam no ar. RLS intocada.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   drop index if exists idx_anuncios_gerados_status_marketplace;
--   alter table public.anuncios_gerados drop column if exists status_marketplace_em;
--   alter table public.anuncios_gerados drop column if exists status_marketplace;
--
-- Reverter também `AnuncioGeradoRegistro`, o mapeamento do repositório e o
-- importador (que voltaria a gravar só o eixo da esteira).
-- ============================================================
