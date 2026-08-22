-- O alcance da agência é uma CLASSIFICAÇÃO, e esta é a única cópia dela.
--
-- ============================================================
-- POR QUE ESTE ARQUIVO EXISTE
-- ============================================================
--
-- A regra é uma frase: **a agência alcança o que ela OPERA.**
--
-- Em 07/08 essa frase estava escrita em três lugares que não se conhecem — o
-- laço da migração 054, a lista do menu (`navDoPapel`) e três `drop policy`
-- avulsos (055a, 055b). Três cópias de uma regra divergem; é só questão de
-- quando.
--
-- Aqui a classificação é DADO, e a consulta compara o banco contra ela. Uma
-- tabela que ninguém classificou aparece como divergência — não como silêncio.
--
-- ============================================================
-- AS DUAS DIREÇÕES, E NENHUMA É "SÓ CHATA"
-- ============================================================
--
-- SOBRA (tem a política e não devia):
--   vazamento. Foi o caso de `financeiro`, que guarda `valor_mensal`,
--   `custo_operacional` e `lucro_estimado` — a margem da Zion sobre o cliente.
--
-- FALTA (é operação e não tem):
--   a agência perde um pedaço do produto EM SILÊNCIO. O sintoma na tela é
--   "esta parte está vazia", que se lê como defeito e não como permissão.
--
--   E este é o caso PROVÁVEL, ao contrário do que eu supus: o laço da 054
--   rodou UMA VEZ. Medido em 07/08 criando uma tabela nova numa transação —
--   ela nasce com ZERO políticas. Toda tabela criada daqui para frente precisa
--   da política escrita na própria migração, ou some do painel da agência.
--
-- ============================================================
-- QUANDO RODAR
-- ============================================================
--
-- Depois de QUALQUER migração que crie tabela com `cliente_id` ou mexa em RLS.
-- É leitura pura: não escreve nada, não precisa de transação.

