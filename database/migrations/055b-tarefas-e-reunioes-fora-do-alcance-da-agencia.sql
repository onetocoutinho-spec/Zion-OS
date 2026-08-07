-- 055b — `tarefas` e `reunioes` saem do alcance da agência
--
-- ============================================================
-- MESMA FAMÍLIA DA 055a, MESMO CRITÉRIO
-- ============================================================
--
-- **A agência alcança o que ela OPERA.**
--
-- As duas tabelas são herança de agência de MARKETING — as notas da Zion SOBRE
-- o cliente, não o trabalho da loja:
--
--     tarefas   responsavel · prioridade · prazo · proxima_acao · observacoes
--     reunioes  titulo · data_hora · pauta
--
-- "Responsável" e "pauta" são de quem atende, não de quem é atendido. Uma
-- agência lendo isso vê o planejamento interno da Zion a respeito dela.
--
-- E não falta nada por tirar: o que a loja precisa fazer já é dito por
-- `lacunasDaLoja`, que se DERIVA dos dados — em vez de sair de uma reunião que
-- alguém precisa lembrar de registrar.
--
-- ============================================================
-- O MENU JÁ TINHA FECHADO; ISTO FECHA O OUTRO LADO
-- ============================================================
--
-- As duas telas saíram do menu da agência no mesmo dia (`navDoPapel`). Menu que
-- não oferece e RLS que não entrega são coisas diferentes, e as duas precisam
-- ser verdade: o menu evita a tela vazia, o RLS evita o acesso.
--
-- ============================================================
-- `cliente_leitura` DE `tarefas` NÃO É TOCADA
-- ============================================================
--
-- A lojista ler as próprias tarefas é decisão anterior e continua valendo. Esta
-- migração tira UMA política de cada tabela, e nomeia qual.
--
-- ============================================================
-- COMO FOI PROVADO
-- ============================================================
--
-- As duas tabelas têm 0 linhas, e com zero linhas "a agência vê 0" não prova
-- nada: uma política escancarada daria o mesmo resultado.
--
-- Então a prova inseriu UMA linha em cada, na loja que a agência opera, mais
-- uma em `produtos` como CONTROLE — e mediu com a sessão da agência, dentro de
-- uma transação com rollback:
--
--     financeiro           0   (esperado 0)
--     tarefas              0   (esperado 0)
--     reunioes             0   (esperado 0)
--     produtos (controle)  1   (esperado 1)
--
-- O controle é o que dá sentido aos três zeros. Sem ele, eles seriam
-- indistinguíveis de um mecanismo de teste quebrado.

drop policy if exists agencia_escopo on public.tarefas;
drop policy if exists agencia_escopo on public.reunioes;

-- ============================================================
-- Conferência
-- ============================================================
--
--   select tablename, string_agg(policyname, ', ')
--     from pg_policies where schemaname='public'
--      and tablename in ('tarefas','reunioes','financeiro')
--    group by tablename;
--
--   -- financeiro  equipe_total
--   -- reunioes    equipe_total
--   -- tarefas     cliente_leitura, equipe_total

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('055b', '055b-tarefas-e-reunioes-fora-do-alcance-da-agencia', now(),
        'DROP da politica agencia_escopo em tarefas e reunioes. Mesma familia da 055a: sao heranca de agencia de marketing — as notas da Zion SOBRE o cliente (responsavel, prioridade, prazo, pauta), nao o trabalho da loja. O que a loja precisa fazer ja e dito por lacunasDaLoja, derivado dos dados. As duas telas ja tinham saido do menu da agencia no mesmo dia (navDoPapel); isto fecha o outro lado. cliente_leitura de tarefas NAO foi tocada: a lojista ler as proprias tarefas e decisao anterior. Provado com uma linha inserida em cada tabela mais uma de CONTROLE em produtos, medido com a sessao da agencia numa transacao com rollback: 0/0/0 nas tres e 1 no controle — sem o controle, tres zeros seriam indistinguiveis de mecanismo de teste quebrado.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   create policy agencia_escopo on public.tarefas for all
--     using (cliente_id in (select public.lojas_da_agencia()))
--     with check (cliente_id in (select public.lojas_da_agencia()));
--   create policy agencia_escopo on public.reunioes for all
--     using (cliente_id in (select public.lojas_da_agencia()))
--     with check (cliente_id in (select public.lojas_da_agencia()));
--
-- Só faz sentido se essas duas telas deixarem de ser notas da Zion e virarem
-- trabalho da loja. Aí a decisão é de produto, não de banco.
-- ============================================================
