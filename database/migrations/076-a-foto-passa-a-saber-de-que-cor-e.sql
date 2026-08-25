-- A FOTO PASSA A SABER DE QUE COR ELA É.
--
-- ===========================================================================
-- POR QUE — medido em 12/08/2026
-- ===========================================================================
--
-- Os anúncios desta lojista são UM POR COR E TAMANHO: "Chinelo Havaianas Top
-- Liso Amarelo 33-34", "... Azul 33-34". São 460 anúncios para 80 produtos.
--
-- As 651 fotos do cadastro estão ligadas ao PRODUTO e a nada mais. Mandar a
-- foto do produto para os anúncios dele colocaria chinelo amarelo no anúncio
-- azul — que não é uma melhora do problema atual, é uma infração PIOR: o ML
-- chama isso de "o anúncio não corresponde ao produto", e essa categoria
-- (DOMAIN) é a que ele já usou para PAUSAR 25 anúncios desta conta.
--
-- Sem cor na foto, a última perna do conserto não pode existir.
--
-- ===========================================================================
-- É A STRING DA VARIANTE, NÃO UMA TAXONOMIA NOVA
-- ===========================================================================
--
-- As cores reais da base são texto livre com variedade legítima: `Preto`
-- (282 variantes), `Branco` (99), `Azul-marinho`, `Preto/Branco`,
-- `Preto/Camel`. Inventar uma tabela de cores canônicas criaria uma segunda
-- verdade que divergiria da primeira no dia seguinte.
--
-- Então a coluna guarda a MESMA string que `produto_variantes.cor` — quem
-- preenche escolhe da lista do produto, não digita. O casamento é por
-- igualdade normalizada (caixa e acento), não por adivinhação.
--
-- ===========================================================================
-- NULO É "NÃO SABEMOS", NUNCA "SERVE PARA TODAS"
-- ===========================================================================
--
-- As 651 fotos existentes nascem NULL. Elas vieram da importação do ML, que
-- não trouxe vínculo com anúncio nem com cor — e tratar isso como "vale para
-- qualquer cor" seria exatamente o erro que esta migração existe para
-- impedir. Foto sem cor não é candidata a capa de anúncio colorido.

alter table public.imagens_produto
  add column if not exists cor text;

comment on column public.imagens_produto.cor is
  'A cor desta foto, na MESMA string de produto_variantes.cor. NULL = não sabemos de que cor é — nunca "serve para todas". Migração 060.';

-- String vazia é a ausência disfarçada: passa por preenchida em toda checagem
-- por `is not null` e não casa com variante nenhuma.
alter table public.imagens_produto
  drop constraint if exists imagens_produto_cor_nao_vazia;
alter table public.imagens_produto
  add constraint imagens_produto_cor_nao_vazia
  check (cor is null or length(btrim(cor)) > 0);

-- Buscar "as fotos desta cor deste produto" é a consulta que a última perna do
-- conserto faz por anúncio. Parcial porque a esmagadora maioria das linhas é
-- nula hoje e não interessa a essa pergunta.
create index if not exists imagens_produto_produto_cor_idx
  on public.imagens_produto (produto_id, cor)
  where cor is not null;
