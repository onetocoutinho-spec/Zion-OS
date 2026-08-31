-- 073 — QUANTO DO TURNO FOI FERRAMENTA, E QUANTO FOI MODELO
--
-- ===========================================================================
-- POR QUE
-- ===========================================================================
--
-- Em 24/08/2026 a separação de `tokens_saida` mostrou cinco turnos entre 16,5
-- e 20,0 ms por token gerado, e eu concluí que latência aqui é volume de
-- saída. O sexto turno mediu 25,2 com uma resposta MAIS CURTA — 879 tokens em
-- 22,2 s contra 1.175 em 20,5 s. A conclusão não se sustentou.
--
-- O que falta para decidir é o eixo que `ms` sozinho esconde: parte do turno é
-- o modelo gerando, parte é ferramenta esperando I/O — e desde hoje o
-- diagnóstico de agrupamento fala com o Mercado Livre (renovar credencial +
-- multiget), um custo de parede que NÃO cresce com o tamanho da resposta.
--
-- Com as duas parcelas separadas, "encurtar a resposta" e "acelerar a leitura"
-- deixam de ser a mesma conversa.
--
-- Só isto: uma coluna, anulável. Linha antiga fica `null` — que é o valor
-- honesto para turno gravado antes de existir medição, e não zero.

alter table public.ia_execucoes
  add column if not exists ms_ferramentas integer;

comment on column public.ia_execucoes.ms_ferramentas is
  'Milissegundos gastos DENTRO das ferramentas neste turno (soma). `ms` menos este valor é o tempo em modelo e rede do provedor. NULL = turno anterior à medição, não zero.';

-- ============================================================
-- O LEDGER (regra da 043: a propria migracao registra a propria linha)
-- ============================================================

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('073', '073-o-tempo-gasto-em-ferramenta', now(),
        'ia_execucoes.ms_ferramentas: separa o turno em tempo DENTRO de ferramenta e tempo de modelo. Sem esse eixo, ms sozinho escondia a causa e a leitura de que latencia e volume de saida nao se sustentou. NULL = turno anterior a medicao, nao zero.')
on conflict do nothing;
