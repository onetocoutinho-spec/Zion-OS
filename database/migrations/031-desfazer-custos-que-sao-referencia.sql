-- ============================================================
-- Zion OS — Migração 031: desfazer os custos que são código de modelo
--
-- Rode UMA vez no SQL Editor. URGENTE: o dado atual é pior que dado ausente.
--
-- O QUE ACONTECEU
--
-- A importação de custos de 28/07/2026 gravou 87 produtos, todos marcados com
-- `confianca_custo = 'alta'`. Nenhum deles é um custo. São as REFERÊNCIAS de
-- modelo, tiradas do próprio nome do produto:
--
--   "Chinelo Cartago 11840 Atlanta"        → custo R$ 11.840,00
--   "Chinelo Couro Pegada 130641"          → custo R$ 130.641,00
--   "Papete Slide Modare 7208.101 Nature"  → custo R$ 7.208,10
--   "Babuche Boaonda 1716 John"            → custo R$ 1.716,00
--   "Chinelo Slide Under Armour 30277872"  → custo R$ 30.277.872,00
--
-- Trinta milhões de reais de custo para um chinelo, com selo de confiança alta.
--
-- POR QUE ISSO PASSOU
--
-- O casamento por nome usa o código do modelo embutido no nome para decidir se
-- duas linhas falam do mesmo produto. Quando a coluna de custo da planilha
-- também contém esse código, o número casa consigo mesmo e entra como dinheiro.
-- Não havia nenhuma verificação de que um custo se parece com dinheiro.
--
-- `margem` NÃO foi contaminada: `margemZion(custo, 0)` devolve null quando não
-- há preço de venda, e 1.732 produtos não têm preço. Só o custo precisa voltar.
--
-- A JANELA
--
-- Todos os 87 foram escritos entre 00:21:36 e 00:21:43 UTC de 28/07/2026, e são
-- os únicos com custo além do produto de teste (que tem custo legítimo e é
-- anterior). O corte por data é o que separa um do outro.
-- ============================================================

update public.produtos
   set custo            = 0,
       confianca_custo  = '',
       updated_at       = now()
 where custo > 0
   and updated_at >= timestamptz '2026-07-28 00:20:00+00'
   and updated_at <  timestamptz '2026-07-28 00:30:00+00';

-- ------------------------------------------------------------
-- VERIFICAÇÃO (somente leitura):
--   -- esperado: 1 (só o produto de teste, com custo legítimo)
--   select count(*) from public.produtos where custo > 0;
--
--   -- esperado: nenhuma linha. Custo maior que mil reais em calçado é a
--   -- assinatura do defeito.
--   select nome, custo from public.produtos where custo > 1000 order by custo desc;
--
-- REVERTER:
--   Não há: o valor apagado nunca foi um custo. Os custos de verdade voltam
--   pela importação, depois que ela souber recusar referência disfarçada.
--   delete from public.migracoes_aplicadas where numero = '031';
-- ------------------------------------------------------------

-- ★ Auto-registro (convenção ≥024):
insert into public.migracoes_aplicadas (numero, nome, observacao)
values ('031','031-desfazer-custos-que-sao-referencia','apaga os 87 custos que eram código de modelo do nome — até R$ 30 milhões em um chinelo, marcados como confiança alta')
on conflict (numero) do nothing;
