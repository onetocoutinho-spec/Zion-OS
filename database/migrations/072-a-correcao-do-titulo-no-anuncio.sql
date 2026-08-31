-- 072 — a correção do TÍTULO num anúncio publicado
--
-- APLICADA em 2026-08-24 no projeto principal, a pedido do dono (Operador
-- Universal, etapa 7 do plano). Não cria tabela: só amplia o CHECK, então a
-- varredura de alcance da agência não muda.
--
-- ===========================================================================
-- O QUE ESTA MIGRAÇÃO AUTORIZA
-- ===========================================================================
--
-- Um tipo novo de proposta: `titulo_no_ml`. Ele é o primeiro caminho do
-- projeto para mudar o CONTEÚDO de um anúncio que já está no ar — até aqui o
-- Zion sabia criar, encerrar, pausar, reativar e trocar fotos, e nada mais.
-- Corrigir um título errado exigia encerrar e republicar, perdendo histórico,
-- reputação e relevância na busca.
--
-- ===========================================================================
-- POR QUE UM TIPO NOVO, E NÃO O `titulo` QUE JÁ EXISTE
-- ===========================================================================
--
-- São escritas em lugares diferentes, com consequências diferentes:
--
--   `titulo`        muda o título no CATÁLOGO DO ZION. Ninguém de fora vê.
--   `titulo_no_ml`  muda o que o COMPRADOR vê, agora, no Mercado Livre.
--
-- Misturá-los faria a auditoria não conseguir distinguir "corrigiu o cadastro"
-- de "mexeu no anúncio no ar" — e são justamente essas duas linhas que alguém
-- vai querer separar no dia em que um título aparecer errado para o comprador.
--
-- Risco `alto`, não `critico`: diferente de publicar, trocar título é
-- reversível (o texto antigo volta) e não move dinheiro. `alto` já exige que
-- quem confirma seja quem pediu (ver `podeExecutar`).
--
-- ===========================================================================
-- A VERIFICAÇÃO É PARTE DA EXECUÇÃO, NÃO UM EXTRA
-- ===========================================================================
--
-- O caminho `PUT /items/{id}` com `{title}` não foi medido contra a API real
-- deste projeto. Por isso a execução RELÊ o anúncio e compara antes de
-- afirmar qualquer coisa; quando não consegue reler, a resposta é "enviei, mas
-- não consegui confirmar". Ver `correcaoNoAnuncio.ts` e `tituloNoAnuncio.ts`.

alter table public.copilot_propostas
  drop constraint if exists copilot_propostas_tipo_check;

alter table public.copilot_propostas
  add constraint copilot_propostas_tipo_check
  check (tipo = any (array['peso'::text, 'custo'::text, 'cadastro'::text,
                           'titulo'::text, 'preco'::text,
                           'descricao'::text, 'palavras_chave'::text,
                           'publicacao'::text, 'tarefas'::text, 'imagem'::text,
                           'titulo_no_ml'::text]));

-- Sem tabela nova: não há política para escrever, e a varredura
-- database/verificacoes/alcance-da-agencia.sql não muda.

-- ============================================================
-- O LEDGER (regra da 043: a propria migracao registra a propria linha)
-- ============================================================

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('072', '072-a-correcao-do-titulo-no-anuncio', now(),
        'Check de copilot_propostas.tipo ganha titulo_no_ml — o primeiro caminho para mudar o CONTEUDO de um anuncio ja no ar (antes so criar, encerrar, pausar, reativar e trocar foto). Distinto de titulo, que muda so o catalogo do Zion. Sem tabela nova.')
on conflict do nothing;