with classificacao(tabela, e_operacao, motivo) as (values
  -- ---------------------------------------------------------------
  -- É OPERAÇÃO DA LOJA — a agência alcança
  -- ---------------------------------------------------------------
  ('anuncio_variantes',       true,  'a grade do anúncio'),
  ('anuncios',                true,  'o anúncio'),
  ('anuncios_gerados',        true,  'o que a IA escreveu'),
  ('auditorias_anuncios',     true,  'o diagnóstico do anúncio'),
  ('copilot_acoes',           true,  'o que o copiloto fez na loja'),
  ('copilot_cadastros',       true,  'cadastro por conversa'),
  ('copilot_conversas',       true,  'a conversa sobre a loja'),
  ('copilot_mensagens',       true,  'idem'),
  ('copilot_propostas',       true,  'proposta de preço/título a confirmar'),
  ('execucoes_lote',          true,  'o lote que ela rodou'),
  ('fila_otimizacao',         true,  'a fila da loja'),
  ('fila_otimizacao_produto', true,  'idem, por produto'),
  ('imagens_produto',         true,  'as fotos'),
  ('importacoes_anuncios',    true,  'a importação do ML'),
  ('infracoes_marketplace',   true,  'o que o ML apontou'),
  ('onboardings',             true,  'a preparação DA LOJA (não é nota da Zion)'),
  ('pendencias',              true,  'o que falta na loja'),
  ('precificacao_variantes',  true,  'preço por variação'),
  ('procedencia_de_campo',    true,  'de onde veio cada campo'),
  ('produto_atributos',       true,  'a ficha técnica'),
  ('produto_variantes',       true,  'a grade'),
  ('produtos',                true,  'o catálogo'),
  ('relatorios',              true,  'o relatório da loja'),
  ('tabelas_medidas',         true,  'a tabela de tamanhos'),
  ('consumo_ia',              true,  'o ledger de cota da loja: quantas chamadas de IA ela ja gastou no mes. A agencia precisa disso para explicar "acabou a cota". SO LEITURA — escreve so o servidor (060)'),
  ('ia_execucoes',            true,  'o que cada chamada de IA da loja custou: modelo, tokens, latencia, desfecho. A agencia precisa disso para responder "quanto custa esta loja". SO LEITURA — escreve so o servidor (067); a politica agencia_escopo (SELECT) nasce na propria 067'),
  ('ia_precos_modelo',        false, 'sem cliente_id: a tabela de precos por modelo e da Zion, nao de uma loja. So a equipe le e escreve (067)'),
  ('perfis_de_conteudo',      true,  'como a loja vende: tom, publico, palavras preferidas/proibidas. A agencia escreve conteudo em nome da loja e precisa ler e editar isto (068)'),
  ('tarefas_da_loja',         true,  'a lista do que a LOJA decidiu fazer (nao e a tabela tarefas, que e nota da Zion — 055b). A agencia opera a loja e ve/conclui as tarefas dela (069)',
  ('imagens_versoes',         true,  'os rascunhos de imagem gerados pela IA para a loja, com briefing e feedback. A agencia gera e aprova imagem em nome da loja. SO LEITURA — escreve so o servidor (070)'),

  -- ---------------------------------------------------------------
  -- NÃO É OPERAÇÃO — a agência NÃO alcança
  -- ---------------------------------------------------------------
  ('financeiro', false, 'valor_mensal, custo_operacional, lucro_estimado: a margem da ZION sobre o cliente. Vazamento da Zion PARA o cliente, não entre clientes (055a)'),
  ('tarefas',    false, 'notas da Zion SOBRE o cliente: responsavel, prazo, proxima_acao. O que a loja precisa fazer vem de lacunasDaLoja, derivado dos dados (055b)'),
  ('reunioes',   false, 'pauta e horário de quem ATENDE, não de quem é atendido (055b)'),
  ('perfis',     false, 'identidade não é operação. Uma agência não precisa da lista de e-mails para otimizar anúncios (054, fora do laço)'),
  ('ml_conexoes_pendentes', false, 'tickets de OAuth em voo. Tem políticas PRÓPRIAS, mais estreitas: só o próprio ticket, e sem update/delete (055)'),
  ('canais_marketplace', false, 'guarda o refresh_token da conta do lojista no ML: CREDENCIAL, não operação. Com ela a agência opera a conta FORA do produto e depois do contrato. A agência publica pelas rotas /api/ml/*, que leem o canal no servidor. A coluna também saiu do GRANT de authenticated (059)')
),
reais as (
  select c.relname as tabela,
         coalesce(bool_or(p.policyname = 'agencia_escopo'), false) as tem_politica
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_policies p on p.tablename = c.relname and p.schemaname = 'public'
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and exists (select 1 from information_schema.columns ic
                  where ic.table_schema = 'public'
                    and ic.table_name = c.relname
                    and ic.column_name = 'cliente_id')
   group by c.relname
)
select
  coalesce(r.tabela, cl.tabela) as tabela,
  case
    when cl.tabela is null then 'NAO CLASSIFICADA — decida se e operacao e ponha na lista'
    when r.tabela is null  then 'CLASSIFICADA mas nao existe mais — tire da lista'
    when cl.e_operacao and not r.tem_politica
      then 'FALTA a politica — a agencia perde esta parte do produto em silencio'
    when not cl.e_operacao and r.tem_politica
      then 'SOBRA a politica — VAZAMENTO: ' || cl.motivo
    else null
  end as divergencia
from reais r
full outer join classificacao cl on cl.tabela = r.tabela
where cl.tabela is null
   or r.tabela is null
   or cl.e_operacao <> r.tem_politica
order by 1;

-- ESPERA-SE ZERO LINHAS.
--
-- Qualquer linha é uma decisão que ninguém tomou: ou a tabela nova não foi
-- classificada, ou a classificação e o banco discordam. Nos dois casos o
-- conserto é o mesmo — decidir, e escrever a decisão aqui.
