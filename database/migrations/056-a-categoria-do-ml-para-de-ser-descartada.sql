-- 056 — a categoria do Mercado Livre passa a ser guardada
--
-- ============================================================
-- O QUE FOI MEDIDO EM 10/08/2026, NA CONTA DA LOJISTA
-- ============================================================
--
-- A precificação inteira do Zion roda com a comissão da TABELA, e não com a
-- da conta. Não por escolha: `/sites/MLB/listing_prices` exige `category_id`, e
-- ninguém tinha o campo para passar.
--
--     POST /api/ml/custos  sem categoria  ->  tarifa: null
--     POST /api/ml/custos  com categoria  ->  tarifa: { percentual, taxaFixa }
--
-- E a tabela ERRA, medido nos anúncios dela:
--
--     Bolsa Moleca   categoria MLB7022     comissão real 15%
--     Calçados       categoria MLB273770   comissão real 19%
--
-- `TAXAS_PADRAO` aplica 19% (Premium, Moda) em TUDO. Nas bolsas são quatro
-- pontos a mais do que o ML cobra — e o erro tem direção: comissão inflada faz
-- a margem parecer pior do que é e o "preço ideal" sair mais alto do que
-- precisa. Ela deixa de vender por um custo que não existe.
--
-- ============================================================
-- O DADO JÁ PASSAVA POR NÓS
-- ============================================================
--
-- `mercadolivre.ts` lê `categoria: it.category_id ?? ""` em TODA leitura de
-- anúncio, e usa isso só para descobrir os atributos que a categoria exige.
-- Depois disso o campo era jogado fora — o mesmo padrão que este mês já
-- descartou o `sub_status`, o tamanho da capa e o estoque do marketplace, e que
-- a migração 051 corrigiu para aqueles três.
--
-- Não é leitura nova. É parar de descartar a que já é feita.
--
-- ============================================================
-- POR QUE EM `anuncios_gerados` E NÃO EM `produtos`
-- ============================================================
--
-- A categoria é do ANÚNCIO, não do produto. O mesmo sapato pode estar
-- publicado em duas categorias, e é a categoria do item que decide a tarifa
-- que o ML cobra naquela venda.
--
-- `produtos.categoria_marketplace_sugerida` existe e está VAZIA nos 80 — ela é
-- outra coisa: o palpite de onde publicar, não onde está publicado.
--
-- ============================================================
-- NULL SIGNIFICA "NÃO SABEMOS"
-- ============================================================
--
-- Sem default. Anúncio nunca lido fica `null`, e quem for calcular preço
-- precisa tratar isso como ausência — caindo na tabela e DIZENDO que caiu, que
-- é o que a `procedencia` já faz. Um default de "MLB273770" transformaria
-- ausência em afirmação, e seria o defeito mudo de sempre.

alter table public.anuncios_gerados
  add column if not exists categoria_ml text;

comment on column public.anuncios_gerados.categoria_ml is
  'category_id do item no Mercado Livre, lido em cada importação/conferida. NULL = nunca lido. É o que permite pedir a tarifa exata em /sites/MLB/listing_prices; sem ele o ML devolve null e a precificação cai na tabela.';

-- ============================================================
-- Conferência
-- ============================================================
--
--   select categoria_ml, count(*) from public.anuncios_gerados
--    group by 1 order by 2 desc;
--
-- Esperado logo após aplicar: uma linha, `null`, 880. Depois da primeira
-- conferida na tela de Pendências, as categorias reais aparecem.

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('056', '056-a-categoria-do-ml-para-de-ser-descartada', now(),
        'Coluna categoria_ml em anuncios_gerados. Medido em 10/08/2026: /api/ml/custos devolve tarifa null sem category_id, entao TODA a precificacao rodava com a comissao da tabela (19% Premium Moda) em vez da real. Nos anuncios dela a tabela erra: bolsas sao MLB7022 com 15%, quatro pontos a menos que os 19% aplicados. Comissao inflada faz a margem parecer pior e o preco ideal sair mais alto — ela deixa de vender por um custo que nao existe. O category_id ja era lido em toda leitura (mercadolivre.ts) e usado so para atributos obrigatorios; esta coluna para de descarta-lo. Sem default: null significa nao sabemos, e quem calcula cai na tabela DIZENDO que caiu.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   alter table public.anuncios_gerados drop column categoria_ml;
--
-- Seguro: nada depende dela para funcionar. Sem a coluna, a precificação volta
-- a usar a tabela — que é exatamente o comportamento de antes desta migração.
-- ============================================================
