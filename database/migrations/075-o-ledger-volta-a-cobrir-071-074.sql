-- 075 — o ledger volta a cobrir a 071, a 072, a 073 e a 074
--
-- INCREMENTAL. NÃO destrutiva. Só escreve em `migracoes_aplicadas`.
--
-- ============================================================
-- O QUE ACONTECEU
-- ============================================================
--
-- A 043 fechou uma classe de erro com uma regra:
--
--   TODA MIGRAÇÃO DAQUI EM DIANTE INSERE A PRÓPRIA LINHA NO LEDGER, COMO
--   ÚLTIMA INSTRUÇÃO DO PRÓPRIO ARQUIVO.
--
-- E a regra explicava a si mesma: registrar num passo separado se esquece, e
-- quando esquece não acontece NADA — um ledger desatualizado não quebra tela
-- nenhuma. Foi assim que a 035 ficou dois dias fora do registro.
--
-- Quatro migrações seguidas — 071, 072, 073 e 074 — não trazem o insert. A
-- regra virou conteúdo de arquivo, mas nada conferia se o conteúdo estava lá,
-- então ela falhou exatamente do jeito silencioso que ela existe para impedir.
--
-- O buraco de processo foi fechado fora daqui, em `scripts/ledgerDasMigracoes.test.ts`:
-- o `npm run gate` agora recusa migração nova sem a própria linha. Este arquivo
-- cuida só do banco que já rodou as quatro sem registrá-las.
--
-- ============================================================
-- POR QUE ESTA MIGRAÇÃO NÃO INSERE AS QUATRO LINHAS DIRETO
-- ============================================================
--
-- Porque não sei se as quatro rodaram NESTE banco.
--
-- A 071 e a 072 dizem no cabeçalho "APLICADA em 2026-08-24 no projeto
-- principal". A 073 e a 074 não dizem nada — foram commitadas no mesmo dia, o
-- que é indício e não é prova.
--
-- E uma linha no ledger afirmando que uma migração rodou quando ela não rodou
-- é PIOR que a linha ausente. Ausente, alguém confere. Presente e falsa, o
-- ledger deixa de ser fonte de verdade e vira boato — que é o problema que a
-- 043 resolveu, de volta pela porta dos fundos.
--
-- Então cada linha nasce sob a condição que a própria 043 recomendou depois do
-- caso da 035: **conferir o schema em vez de acreditar no registro**. Se a
-- marca que a migração deixa não estiver no banco, a linha não é inserida.
--
--   071  a tabela `copilot_investigacoes` existe
--   072  o check de `copilot_propostas.tipo` aceita 'titulo_no_ml'
--   073  a coluna `ia_execucoes.ms_ferramentas` existe
--   074  a coluna `anuncios_gerados.tipo_anuncio_ml` existe
--
-- Num banco novo, que roda 001…074 em ordem, cada uma já terá inserido a
-- própria linha e todos os `on conflict do nothing` daqui viram no-op. Este
-- arquivo é para o banco que ficou no meio do caminho.
--
-- ============================================================
-- SOBRE `aplicada_em`
-- ============================================================
--
-- A data real de aplicação não é recuperável para uma linha reposta. Onde o
-- cabeçalho do arquivo a documenta (071 e 072), é ela que entra. Onde não
-- documenta (073 e 074), entra `now()` — e a `observacao` diz que a linha foi
-- reposta e que a data não é a da aplicação. Escrever uma data inventada seria
-- o mesmo erro de escrever uma linha inventada, num campo menor.

-- ============================================================
-- 071 — as investigações do Copilot
-- ============================================================

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
select '071', '071-as-investigacoes-do-copilot', timestamptz '2026-08-24 00:00:00-03',
       'copilot_investigacoes: a investigacao vira rascunho que atravessa turnos (como copilot_cadastros/037), porque dez a vinte operacoes nao cabem num turno HTTP de 45s. RLS: cliente a propria, agencia o escopo, equipe tudo. [linha reposta pela 075; data conforme o cabecalho do arquivo]'
where to_regclass('public.copilot_investigacoes') is not null
on conflict do nothing;

-- ============================================================
-- 072 — a correção do título num anúncio publicado
-- ============================================================

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
select '072', '072-a-correcao-do-titulo-no-anuncio', timestamptz '2026-08-24 00:00:00-03',
       'Check de copilot_propostas.tipo ganha titulo_no_ml — o primeiro caminho para mudar o CONTEUDO de um anuncio ja no ar (antes so criar, encerrar, pausar, reativar e trocar foto). Distinto de titulo, que muda so o catalogo do Zion. Sem tabela nova. [linha reposta pela 075; data conforme o cabecalho do arquivo]'
where exists (
  select 1 from pg_constraint
   where conrelid = 'public.copilot_propostas'::regclass
     and conname = 'copilot_propostas_tipo_check'
     and pg_get_constraintdef(oid) like '%titulo_no_ml%'
)
on conflict do nothing;

-- ============================================================
-- 073 — o tempo gasto em ferramenta
-- ============================================================

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
select '073', '073-o-tempo-gasto-em-ferramenta', now(),
       'ia_execucoes.ms_ferramentas: separa o turno em tempo DENTRO de ferramenta e tempo de modelo. Sem esse eixo, ms sozinho escondia a causa e a leitura de que latencia e volume de saida nao se sustentou. NULL = turno anterior a medicao, nao zero. [linha reposta pela 075; aplicada_em NAO e a data de aplicacao, que nao foi registrada]'
where exists (
  select 1 from information_schema.columns
   where table_schema = 'public' and table_name = 'ia_execucoes'
     and column_name = 'ms_ferramentas'
)
on conflict do nothing;

-- ============================================================
-- 074 — o que o ML diz e o Zion descartava
-- ============================================================

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
select '074', '074-o-que-o-ml-diz-e-o-zion-descartava', now(),
       'anuncios_gerados ganha sete campos que o ML ja mandava e a importacao descartava: tipo_anuncio_ml, criado_em_ml, atualizado_em_ml, vendidos_ml, saude_ml, do_catalogo_ml, tem_descricao_ml. O mais caro e tipo_anuncio_ml — a comissao saia da configuracao da loja inteira, e o ML informa por anuncio. [linha reposta pela 075; aplicada_em NAO e a data de aplicacao, que nao foi registrada]'
where exists (
  select 1 from information_schema.columns
   where table_schema = 'public' and table_name = 'anuncios_gerados'
     and column_name = 'tipo_anuncio_ml'
)
on conflict do nothing;

-- ============================================================
-- CONFERÊNCIA
-- ============================================================
--
-- Depois de rodar, isto tem que devolver as quatro linhas — ou explicar a
-- ausência de cada uma pela marca que faltou no schema:
--
--   select numero, nome, aplicada_em from public.migracoes_aplicadas
--    where numero in ('071','072','073','074') order by numero;
--
-- Uma ausência aqui NÃO é defeito desta migração: significa que aquela
-- migração não rodou neste banco, e o certo é rodá-la.

-- ============================================================
-- O LEDGER (regra da 043: a propria migracao registra a propria linha)
-- ============================================================

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('075', '075-o-ledger-volta-a-cobrir-071-074', now(),
        'Repoe no ledger as linhas das migracoes 071 a 074, que rodaram sem se registrar e furaram a regra da 043. Cada linha so nasce se a marca da migracao estiver no schema — linha falsa e pior que linha ausente. A reincidencia foi fechada no gate por scripts/ledgerDasMigracoes.test.ts.')
on conflict do nothing;
