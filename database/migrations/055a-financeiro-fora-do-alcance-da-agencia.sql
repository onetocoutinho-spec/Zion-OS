-- 055a — `financeiro` sai do alcance da agência
--
-- ============================================================
-- COMO ISTO FOI ACHADO
-- ============================================================
--
-- Abrindo o painel logado como agência, em produção, pela primeira vez. Não foi
-- teste, nem varredura, nem o advisor: foi ler o menu lateral com os olhos.
--
-- ============================================================
-- O QUE O LAÇO DA 054 ACERTOU E ONDE ERROU
-- ============================================================
--
-- A 054 criou `agencia_escopo` em TODA tabela com `cliente_id` e RLS, por um
-- laço. Como regra isso está certo, e continua: a alternativa — 28 políticas
-- escritas à mão — deixaria uma para trás mais cedo ou mais tarde.
--
-- Mas o laço presume que "tem `cliente_id`" significa "é sobre a operação
-- daquela loja". Em 27 tabelas é verdade. Em `financeiro` não:
--
--     valor_mensal · custo_operacional · lucro_estimado
--
-- Isso não é a operação da loja. É a POSIÇÃO COMERCIAL DA ZION sobre ela —
-- quanto se cobra, quanto custa atender, quanto sobra. Uma agência lendo isso
-- entra em qualquer renegociação sabendo a margem do outro lado.
--
-- Não é vazamento entre clientes, que é o que a 054 foi construída para
-- impedir. É vazamento da Zion PARA o cliente, e talvez seja pior.
--
-- ============================================================
-- NADA FOI EXPOSTO
-- ============================================================
--
-- A tabela tem 0 linhas hoje. O defeito era futuro: ele apareceria no dia em
-- que alguém registrasse o primeiro contrato, e ninguém teria motivo para
-- reabrir esta política naquele dia.
--
-- ============================================================
-- O CRITÉRIO, DITO DE UMA VEZ
-- ============================================================
--
-- **A agência alcança o que ela OPERA.**
--
-- É o mesmo que já tinha deixado `perfis` fora do laço — identidade não é
-- operação — e é o mesmo que decide o menu (`navDoPapel`). Três lugares, uma
-- regra.

drop policy if exists agencia_escopo on public.financeiro;

-- ============================================================
-- Conferência
-- ============================================================
--
--   select policyname from pg_policies
--    where schemaname='public' and tablename='financeiro';
--   -- espera-se SÓ `equipe_total`.

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('055a', '055a-financeiro-fora-do-alcance-da-agencia', now(),
        'DROP da politica agencia_escopo em financeiro. O laco da 054 acertou como regra e errou nesta linha: ele presume que "tem cliente_id" significa "e sobre a operacao da loja", e em financeiro nao e — valor_mensal, custo_operacional e lucro_estimado sao a posicao comercial da Zion sobre o cliente. Agencia lendo isso entra em renegociacao sabendo a margem do outro lado. Nao e vazamento entre clientes (o que a 054 impede), e vazamento da Zion PARA o cliente. Achado abrindo o painel logado como agencia e lendo o menu; tabela com 0 linhas, entao nada foi exposto. Criterio: a agencia alcanca o que ela OPERA — o mesmo que deixa perfis fora do laco e que decide o menu em navDoPapel.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   create policy agencia_escopo on public.financeiro for all
--     using (cliente_id in (select public.lojas_da_agencia()))
--     with check (cliente_id in (select public.lojas_da_agencia()));
--
-- Só faz sentido se um dia se decidir que a agência DEVE ver o que a Zion cobra
-- dela. Isso é decisão comercial, não técnica.
-- ============================================================
