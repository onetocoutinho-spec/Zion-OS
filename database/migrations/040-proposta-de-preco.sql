-- ============================================================
-- Zion OS — Migração 040: a Proposal também troca PREÇO
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
--
-- APLICAÇÃO MANUAL. Nada aqui foi aplicado remotamente.
--
-- POR QUE EXISTE
--
-- "Pode aplicar R$ 89,90" é a primeira intenção do Copilot que muda o número do
-- qual sai o faturamento. As três proteções da Proposal servem sem adaptação:
--
--   IDENTIDADE     a confirmação referencia um id do banco, não um objeto da tela
--   PRECONDIÇÕES   custo, preço atual, peso cobrável e a configuração fiscal
--   IDEMPOTÊNCIA   a transição atômica `pendente` -> `executada`
--
-- E `valor numeric not null` já é exatamente o que um preço precisa: a coluna
-- carrega gramas para peso e REAIS para dinheiro. Nada de hash, nada de campo
-- novo — este tipo cabe na primitive como ela está.
--
-- ============================================================
-- O QUE "APLICAR PREÇO" SIGNIFICA — e o que ele NÃO significa
-- ============================================================
--
-- Significa: `produtos.preco_venda` (e a `margem` derivada dele) no catálogo do
-- Zion.
--
-- NÃO significa publicar no Mercado Livre. Publicar é outra ação, com outra
-- rota (`/api/ml/publicar`), outra confirmação e outro risco — o anúncio que
-- está no ar não é tocado por esta Proposal. Misturar as duas faria "pode
-- aplicar" mudar o preço que o comprador vê, e ninguém pediu isso.
--
-- ============================================================
-- AS PRECONDIÇÕES DE UM PREÇO
-- ============================================================
--
-- Um preço não é um número solto: é o resultado de uma conta. O que ele promete
-- ("12% de margem") depende de quatro entradas, e todas as quatro são vigiadas:
--
--   custoDoProduto            em centavos inteiros
--   precoAtual                em centavos inteiros (null = não havia preço)
--   pesoCobravelGramas        o maior entre real e cubado, que decide o frete
--   impressaoDaConfiguracao   hash de imposto, cupom, comissões e custos fixos
--
-- O cenário que isto impede: T0 custo R$ 47,80, o Zion propõe R$ 89,90; T1 o
-- custo vira R$ 55; T2 o lojista clica. Sem a precondição, gravaríamos um preço
-- que já não entrega a margem que ele leu.
--
-- A COMISSÃO DA API NÃO ENTRA nas precondições, e é deliberado: ela é
-- consultada COM o preço, e o preço é justamente o que a proposta congela.
-- Revalidá-la exigiria uma chamada externa dentro da confirmação, e uma falha
-- de rede transformaria uma proposta boa em "obsoleta".
-- ============================================================

do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public'
       and rel.relname = 'copilot_propostas'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%tipo%'
       and pg_get_constraintdef(con.oid) ilike '%peso%'
  loop
    execute format('alter table public.copilot_propostas drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.copilot_propostas
  add constraint copilot_propostas_tipo_check
  check (tipo in ('peso', 'custo', 'cadastro', 'titulo', 'preco'));

comment on column public.copilot_propostas.valor is
  'Unidade canônica por tipo: gramas (peso), reais (custo, preco), caracteres (titulo).';

-- ============================================================
-- Conferência
-- ============================================================
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conname = 'copilot_propostas_tipo_check';
-- Esperado: CHECK (tipo = ANY (ARRAY['peso','custo','cadastro','titulo','preco']))
