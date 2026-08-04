-- 053 — uma capa por produto (e, quando existir, uma por cor)
--
-- ============================================================
-- O QUE ISTO IMPEDE
-- ============================================================
--
-- Uma SEGUNDA "Principal" no mesmo produto. Hoje nada impede: `imagens_produto`
-- só tem a primary key em `id`, então duas capas entram caladas e a que a
-- publicação escolhe passa a depender da ordem da consulta.
--
-- É pré-requisito de qualquer lote de imagem — e lote de imagem é exatamente o
-- que vem pela frente, porque o Mercado Livre já disse, em 922 infrações de
-- foto, que a capa é o problema mais caro desta conta.
--
-- ============================================================
-- POR QUE NÃO É O ÍNDICE QUE O PLANO PEDIU
-- ============================================================
--
-- O PLANO-002 (C4) pede único em `(produto_id, tipo_imagem)`. Esse índice está
-- ERRADO, e o erro só aparece medindo: `Secundária` é legitimamente MÚLTIPLA.
--
-- Medido em produção, 04/08/2026:
--
--     653 linhas · 77 combinações (produto_id, tipo_imagem) repetidas
--     570 linhas envolvidas — quase todas secundárias legítimas
--
-- O índice do plano recusaria a segunda foto secundária de 77 produtos. Ele não
-- protegeria a capa: destruiria a galeria.
--
-- O que se quer não é "uma linha por tipo". É UMA CAPA.
--
-- ============================================================
-- POR QUE `variante_id` ENTRA NA CHAVE, ESTANDO VAZIO
-- ============================================================
--
-- Medido no mesmo dia: `variante_id` é NULL nas 653 linhas. Zero. A coluna
-- existe e nunca foi usada — é a prova, em dado, de que a associação foto↔cor
-- nunca existiu (PLANO-002 C1), que é a causa do "o título e/ou as fotos não
-- correspondem ao produto" que o ML repetiu 110 vezes, a mais recente ontem.
--
-- O DES-003 vai preencher essa coluna: uma capa POR COR. Um índice só sobre
-- `produto_id` estaria correto hoje e **brigaria com a próxima feature** —
-- recusaria a capa da segunda cor, e alguém teria que derrubá-lo no meio do
-- trabalho para o qual ele foi criado.
--
-- Então a chave é (produto, variante), com NULL colapsado num balde único:
--
--     hoje    — todas as linhas caem no balde NULL → uma capa por produto
--     depois  — cada cor tem o seu balde       → uma capa por cor, de graça
--
-- `coalesce` é necessário porque em índice único NULL nunca é igual a NULL:
-- sem ele, duas capas com `variante_id` nulo passariam as duas.
--
-- ============================================================
-- CUSTO DE APLICAR
-- ============================================================
--
-- Zero limpeza. Medido: 80 produtos, 80 Principais, NENHUM com duas. O índice
-- entra sobre dado que já o respeita — se falhar, é porque algo mudou entre
-- esta medição e a aplicação, e aí a falha é a informação.
--
-- Não toca em RLS, não altera coluna, não apaga linha.

create unique index if not exists idx_imagens_produto_uma_capa
  on public.imagens_produto (
    produto_id,
    coalesce(variante_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where tipo_imagem = 'Principal';

comment on index public.idx_imagens_produto_uma_capa is
  'Uma capa por produto — e por variante, quando o DES-003 preencher variante_id. Secundaria continua multipla de proposito.';

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('053', '053-uma-capa-por-produto', now(),
        'Indice unico PARCIAL em imagens_produto: (produto_id, coalesce(variante_id, uuid-zero)) where tipo_imagem = Principal. NAO e o indice do PLANO-002 C4, que pedia (produto_id, tipo_imagem) e recusaria a segunda foto Secundaria de 77 produtos (medido: 653 linhas, 570 envolvidas em repeticao legitima). variante_id entra na chave estando vazio (0 de 653) para nao brigar com o DES-003, que vai querer uma capa por cor. Aplicado sem limpeza: 80 produtos, 80 Principais, nenhum com duas. RLS intocada.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   drop index if exists public.idx_imagens_produto_uma_capa;
--
-- Nada mais. Nenhum dado foi alterado, então derrubar o índice devolve o estado
-- anterior por completo — inclusive a possibilidade de uma segunda capa entrar
-- calada, que é o motivo de ele existir.
-- ============================================================
