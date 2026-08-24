-- 066 — o tipo da proposta admite a publicação
--
-- APLICADA em 2026-08-23 no projeto principal. Nasceu como arquivo
-- (auditoria do Copilot, 2026-08-22, roadmap NOW item 4).
--
-- O QUE MUDA
--
-- A publicação no Mercado Livre passa a ser uma Proposal (`tipo = 'publicacao'`,
-- risco `critico`): o pedido inteiro fica congelado em `texto`, a precondição é
-- a impressão do ensaio que a pessoa leu, e o clique publica o que foi salvo —
-- com expiração, idempotência de servidor e sem TOCTOU entre o cartão e o ML.
--
-- O check de `copilot_propostas.tipo` listava sete tipos. A 058 documentou o
-- sintoma de esquecer esta ponta: `criarProposta` falha, a rota captura, e a
-- lojista vê a resposta sem botão. Aqui é o mesmo: SEM esta migração, "publica
-- esse anúncio" responde sem cartão — por desenho, nunca com um cartão que
-- publica sem registro.
--
-- REVERTER: voltar ao check de sete tipos SÓ depois de não haver proposta
-- pendente de publicação — o alter falharia com elas na tabela.

alter table public.copilot_propostas
  drop constraint if exists copilot_propostas_tipo_check;

alter table public.copilot_propostas
  add constraint copilot_propostas_tipo_check
  check (tipo = any (array['peso'::text, 'custo'::text, 'cadastro'::text,
                           'titulo'::text, 'preco'::text,
                           'descricao'::text, 'palavras_chave'::text,
                           'publicacao'::text]));

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('066', '066-o-tipo-da-proposta-admite-a-publicacao', now(),
        'check de copilot_propostas.tipo aberto para publicacao. A publicacao no ML vira Proposal (risco critico): pedido congelado em texto, precondicao = impressao do ensaio, execucao a partir do que foi salvo. Sem esta migracao o chat responde sem cartao de publicar.')
on conflict do nothing;
