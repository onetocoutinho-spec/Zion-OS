-- ============================================================
-- Zion OS — Migração 032: manter só o catálogo que existe no Mercado Livre
--
-- DESTRUTIVA E IRREVERSÍVEL. Rode UMA vez no SQL Editor, com atenção.
-- Não há lixeira nem histórico: produto apagado sai do banco.
--
-- O QUE ELA FAZ
--
-- Apaga os 1.733 produtos que entraram por planilha e mantém os 73 que vieram
-- da importação do Mercado Livre. Os 73 agregam os ~501 anúncios ativos — a
-- importação do ML agrupa anúncios em produto, com as variações dentro —, então
-- os anúncios no ar não são afetados. Só o catálogo do Zion encolhe.
--
-- O DISCRIMINADOR
--
-- `observacoes` é o único campo que separa as duas origens, e separa sem
-- ambiguidade (73 + 1.733 = 1.806, sem sobra):
--
--   "Importado do ML (26 anúncio(s), 26 variação(ões))…"  → veio do ML
--   "Importado da base (1 derivações)."                    → veio de planilha
--
-- `marketplace` NÃO serve: os 1.806 estão marcados como Mercado Livre.
--
-- O QUE VAI JUNTO (medido em 28/07/2026)
--
--   produto_variantes      2.401 de 3.085   (on delete cascade)
--   imagens_produto            1 de   596   (on delete cascade)
--   produto_atributos, anuncio_variantes, precificacao_variantes, fila_otimizacao
--                                           (on delete cascade)
--
-- Praticamente todo o trabalho real está nos 73 do ML: 595 das 596 imagens e
-- 575 dos 578 anúncios gerados. A planilha carregava uma imagem e três anúncios.
-- Junto com ela vão os 734 nomes corrompidos por encoding.
--
-- O QUE **NÃO** É APAGADO
--
-- `anuncios_gerados` e `auditorias_anuncios` são `on delete set null`: os 3
-- anúncios gerados sobre produtos de planilha CONTINUAM existindo, com
-- produto_id nulo. Isso é de propósito — o anúncio é trabalho de IA já pago, e
-- perder o vínculo é melhor que perder a peça.
--
-- Os ~319 custos importados hoje sobre produtos de planilha se vão com eles.
-- Reimportar a planilha de custos depois, sobre a base limpa, é rápido: a tela
-- de conferência mostra o que entendeu antes de gravar.
-- ============================================================

-- ANTES DE RODAR — confira que os números batem com o esperado:
--   select
--     count(*) filter (where observacoes like 'Importado do ML%')   as fica,     -- 73
--     count(*) filter (where observacoes like 'Importado da base%') as sai,      -- 1733
--     count(*)                                                       as total    -- 1806
--   from public.produtos;
--
-- Se "fica + sai" não der o total, PARE: existe uma terceira origem que este
-- comando não previu, e ela seria apagada ou mantida por acidente.

delete from public.produtos
 where observacoes like 'Importado da base%';

-- ------------------------------------------------------------
-- VERIFICAÇÃO (somente leitura):
--   select count(*) from public.produtos;            -- esperado: 73
--   select count(*) from public.produto_variantes;   -- esperado: 684
--   select count(*) from public.imagens_produto;     -- esperado: 595
--   select count(*) from public.anuncios_gerados;    -- esperado: 578 (nenhum some)
--   select count(*) from public.anuncios_gerados where produto_id is null;  -- 3
--
--   -- os nomes corrompidos devem ter ido embora com a planilha:
--   select count(*) from public.produtos where nome like '%' || chr(65533) || '%';
--
-- REVERTER:
--   Não há. É por isso que a conferência acima existe.
-- ------------------------------------------------------------

-- ★ Auto-registro (convenção ≥024):
insert into public.migracoes_aplicadas (numero, nome, observacao)
values ('032','032-limpar-base-manter-so-o-ml','apaga os 1.733 produtos vindos de planilha e mantém os 73 do ML — decisão do lojista em 28/07/2026')
on conflict (numero) do nothing;
