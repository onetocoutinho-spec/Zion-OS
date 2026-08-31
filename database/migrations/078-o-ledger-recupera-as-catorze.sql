-- ============================================================
-- Zion OS — Migração 078: o ledger recupera as catorze que não se registraram
--
-- INCREMENTAL, IDEMPOTENTE e NÃO DESTRUTIVA. Só escreve em
-- `migracoes_aplicadas`, e só onde há evidência.
--
-- ============================================================
-- O QUE SE DESCOBRIU (INC-012, 2026-08-25)
-- ============================================================
--
-- A 024 declarou a convenção do programa: *"toda migração DEVE terminar com o
-- próprio INSERT em migracoes_aplicadas"*.
--
-- Catorze não terminam:
--
--     035 036 037 038 039 040 041 042      (oito seguidas)
--     071 072 073 074 075 076              (as seis últimas)
--
-- Por isso o ledger de produção parava na 070 enquanto o banco estava na 076.
-- A primeira leitura disso foi "seis aplicadas sem linha", como descuido de
-- operação. Não era: os arquivos nunca se registraram. O ledger contou
-- fielmente o que lhe deram.
--
-- Uma convenção que catorze arquivos ignoram não é convenção — e um ledger que
-- é tratado como fonte de verdade sendo alimentado por metade das migrações é
-- pior que nenhum, porque ninguém desconfia dele.
--
-- ============================================================
-- POR QUE UMA BASELINE, E NÃO EDITAR OS CATORZE ARQUIVOS
-- ============================================================
--
-- A própria 024 já respondeu isto quando registrou 001–016, 022 e 023:
--
--     "Migrações anteriores são DOCUMENTOS HISTÓRICOS — não são alteradas
--      retroativamente; o estado delas entra pelo baseline abaixo, registrado
--      EXCLUSIVAMENTE por evidência, nunca por suposição."
--
-- Editar os catorze faria os arquivos mentirem sobre o que rodou naquele dia,
-- e ainda assim não consertaria banco nenhum — arquivo não roda sozinho.
--
-- ============================================================
-- EVIDÊNCIA, E O QUE ELA PROVA DE VERDADE
-- ============================================================
--
-- Cada linha abaixo só entra se o ARTEFATO dela existir neste banco. Onde o
-- artefato não existe, não há linha — e a ausência continua significando "não
-- foi aplicada", que é o que o ledger existe para dizer.
--
-- Duas evidências (040 e 072) são CHECKs que migrações posteriores reescrevem
-- mantendo o valor. Elas provam que o EFEITO está presente, não que aquele
-- arquivo específico rodou. É a mesma disciplina — e a mesma limitação — do
-- baseline da 024, e está dita aqui para ninguém ler mais do que está escrito.
--
-- ============================================================
-- REVERTER
-- ============================================================
--
--   delete from public.migracoes_aplicadas
--    where numero in ('035','036','037','038','039','040','041','042',
--                     '071','072','073','074','075','076','078');
-- ============================================================

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
select v.numero, v.nome, now(), v.observacao
  from (values
    ('035', '035-copilot-propostas-e-conversas',
     to_regclass('public.copilot_conversas') is not null,
     'baseline 078: tabela copilot_conversas presente'),

    ('036', '036-indices-para-busca-forte',
     to_regclass('public.idx_variantes_cliente_ean') is not null,
     'baseline 078: indice idx_variantes_cliente_ean presente'),

    ('037', '037-cadastro-conversacional',
     to_regclass('public.copilot_cadastros') is not null,
     'baseline 078: tabela copilot_cadastros presente'),

    ('038', '038-procedencia-de-campo',
     to_regclass('public.procedencia_de_campo') is not null,
     'baseline 078: tabela procedencia_de_campo presente'),

    ('039', '039-proposta-de-titulo',
     exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'copilot_propostas'
                and column_name = 'texto'),
     'baseline 078: coluna copilot_propostas.texto presente'),

    ('040', '040-proposta-de-preco',
     exists (select 1 from pg_constraint
              where conrelid = to_regclass('public.copilot_propostas')
                and conname = 'copilot_propostas_tipo_check'
                and pg_get_constraintdef(oid) like '%preco%'),
     'baseline 078: o CHECK de tipo aceita preco. EFEITO presente — migracoes posteriores reescrevem este CHECK mantendo o valor, entao isto nao prova que a 040 especificamente rodou'),

    ('041', '041-fecha-o-rls-que-a-005-nao-fechou',
     not exists (select 1 from pg_policies
                  where schemaname = 'public' and policyname = 'equipe_autenticada')
     and exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'produtos'
                    and policyname = 'equipe_total'),
     'baseline 078: nenhuma politica equipe_autenticada restante e equipe_total presente — as duas metades que a propria 041 confere'),

    ('042', '042-folgas-de-superficie',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'set_updated_at'
                and p.proconfig is not null
                and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')),
     'baseline 078: set_updated_at com search_path fixo'),

    ('071', '071-as-investigacoes-do-copilot',
     to_regclass('public.copilot_investigacoes') is not null,
     'baseline 078: tabela copilot_investigacoes presente'),

    ('072', '072-a-correcao-do-titulo-no-anuncio',
     exists (select 1 from pg_constraint
              where conrelid = to_regclass('public.copilot_propostas')
                and conname = 'copilot_propostas_tipo_check'
                and pg_get_constraintdef(oid) like '%titulo_no_ml%'),
     'baseline 078: o CHECK de tipo aceita titulo_no_ml. EFEITO presente — ver a ressalva da 040'),

    ('073', '073-o-tempo-gasto-em-ferramenta',
     exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'ia_execucoes'
                and column_name = 'ms_ferramentas'),
     'baseline 078: coluna ia_execucoes.ms_ferramentas presente'),

    ('074', '074-o-que-o-ml-diz-e-o-zion-descartava',
     exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'anuncios_gerados'
                and column_name = 'saude_ml'),
     'baseline 078: coluna anuncios_gerados.saude_ml presente'),

    ('075', '075-a-dimensao-da-foto-para-de-se-perder',
     exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'imagens_produto'
                and column_name = 'altura'),
     'baseline 078: coluna imagens_produto.altura presente'),

    ('076', '076-a-foto-passa-a-saber-de-que-cor-e',
     exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'imagens_produto'
                and column_name = 'cor'),
     'baseline 078: coluna imagens_produto.cor presente')
  ) as v(numero, nome, tem_evidencia, observacao)
 where v.tem_evidencia
