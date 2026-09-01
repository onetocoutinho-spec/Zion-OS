-- 079 — A categoria do Mercado Livre decidida por produto.
--
-- ===========================================================================
-- O QUE FALTAVA
-- ===========================================================================
--
-- O sistema tem tres lugares onde uma categoria aparece, e nenhum guarda a
-- categoria DECIDIDA de um produto que ainda nao publicou:
--
--   produtos.categoria                       a arvore interna da loja
--   produtos.categoria_marketplace_sugerida  texto livre digitado por gente
--                                            ("cama box", "Camas") — nao e id
--   anuncios_gerados.categoria_ml            o id que o ML devolveu NA IMPORTACAO
--                                            de um anuncio que ja existe
--
-- Produto importado de planilha nunca esteve no ar, entao nao tem linha em
-- anuncios_gerados — e cai no palpite de calcado. Medido em 26/08/2026 numa
-- base real: 1003 de 1003 produtos entravam assim na esteira, e 50 deles sao
-- bolsa, meia ou kit.
--
-- ===========================================================================
-- POR QUE UMA COLUNA NOVA, E NAO REUSAR A DE TEXTO
-- ===========================================================================
--
-- `categoria_marketplace_sugerida` e rotulo humano; esta e id do ML. Guardar os
-- dois no mesmo campo faria toda leitura ter que adivinhar qual dos dois esta
-- ali — e "MLB273770" e "Sandalias e Chinelos" nao sao a mesma informacao: uma
-- publica, a outra explica.
--
-- Fica NULL por padrao, e NULL continua querendo dizer "ninguem decidiu ainda",
-- que e o que o resto do sistema ja trata como pergunta.

alter table public.produtos
  add column if not exists categoria_ml text;

comment on column public.produtos.categoria_ml is
  'Id da categoria do Mercado Livre DECIDIDA para este produto (ex.: MLB273770). NULL = ninguem decidiu ainda. Diferente de categoria_marketplace_sugerida, que e rotulo em texto livre.';

-- Indice parcial: as leituras perguntam "quais produtos ainda nao tem
-- categoria" e "qual e a deste produto". So as linhas decididas entram.
create index if not exists idx_produtos_categoria_ml
  on public.produtos (cliente_id, categoria_ml)
  where categoria_ml is not null;

-- ★ Auto-registro (convencao declarada na 024).
insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('079', '079-a-categoria-decidida-ganha-onde-morar', now(),
        'Coluna produtos.categoria_ml: o id da categoria do ML decidida para o produto, que ate aqui so existia para quem ja tinha anuncio no ar (anuncios_gerados.categoria_ml). Sem ela, produto vindo de planilha entrava na esteira com a lista de obrigatorios de CALCADO por suposicao — 1003 de 1003 numa base real medida em 26/08/2026.')
on conflict (numero) do nothing;
