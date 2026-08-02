-- ============================================================
-- Órfão da família — Papete Modare (MLB4980078561)
-- ============================================================
--
-- ESTADO: EXECUTADO em 02/08/2026, com autorização explícita do autor.
--
-- CONFERIDO ANTES do delete, e este passo faltava no plano original: as 8
-- imagens do duplicado têm URL IDÊNTICA às 8 do produto correto. A cascata não
-- levou nenhuma imagem que só existisse ali.
--
-- RESULTADO MEDIDO:
--
--   Papete Slide Modare 7208.101 Nobuck   16 -> 17 anúncios · 13 variantes · 8 imagens
--   produtos do cliente                   81 -> 80
--   anúncios                                   880  (nenhum perdido)
--   imagens                              661 -> 653  (as 8 do duplicado)
--   linhas órfãs em qualquer tabela                0
--
-- As duas guardas dispararam como esperado: o update casou pelo `ml_item_id` e
-- o delete só agiu depois de o produto ficar sem anúncio e sem variante.
--
-- NÃO é migração: não muda schema. É um conserto de DADOS pontual, num
-- registro só, e por isso vive fora de `database/migrations/`.
--
-- O QUE ACONTECEU
-- ---------------
-- A publicação do Papete Modare (01/08) criou DOIS anúncios no Mercado Livre.
-- O Zion gravava só o primeiro (corrigido no PR #137). O segundo,
-- `MLB4980078561`, ficou órfão, e a importação da noite o trouxe de volta como
-- anúncio NOVO — criando um produto duplicado, porque o `family_name` da nossa
-- própria publicação não bate com o nome do produto de origem:
--
--   aeb0348b  Papete Slide Modare 7208.101 Nobuck              16 anúncios · 13 variantes · 8 imagens
--   31377bf1  Papete Modare Nobuck Feminina Conforto Original   1 anúncio  ·  0 variantes · 8 imagens   ← duplicado
--
-- O anúncio órfão é f6f9bb98, hoje pendurado no duplicado.
--
-- POR QUE ISTO NÃO FOI EXECUTADO SOZINHO
-- --------------------------------------
-- O passo 2 APAGA um produto do catálogo real, e apagar produto leva as 8
-- imagens em cascata. A instrução em vigor é "não altere catálogo real"; a
-- correção do defeito (o código) não precisava disto, então parei aqui.
--
-- COMO REVERTER
-- -------------
-- O passo 1 é reversível pelo valor antigo, que está no comentário. O passo 2
-- NÃO é: um produto apagado não volta. Se houver qualquer dúvida, execute só o
-- passo 1 — ele já tira o anúncio do produto errado, e o duplicado fica
-- vazio e visível, esperando decisão.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- Passo 1 — o anúncio órfão volta para o produto de origem
-- ------------------------------------------------------------
-- REVERTER: update ... set produto_id = '31377bf1-f170-4208-add3-b99ff83e898e'
--           where id = 'f6f9bb98-8540-4876-9969-126865e08739';
update public.anuncios_gerados
   set produto_id  = 'aeb0348b-0d41-4b8f-91d6-e9e3f8c5d6de',
       observacoes = 'Tamanho da família publicada junto com MLB4980127845. Religado ao produto de origem em 02/08/2026.'
 where id = 'f6f9bb98-8540-4876-9969-126865e08739'
   and ml_item_id = 'MLB4980078561';   -- guarda: se o id mudou, não toca em nada

-- ------------------------------------------------------------
-- Passo 2 — o produto duplicado, agora vazio, sai
-- ------------------------------------------------------------
-- A guarda `not exists` é o ponto: se por qualquer motivo ainda houver anúncio
-- apontando para ele, o delete não acontece — em vez de levar dado junto.
delete from public.produtos p
 where p.id = '31377bf1-f170-4208-add3-b99ff83e898e'
   and p.nome = 'Papete Modare Nobuck Feminina Conforto Original'
   and not exists (select 1 from public.anuncios_gerados a where a.produto_id = p.id)
   and not exists (select 1 from public.produto_variantes v where v.produto_id = p.id);

-- ------------------------------------------------------------
-- Confira ANTES de confirmar
-- ------------------------------------------------------------
select p.nome,
       (select count(*) from public.anuncios_gerados a where a.produto_id = p.id) as anuncios,
       (select count(*) from public.produto_variantes v where v.produto_id = p.id) as variantes
  from public.produtos p
 where p.id in ('aeb0348b-0d41-4b8f-91d6-e9e3f8c5d6de', '31377bf1-f170-4208-add3-b99ff83e898e');

-- Esperado: uma linha só, "Papete Slide Modare 7208.101 Nobuck" com 17 anúncios
-- e 13 variantes. Se aparecerem duas, o passo 2 foi barrado pela guarda —
-- e aí NÃO confirme: investigue primeiro.

-- Executado por statement, com verificação entre cada um — não em bloco. O
-- `rollback` de segurança que estava aqui perdeu a função: reexecutar este
-- arquivo hoje não faz nada, porque as duas guardas já não casam.
--
-- REVERTER o passo 1 (o passo 2 NÃO tem volta):
--   update public.anuncios_gerados
--      set produto_id = '31377bf1-f170-4208-add3-b99ff83e898e'
--    where id = 'f6f9bb98-8540-4876-9969-126865e08739';
--   -- e o produto 31377bf1 teria de ser recriado à mão.