on conflict (numero) do nothing;

-- ------------------------------------------------------------
-- O RELATÓRIO. Não levanta exceção: num banco onde alguma das catorze
-- realmente não rodou, a ausência de linha é a resposta CERTA, não uma falha.
-- Levantar aqui obrigaria a mentir para a migração passar.
-- ------------------------------------------------------------
do $$
declare
  registradas int;
  faltando    text;
begin
  select count(*), string_agg(n, ', ' order by n)
    into registradas, faltando
    from unnest(array['035','036','037','038','039','040','041','042',
                      '071','072','073','074','075','076']) as t(n)
   where not exists (select 1 from public.migracoes_aplicadas m where m.numero = t.n);

  if registradas = 0 then
    raise notice '078: as catorze estao no ledger.';
  else
    raise notice '078: % das catorze seguem SEM linha (%) — sem evidencia neste banco, e a ausencia e a resposta certa.',
      registradas, faltando;
  end if;
end $$;

-- ★ Auto-registro (a convenção que esta migração existe para reparar).
insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('078', '078-o-ledger-recupera-as-catorze', now(),
        'Baseline por evidencia para 035-042 e 071-076, que nunca se registraram apesar da convencao declarada na 024 — foi por isso que o ledger de producao parava na 070 com o banco na 076 (INC-012). Cada linha so entra se o artefato dela existir NESTE banco; onde nao existe, a ausencia continua significando "nao aplicada". Os catorze arquivos NAO foram alterados: migracao antiga e documento historico, e o estado dela entra por baseline — a mesma regra que a 024 usou para 001-016. Evidencias de 040 e 072 sao CHECKs reescritos por migracoes posteriores: provam o efeito, nao a execucao daquele arquivo.')
on conflict (numero) do nothing;
