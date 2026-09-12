-- 084 — A chave da foto tem UM dono, e ele e o app.
--
-- ===========================================================================
-- O QUE A 083 FEZ, E O QUE ELA DEIXOU EM ABERTO
-- ===========================================================================
--
-- A 083 agrupou a contagem de fotos no banco, e para isso repetiu em SQL a
-- normalizacao de cor que `chaveDaFoto` faz em TypeScript:
--
--     app:  (cor ?? "").trim().toLowerCase()
--     SQL:  lower(btrim(coalesce(cor, '')))
--
-- O comentario da 083 dizia que a repeticao era "de proposito, porque as duas
-- rodam em maquinas diferentes". Estava errado, e a revisao de codigo do mesmo
-- dia apontou: duas definicoes da mesma regra divergem, e e so questao de
-- quando.
--
-- ELAS JA DIVERGEM. Medido no proprio banco em 28/08/2026:
--
--     lower(btrim(coalesce('preto' || chr(9), '')))   ->  'preto<TAB>'   6 chars
--     'preto\t'.trim().toLowerCase()                  ->  'preto'        5 chars
--
-- `btrim(x)` sem segundo argumento remove APENAS o espaco comum. O `trim()` do
-- JavaScript remove todo espaco Unicode — tabulacao, quebra de linha, retorno
-- de carro, espaco inquebravel. Uma cor com tabulacao, que e o que uma planilha
-- exportada produz sem ninguem notar, cairia em duas chaves diferentes: a
-- contagem numa, a tela procurando na outra. O aviso de foto repetida sumiria
-- exatamente onde a cor veio suja — e sumiria calado.
--
-- Nada nos dados de hoje dispara isso: 8.090 imagens, ZERO com espaco exotico.
-- E um defeito latente, e latente e o pior tipo para uma regra de aviso.
--
-- ===========================================================================
-- O CONSERTO NAO E IGUALAR AS DUAS — E TER UMA SO
-- ===========================================================================
--
-- Dava para escrever `btrim(cor, E' \t\n\r')` e empatar hoje. Mas a paridade
-- completa com o `trim()` do JavaScript exige a tabela Unicode inteira, e a
-- proxima diferenca voltaria a ser invisivel.
--
-- Entao a funcao para de normalizar. Ela agrupa pela cor CRUA e devolve o valor
-- como esta; quem monta a chave e `chaveDaFoto`, no app, que ja era o dono da
-- forma. O app soma as linhas que caem na mesma chave — duas cores cruas
-- diferentes ("Preto" e "preto ") podem virar uma chave so, e somar e a resposta
-- certa.
--
-- O ganho da 083 continua inteiro: o que atravessa a rede sao as contagens, nao
-- as fotos. Agrupar por cor crua devolve no MAXIMO as mesmas linhas de antes, e
-- na pratica as mesmas — sao 929 num caso e 929 no outro nesta base.
--
-- E o que a 083 nao tinha passa a existir: um teste do app pode provar a
-- equivalencia, porque as duas pontas usam a MESMA funcao. Antes so dava para
-- comparar strings de SQL, que e o que os testes dela faziam.
--
-- ===========================================================================
-- INCREMENTAL. Rode UMA vez no SQL Editor, depois da 083.
-- Nao cria tabela, nao altera coluna, nao apaga linha, nao toca em RLS.
-- O tipo de retorno nao muda; o conteudo da coluna `cor` passa a vir cru.
-- ===========================================================================

create or replace function public.contar_fotos_por_produto_e_cor(p_cliente uuid)
returns table (produto_id uuid, cor text, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  -- SEM normalizar: a cor sai como esta, e `chaveDaFoto` no app decide a forma.
  -- Uma segunda definicao da chave aqui divergiria da primeira — e ja divergia,
  -- no espaco que nao e espaco comum.
  select i.produto_id, i.cor, count(*) as total
    from public.imagens_produto i
   where i.cliente_id = p_cliente
   group by i.produto_id, i.cor
$$;

revoke all on function public.contar_fotos_por_produto_e_cor(uuid) from public, anon;
grant execute on function public.contar_fotos_por_produto_e_cor(uuid) to authenticated, service_role;

comment on function public.contar_fotos_por_produto_e_cor(uuid) is
  'Contagem de fotos por produto e cor CRUA. A chave e montada no app por chaveDaFoto, que e o unico dono da forma — a 083 repetia a normalizacao aqui e as duas ja divergiam no espaco que nao e espaco comum. security invoker: a RLS de imagens_produto continua valendo.';

-- ★ Auto-registro (convencao declarada na 024).
insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('084', '084-a-chave-da-foto-tem-um-dono-so', now(),
        'A 083 repetia em SQL a normalizacao de cor de chaveDaFoto, com o comentario de que a repeticao era de proposito. A revisao do mesmo dia mostrou que nao: medido no banco, btrim sem segundo argumento deixa a tabulacao que o trim() do JavaScript remove, entao uma cor vinda suja de planilha cairia em duas chaves e o aviso de foto repetida sumiria calado. Zero linhas afetadas hoje (8.090 imagens, nenhuma com espaco exotico) — defeito latente. A funcao para de normalizar e agrupa pela cor crua; a chave passa a ter um dono so, no app, e a equivalencia vira testavel.')
on conflict (numero) do nothing;

-- ===========================================================================
-- DESFAZER
-- ===========================================================================
--
-- Voltar a 083 exige voltar TAMBEM o app: com a funcao normalizando e o app
-- somando por chave, o resultado continua certo — somar duas linhas que ja
-- vieram agrupadas nao muda nada. O caminho seguro e reaplicar a 083 e deixar
-- o app como esta.
--
--   (reaplique database/migrations/083-contar-fotos-sem-baixar-fotos.sql)
--   delete from public.migracoes_aplicadas where numero = '084';
