-- 072 — a correção do TÍTULO num anúncio publicado
--
-- NÃO APLICADA. Nasce como arquivo, para o dono aplicar (Operador Universal,
-- 2026-08-24, etapa 7 do plano).
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
