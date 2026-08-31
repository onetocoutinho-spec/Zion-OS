-- 081 — Frete grátis e garantia deixam de ser default da Zion.
--
-- ===========================================================================
-- O QUE A PRIMEIRA DESCRICAO GERADA DIZIA
-- ===========================================================================
--
-- Em 27/08/2026, o primeiro anuncio que a esteira produziu com categoria medida
-- trazia, sem ninguem ter pedido:
--
--     "Frete gratis ja embutido no preco"
--     "Garantia: 90 dias (fornecedor)"
--
-- Nao era invencao do modelo: estava escrito nas regras-mae como
-- "Defaults Zion (usar automatico, NAO e pendencia)". Era regra da era agencia,
-- quando a Zion operava as lojas e conhecia o acordo de cada uma.
--
-- A Zion agencia nao existe mais. Quem assina agora e uma loja que a gente nao
-- conhece — e publicar "frete gratis" e "90 dias" em nome dela e prometer, no
-- anuncio dela, uma condicao que ela pode nao dar. O comprador cobra da loja, e
-- a loja nao escolheu nada.
--
-- ===========================================================================
-- ONDE A ESCOLHA MORA
-- ===========================================================================
--
-- `perfis_de_conteudo` ja guarda COMO A LOJA VENDE — tom, publico, palavras
-- preferidas e proibidas. Promessa comercial e a mesma natureza: e o que o
-- anuncio afirma em nome dela.
--
-- `produtos.vendedor_paga_frete` NAO serve para isto: ele e OBSERVADO do
-- Mercado Livre (`shipping.free_shipping` de um anuncio que ja existe), nao
-- escolhido. Loja nova nao tem anuncio, entao nao tem observacao.
--
-- ===========================================================================
-- NULL E "NAO DECIDIU", E VIRA PERGUNTA
-- ===========================================================================
--
-- Os dois campos nascem NULL de proposito. Nulo aqui nao e "nao da garantia" e
-- nao e "nao da frete gratis": e "ninguem escolheu ainda" — e o agente passa a
-- tratar isso como pendencia, em vez de afirmar por conta propria.
--
-- Silencio virando afirmacao foi exatamente o defeito que esta migracao desfaz.

alter table public.perfis_de_conteudo
  add column if not exists garantia text,
  add column if not exists frete_gratis boolean;

comment on column public.perfis_de_conteudo.garantia is
  'O que a LOJA oferece de garantia, na lingua dela ("90 dias pelo fornecedor", "12 meses pelo fabricante"). NULL = ninguem escolheu, e o anuncio nao pode afirmar nada.';

comment on column public.perfis_de_conteudo.frete_gratis is
  'A loja embute o frete no preco? NULL = ninguem escolheu. Diferente de produtos.vendedor_paga_frete, que e OBSERVADO do Mercado Livre e nao escolhido.';

-- ★ Auto-registro (convencao declarada na 024).
insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('081', '081-frete-e-garantia-sao-escolha-da-loja', now(),
        'perfis_de_conteudo ganha garantia e frete_gratis. As regras-mae afirmavam "frete gratis embutido" e "garantia 90 dias" como default da Zion, e isso saiu na primeira descricao gerada em 27/08/2026 — promessa comercial em nome de uma loja que nao escolheu. Os dois nascem NULL: nulo e "ninguem decidiu", e vira pendencia em vez de afirmacao.')
on conflict (numero) do nothing;
