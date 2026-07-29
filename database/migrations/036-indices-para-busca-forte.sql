-- ============================================================
-- Zion OS — Migração 036: índices para a busca forte do Copilot
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
--
-- APLICAÇÃO MANUAL. Nada aqui foi aplicado remotamente.
--
-- POR QUE EXISTE
--
-- A busca forte de catálogo (`lib/services/buscaNoCatalogo`) roda três queries
-- exatas, todas escopadas por tenant:
--
--   1. produto_variantes  WHERE cliente_id = ? AND sku   = ?
--   2. produto_variantes  WHERE cliente_id = ? AND ean   = ?
--   3. produtos           WHERE cliente_id = ? AND modelo = ?
--
-- Dessas, apenas a (1) tem índice hoje (`idx_variantes_sku`). As duas outras
-- fazem varredura sequencial — barato nesta base e caro na primeira que
-- crescer, e busca é a operação mais frequente do Copilot.
--
-- O QUE ESTA MIGRAÇÃO NÃO FAZ, e por quê
--
-- NÃO cria índice composto `(cliente_id, sku)`. Já existem `idx_variantes_sku`
-- e `idx_variantes_cliente` separados; o Postgres combina os dois por bitmap
-- and, e nesta escala (684 variantes) a diferença não é mensurável. Índice que
-- não resolve problema medido é custo de escrita sem retorno.
--
-- NÃO cria índice para a busca textual por nome. Ela usa `ILIKE '%termo%'`, e
-- curinga à esquerda não usa btree — precisaria de `pg_trgm` e um índice GIN.
-- Com 73 produtos a varredura é instantânea. Quando a base crescer, a decisão
-- volta com número em vez de suposição.
--
-- NÃO cria constraint UNIQUE em sku nem ean. Medido em 2026-07-29: 117 SKUs e
-- 112 EANs duplicados nesta base. UNIQUE aqui FALHARIA na aplicação e, se
-- passasse, quebraria a importação. A duplicidade é um achado a tratar numa
-- capacidade própria de qualidade de identificadores — não de raspão numa
-- migração de índice.
--
-- IMPACTO NA ESCRITA
--
-- Dois índices btree parciais a mais em tabelas que recebem escrita
-- principalmente em lote (importação de planilha e do ML). O custo é por linha
-- inserida/atualizada nas colunas indexadas. Os índices são PARCIAIS — só
-- indexam linhas com valor — e nesta base isso corta 240 de 684 variantes
-- (EAN presente em 444) e nenhum produto (modelo em 73/73). O ganho de leitura
-- numa operação feita a cada mensagem do chat compensa com folga.
-- ============================================================

-- EAN da variante — a busca por código de barras.
--
-- PARCIAL: 240 das 684 variantes não têm EAN, e indexar nulo é ocupar página
-- para nunca casar. `cliente_id` primeiro porque TODA query filtra por tenant
-- antes de qualquer outra coisa — é a coluna mais seletiva no caminho real.
create index if not exists idx_variantes_cliente_ean
  on public.produto_variantes (cliente_id, ean)
  where ean is not null and ean <> '';

-- Modelo do produto — o que o lojista chama de "referência" (ex. 7178.102).
--
-- Preenchido em 73 de 73 nesta base, mas o `where` fica: um produto criado sem
-- modelo não deve entrar no índice, e a condição documenta que a coluna é
-- nullable no schema.
create index if not exists idx_produtos_cliente_modelo
  on public.produtos (cliente_id, modelo)
  where modelo is not null and modelo <> '';

-- ============================================================
-- Conferência
-- ============================================================
-- select indexname from pg_indexes
--  where schemaname = 'public'
--    and indexname in ('idx_variantes_cliente_ean', 'idx_produtos_cliente_modelo');
--
-- Esperado: as duas linhas.
--
-- Para confirmar o uso, depois de aplicar:
-- explain analyze select id from public.produto_variantes
--   where cliente_id = '<seu-cliente>' and ean = '7900350512518';
-- Esperado: Index Scan usando idx_variantes_cliente_ean.
