-- 087 — a prova de que a inserção cruzada é rejeitada
--
-- ============================================================
-- POR QUE ESTE ARQUIVO EXISTE
-- ============================================================
--
-- A 087 troca a garantia de "a RLS confia no cliente_id, ninguém confere o
-- produto_id" para "o banco recusa o par errado, não importa quem escreve".
-- Esta é a prova de que a troca funcionou — testada como TESTE 4 do
-- `teste_trigger.sql` local desta sessão, e reproduzida aqui no molde que o
-- repositório já usa (`054-verificacao-do-isolamento.sql`).
--
-- ============================================================
-- É SEGURO RODAR EM PRODUÇÃO
-- ============================================================
--
-- Tudo acontece dentro de uma transação que termina em ROLLBACK. Nenhuma
-- linha sobrevive: nem os clientes fictícios, nem os produtos, nem a fila.
--
-- Rode DEPOIS de aplicar a 087. Qualquer asserção que falhar levanta exceção
-- e aborta — silêncio é aprovação, e o resumo no fim diz o que passou.
--
-- Não precisa simular sessão nem papel (`set local role authenticated`,
-- como a 054 faz): o trigger é `security definer` e vale para QUALQUER
-- chamador, inclusive `service_role` — é rodando como o dono da conexão
-- (equivalente ao pior caso, o worker do cron) que a garantia é mais
-- exigente de provar.

begin;

-- ============================================================
-- O CENÁRIO
-- ============================================================
--
--   cliente ALFA → produto da ALFA
--   cliente BETA → produto da BETA
--
-- Ids fixos e improváveis de propósito: se algo escapar do rollback, dá para
-- encontrar e remover pelo prefixo.

do $$
declare
  cli_alfa uuid := '00000f17-a000-4000-8000-000000000a01';
  cli_beta uuid := '00000f17-a000-4000-8000-000000000b01';
  prod_alfa uuid := '00000f17-a000-4000-8000-0000000a0001';
  prod_beta uuid := '00000f17-a000-4000-8000-0000000b0001';
begin
  insert into public.clientes (id, empresa)
  values (cli_alfa, 'Loja Alfa (087, teste)'),
         (cli_beta, 'Loja Beta (087, teste)');

  insert into public.produtos (id, cliente_id, nome, sku, preco_venda, custo, estoque)
  values (prod_alfa, cli_alfa, 'Produto da Alfa', '087-A-001', 100, 40, 5),
         (prod_beta, cli_beta, 'Produto da Beta', '087-B-001', 100, 40, 5);

  raise notice '--- cenario montado: 2 clientes, 2 produtos ---';
end $$;

-- ============================================================
-- TESTE 1 — INSERT legítimo (cliente enfileira o PRÓPRIO produto): passa
-- ============================================================

do $$
begin
  insert into public.fila_otimizacao_produto (cliente_id, produto_id)
  values ('00000f17-a000-4000-8000-000000000a01', '00000f17-a000-4000-8000-0000000a0001');
  raise notice 'ok  · insercao legitima (mesmo cliente) passa';
exception when others then
  raise exception 'FALHOU: insercao legitima foi rejeitada — %', sqlerrm;
end $$;

-- ============================================================
-- TESTE 2 — INSERT cruzado (achado 1: cliente A enfileira produto de B):
-- tem que ser rejeitado
-- ============================================================

do $$
begin
  begin
    insert into public.fila_otimizacao_produto (cliente_id, produto_id)
    values ('00000f17-a000-4000-8000-000000000a01', '00000f17-a000-4000-8000-0000000b0001');
    raise exception 'FALHOU: a insercao cruzada (achado 1) foi aceita — o trigger nao esta valendo';
  exception
    when sqlstate '23514' then
      raise notice 'ok  · insercao cruzada rejeitada (%)', sqlerrm;
  end;
end $$;

-- ============================================================
-- TESTE 3 — UPDATE de status (o worker fazendo o trabalho normal, sem tocar
-- cliente_id/produto_id): tem que passar
-- ============================================================

do $$
declare n int; begin
  with alterado as (
    update public.fila_otimizacao_produto
       set status = 'concluido', anuncio_id = null
     where produto_id = '00000f17-a000-4000-8000-0000000a0001'
     returning 1
  ) select count(*) into n from alterado;
  if n <> 1 then raise exception 'FALHOU: update de status legitimo nao afetou a linha esperada (% linhas)', n; end if;
  raise notice 'ok  · update de status (sem tocar produto_id/cliente_id) passa';
end $$;

-- ============================================================
-- TESTE 4 — UPDATE cruzado (tentar trocar produto_id para o de outro tenant,
-- mantendo cliente_id): tem que ser rejeitado — é o INSERT do teste 2
-- disfarçado de UPDATE, e o motivo de o trigger cobrir os dois
-- ============================================================

do $$
begin
  begin
    update public.fila_otimizacao_produto
       set produto_id = '00000f17-a000-4000-8000-0000000b0001'
     where cliente_id = '00000f17-a000-4000-8000-000000000a01';
    raise exception 'FALHOU: o UPDATE trocando produto_id para o de outro tenant foi aceito';
  exception
    when sqlstate '23514' then
      raise notice 'ok  · update trocando produto_id para outro tenant tambem rejeitado (%)', sqlerrm;
  end;
end $$;

do $$ begin
  raise notice '';
  raise notice '=========================================================';
  raise notice ' TODAS AS ASSERCOES PASSARAM — desfazendo tudo agora';
  raise notice '=========================================================';
end $$;

rollback;
