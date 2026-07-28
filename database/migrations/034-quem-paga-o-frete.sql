-- ============================================================
-- Zion OS — Migração 034: quem paga o frete deste produto
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
--
-- O QUE ERA SUPOSIÇÃO
--
-- O cálculo descontava frete de TODO produto, sempre, a partir da tabela oficial
-- do ML (peso × faixa de preço × reputação). Isso está certo quando o vendedor
-- oferece frete grátis — sob ME2 o ML cobra dele um valor fixo por faixa.
--
-- Mas quando o COMPRADOR paga, esse custo não existe para o lojista. Descontá-lo
-- mostra margem menor que a real, e o lojista sobe preço sem precisar.
--
-- A importação do ML lia `shipping.dimensions` (tentando o peso) e jogava fora
-- `shipping.free_shipping`. Resultado medido: 501 anúncios importados, ZERO com
-- informação de frete guardada. A premissa era invisível.
--
-- Acima de R$ 79 o ML obriga frete grátis, então a suposição quase sempre
-- acertava. Abaixo disso é estratégia do vendedor — e 12 dos 73 produtos desta
-- base estão nessa faixa.
--
-- NULL É UMA RESPOSTA
--
-- A coluna aceita null de propósito: "não se sabe". Quem consome ASSUME QUE O
-- VENDEDOR PAGA nesse caso — supor o contrário inflaria a margem, e margem
-- otimista é o defeito que este modelo mais repetiu (preço mínimo de R$ 1,77,
-- lucro com custo zero, margem de 20,7% onde a real era 6%).
-- ============================================================

alter table public.produtos
  add column if not exists vendedor_paga_frete boolean;

comment on column public.produtos.vendedor_paga_frete is
  'true = frete grátis (o vendedor paga, entra na conta pela tabela do ML); '
  'false = comprador paga (frete não é custo do lojista); '
  'null = não se sabe, e o cálculo assume que o vendedor paga.';

-- ------------------------------------------------------------
-- VERIFICAÇÃO (somente leitura):
--   -- esperado: tudo null antes da próxima importação do ML
--   select count(*) filter (where vendedor_paga_frete is null) as nao_sabemos,
--          count(*) filter (where vendedor_paga_frete)         as vendedor_paga,
--          count(*) filter (where not vendedor_paga_frete)     as comprador_paga,
--          count(*)                                            as total
--     from public.produtos;
--
--   -- os que a suposição pode estar errando (abaixo do piso de frete grátis):
--   select count(*) from public.produtos
--    where preco_venda > 0 and preco_venda < 79 and vendedor_paga_frete is null;
--
-- REVERTER:
--   alter table public.produtos drop column if exists vendedor_paga_frete;
--   delete from public.migracoes_aplicadas where numero = '034';
-- ------------------------------------------------------------

-- ★ Auto-registro (convenção ≥024):
insert into public.migracoes_aplicadas (numero, nome, observacao)
values ('034','034-quem-paga-o-frete','frete grátis por produto, capturado do ML na importação — null assume que o vendedor paga')
on conflict (numero) do nothing;
