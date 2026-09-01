-- ============================================================
-- Zion OS — Migração 077: a coluna que nenhuma migração criou, e as três
-- funções que leem uma tabela que ninguém preenche mais
--
-- INCREMENTAL, IDEMPOTENTE e DESTRUTIVA — leia a recusa abaixo antes de rodar.
--
-- ============================================================
-- COMO OS DOIS APARECERAM (INC-012, medido em 2026-08-25)
-- ============================================================
--
-- O staging foi reconstruído aplicando as 58 migrações que faltavam, e o
-- esquema dele foi comparado com o de produção. As 52 tabelas bateram coluna
-- por coluna. Duas diferenças sobraram, e nenhuma era erro de transcrição:
--
--   produção tem  `produtos.cod_magazord`, que NENHUMA migração cria
--   staging tem   portal_resumo, portal_proximas_acoes e portal_anuncios,
--                 que a migração 005 cria e produção não tem
--
-- Nada disso era visível enquanto existia um banco só: o esquema real era, por
-- definição, o esquema certo.
--
-- ============================================================
-- 1. `cod_magazord` — criada à mão, nunca escrita, sempre vazia
-- ============================================================
--
-- Não aparece em nenhum arquivo de `database/`. O único `cod_magazord` do
-- repositório está em `importacaoProdutos.ts` e é um APELIDO DE CABEÇALHO de
-- planilha que mapeia para `codErp` — não tem relação com esta coluna.
--
-- Medida em 25/08/2026, duas vezes: 0 valores em 72 produtos.
--
-- ============================================================
-- 2. As três funções do portal — leem `tarefas`, que ninguém preenche
-- ============================================================
--
-- A 005 as criou para o Portal do Cliente. `portal_proximas_acoes` lê
-- `tarefas`, que SÓ a equipe da Zion preenchia — e a agência não existe mais
-- (ver `docs/intent/zion-os.md`). Em produção elas já tinham sido removidas
-- sem migração; aqui isso vira decisão escrita, e o staging fica igual.
--
-- O código que as chamava sai no mesmo commit: `perfil.ts` perde os três
-- wrappers e `cliente/page.tsx` perde a seção "Recados". Quem diz o que fazer
-- na loja é "O que falta", derivado dos dados.
--
-- ============================================================
-- REVERTER
-- ============================================================
--
--   alter table public.produtos add column if not exists cod_magazord text;
--   -- as três funções: rode de novo o bloco correspondente da 005.
--   delete from public.migracoes_aplicadas where numero = '077';
--
-- A coluna volta VAZIA, que é como ela estava — não há dado a restaurar.
-- ============================================================

-- ------------------------------------------------------------
-- A RECUSA. Esta migração foi escrita sobre uma medição: a coluna estava
-- vazia. Se em outro banco (ou noutro dia) alguém tiver passado a gravar nela,
-- apagar deixa de ser barato — e a migração para, em vez de decidir sozinha.
-- ------------------------------------------------------------
do $$
declare
  com_valor int;
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'produtos' and column_name = 'cod_magazord'
  ) then
    execute $q$ select count(*) from public.produtos
                 where btrim(coalesce(cod_magazord::text, '')) <> '' $q$
      into com_valor;
    if com_valor > 0 then
      raise exception
        'MIGRACAO 077 RECUSADA: cod_magazord tem % valor(es). Foi medida VAZIA em 25/08/2026; se alguem passou a gravar, decida o que fazer com o dado antes de apagar a coluna.',
        com_valor;
    end if;
  end if;
end $$;

alter table public.produtos drop column if exists cod_magazord;

drop function if exists public.portal_resumo();
drop function if exists public.portal_proximas_acoes();
drop function if exists public.portal_anuncios();

-- ------------------------------------------------------------
-- A CONFERÊNCIA. A migração prova o próprio efeito, como as 041–064 fazem.
-- ------------------------------------------------------------
do $$
declare
  sobrou_coluna int;
  sobrou_funcao int;
begin
  select count(*) into sobrou_coluna
    from information_schema.columns
   where table_schema = 'public' and table_name = 'produtos' and column_name = 'cod_magazord';
  if sobrou_coluna > 0 then
    raise exception 'MIGRACAO 077 INCOMPLETA: produtos.cod_magazord ainda existe.';
  end if;

  select count(*) into sobrou_funcao
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('portal_resumo', 'portal_proximas_acoes', 'portal_anuncios');
  if sobrou_funcao > 0 then
    raise exception 'MIGRACAO 077 INCOMPLETA: % funcao(oes) do portal ainda existem.', sobrou_funcao;
  end if;

  -- As sobrecargas com p_cliente_id (064) e as irmãs do portal NÃO são assunto
  -- desta migração. Se sumirem junto, a loja perde margem e custos.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'portal_margem_minima'
  ) then
    raise exception 'MIGRACAO 077 QUEBROU O PORTAL: portal_margem_minima sumiu junto.';
  end if;

  raise notice '077 conferida: coluna fora, tres funcoes fora, o resto do portal intacto.';
end $$;

-- ★ Auto-registro (convenção ≥024, que catorze migrações deixaram de honrar —
--   ver INC-012. Esta honra.)
insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('077', '077-a-coluna-sem-migracao-e-as-funcoes-sem-tabela', now(),
        'DROP de produtos.cod_magazord (criada a mao, fora de toda migracao, medida vazia em 0 de 72 produtos) e das tres funcoes do portal da 005 (portal_resumo, portal_proximas_acoes, portal_anuncios), que leem `tarefas` — tabela que so a equipe preenchia, e a agencia nao existe mais. Producao ja nao tinha as funcoes (removidas sem migracao); isto torna a remocao escrita e alinha o staging. Recusa se a coluna tiver ganhado valor desde a medicao. O codigo que chamava as tres sai no mesmo commit.')
on conflict (numero) do nothing;
