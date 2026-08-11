-- 058 — o `tipo` da proposta admite descricao e palavras_chave
--
-- ============================================================
-- O QUE FALTOU NA 057, E COMO APARECEU
-- ============================================================
--
-- A 057 criou a funcao que EXECUTA os dois tipos novos, e o codigo passou a
-- montar as propostas. Faltou abrir o CHECK da coluna `tipo`.
--
-- O sintoma, medido em producao no primeiro pedido real:
--
--   [conversa] falha ao gravar a proposta de texto: new row for relation
--   "copilot_propostas" violates check constraint "copilot_propostas_tipo_check"
--
-- `criarProposta` falhava, a rota capturava (como deve — sem Proposal nao ha
-- confirmacao possivel), e a lojista via a resposta SEM BOTAO. O `catch` que
-- registra e por isso que o defeito apareceu em minutos e nao em semanas.
--
-- ============================================================
-- POR QUE O CHECK EXISTE
-- ============================================================
--
-- Ele impede uma proposta de tipo inventado chegar ate a funcao de execucao.
-- Abri-lo para exatamente os dois nomes que a 057 ja aceita mantem as duas
-- pontas dizendo a mesma coisa — que e o unico jeito de um check assim nao
-- virar cerimonia.

alter table public.copilot_propostas
  drop constraint if exists copilot_propostas_tipo_check;

alter table public.copilot_propostas
  add constraint copilot_propostas_tipo_check
  check (tipo = any (array['peso'::text, 'custo'::text, 'cadastro'::text,
                           'titulo'::text, 'preco'::text,
                           'descricao'::text, 'palavras_chave'::text]));

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('058', '058-o-tipo-da-proposta-admite-o-texto-do-anuncio', now(),
        'check de copilot_propostas.tipo aberto para descricao e palavras_chave. A 057 criou a funcao que executa os dois, mas o check ainda listava cinco tipos: criarProposta falhava, a rota capturava, e a lojista via resposta sem botao. As duas pontas agora dizem a mesma coisa.')
on conflict do nothing;

-- ============================================================
-- Rollback logico
-- ============================================================
--   Voltar ao check de cinco tipos SO depois de nao haver proposta
--   pendente de descricao/palavras_chave — o alter falharia com elas na tabela.
