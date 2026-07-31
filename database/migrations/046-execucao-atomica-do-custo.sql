-- ============================================================
-- Zion OS — Migração 046: execução atômica do custo (INC-002, camada 5 / H3)
--
-- INCREMENTAL. Cria UMA função. Nenhuma tabela, coluna, policy ou grant de
-- tabela muda. As migrações 044 e 045 ficam intactas.
--
-- ============================================================
-- O MESMO DEFEITO DA 045, NO OUTRO TIPO
-- ============================================================
--
-- Custo continuava no caminho antigo: `reservarParaExecucao` marcava
-- `pendente -> executada` e carimbava `executada_em` ANTES da mutação, em
-- transação separada. Morte no intervalo consumia a autorização, deixava o
-- custo antigo no catálogo, e a próxima tentativa recebia "Isso já foi feito".
--
-- A 045 fechou isso para peso. Esta fecha para custo, com a MESMA forma.
--
--     status = 'executada'  ⇒  o custo correspondente COMMITOU
--
-- ============================================================
-- O QUE DIFERE DA 045, E POR QUÊ
-- ============================================================
--
-- Custo não tem conjunto congelado nem `peso <= 0`:
--
--   * a proposta atinge UM produto (`alvos[1]`), não uma lista de variantes;
--   * custo SUBSTITUI — trocar um custo é o objetivo, não preencher um vazio.
--     Não existe predicado de "só se estiver em branco", e inventar um mudaria
--     a semântica do domínio;
--   * por isso não há `elegiveis`: o UPDATE afeta 0 ou 1 linha, e a ressalva de
--     preenchimento parcial (`desfechoDoPreenchimento`) não se aplica —
--     devolver um `elegiveis` aqui faria a mensagem falar de parcialidade que
--     não existe neste tipo.
--
-- O que NÃO difere: a proposta é lida sob lock, `valor` e `alvos` vêm dela e
-- não de argumento, o tenant vem da sessão e é conferido, e a transição de
-- status é a ÚLTIMA escrita da MESMA transação.
--
-- ============================================================
-- O QUE ESTA FUNÇÃO NÃO FAZ
-- ============================================================
--
-- Não revalida a precondição de custo — isso continua na aplicação, antes da
-- chamada, como no peso. Não grava auditoria, procedência nem consequência:
-- seguem depois do COMMIT, fora daqui, e continuam eventuais.
--
-- Não serve preço, título nem cadastro. `cadastro` em especial é
-- multi-statement, não idempotente e valida em TypeScript.
-- ============================================================

create or replace function public.copilot_executar_custo(
  p_proposta uuid,
  p_cliente  uuid
)
returns table (motivo text, afetados integer)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_cliente   uuid;
  v_tipo      text;
  v_status    text;
  v_valor     numeric;
  v_alvos     uuid[];
  v_produto   uuid;
  v_afetados  integer := 0;
begin
  -- 1. A EXCLUSIVIDADE, igual à 045: duas execuções da mesma proposta não
  --    correm — a segunda espera e encontra `executada`.
  select cliente_id, tipo, status, valor, alvos
    into v_cliente, v_tipo, v_status, v_valor, v_alvos
    from public.copilot_propostas
   where id = p_proposta
     for update;

  if not found then return query select 'nao_encontrada'::text, 0; return; end if;

  -- 2. O TENANT vem da SESSÃO e é CONFERIDO contra o objeto persistido. Ele não
  --    autoriza; ele recusa.
  if v_cliente is distinct from p_cliente then return query select 'outro_tenant'::text, 0; return; end if;

  if v_tipo is distinct from 'custo' then return query select 'tipo_invalido'::text, 0; return; end if;
  if v_status = 'executada' then return query select 'ja_executada'::text, 0; return; end if;
  if v_status is distinct from 'pendente' then return query select 'status_invalido'::text, 0; return; end if;

  if v_alvos is null or array_length(v_alvos, 1) is null then
    return query select 'sem_alvos'::text, 0; return;
  end if;
  v_produto := v_alvos[1];

  -- 3. A MUTAÇÃO. `valor` sai da Proposal, em REAIS — a unidade canônica da
  --    coluna. Sem conversão, como no caminho que esta função substitui.
  update public.produtos
     set custo = v_valor
   where id = v_produto
     and cliente_id = p_cliente;
  get diagnostics v_afetados = row_count;

  -- 4. ZERO LINHAS NÃO É SUCESSO — e não queima a proposta. O produto sumiu ou
  --    é de outro tenant; o status não foi tocado, então ela continua
  --    `pendente` e pode ser tentada de novo com a MESMA autorização.
  if v_afetados = 0 then
    return query select 'nada_gravado'::text, 0; return;
  end if;

  -- 5. A TRANSIÇÃO, por último. Qualquer falha acima teria revertido tudo —
  --    inclusive isto. É o que elimina o T1 para custo.
  update public.copilot_propostas
     set status = 'executada',
         executada_em = now()
   where id = p_proposta;

  return query select 'ok'::text, v_afetados;
end;
$$;

comment on function public.copilot_executar_custo(uuid, uuid) is
  'Executa uma Proposal de CUSTO: trava a proposta, le dela os fatos autorizados (valor, alvos), grava produtos.custo com o tenant da sessao conferido, e so entao marca executada — tudo na MESMA transacao. status=executada passa a implicar mutacao commitada. Custo SUBSTITUI (nao ha predicado de vazio) e nao tem conjunto congelado nem elegiveis. NAO revalida precondicoes e NAO grava auditoria/procedencia/consequencia. Ver INC-002.';

-- ---------- grants: só quem precisa ----------

revoke all on function public.copilot_executar_custo(uuid, uuid) from public;
revoke all on function public.copilot_executar_custo(uuid, uuid) from anon;
revoke all on function public.copilot_executar_custo(uuid, uuid) from authenticated;
grant execute on function public.copilot_executar_custo(uuid, uuid) to service_role;

-- ---------- a prova ----------

do $$
declare v_sec boolean; v_anon boolean; v_auth boolean; v_srv boolean;
begin
  select p.prosecdef into v_sec from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'copilot_executar_custo';
  if v_sec then
    raise exception 'MIGRACAO 046: a funcao ficou SECURITY DEFINER. O desenho exige INVOKER.';
  end if;

  select has_function_privilege('anon',          'public.copilot_executar_custo(uuid,uuid)', 'execute') into v_anon;
  select has_function_privilege('authenticated', 'public.copilot_executar_custo(uuid,uuid)', 'execute') into v_auth;
  select has_function_privilege('service_role',  'public.copilot_executar_custo(uuid,uuid)', 'execute') into v_srv;

  if v_anon or v_auth then
    raise exception 'MIGRACAO 046: anon/authenticated conseguem executar a funcao. So o servidor deve.';
  end if;
  if not v_srv then
    raise exception 'MIGRACAO 046: service_role NAO consegue executar a funcao.';
  end if;

  -- A 045 nao pode ter sido tocada por esta migracao.
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'copilot_executar_peso') then
    raise exception 'MIGRACAO 046: a funcao da 045 sumiu.';
  end if;

  raise notice '046 conferida: INVOKER, execute so para service_role, 045 intacta.';
end $$;

-- ---------- a regra da 043, exercida por esta migração ----------

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('046', '046-execucao-atomica-do-custo', now(),
        'copilot_executar_custo: trava a proposta, grava o custo e marca executada na MESMA transacao; fecha o T1 para custo. Sem tabela, coluna, RLS ou backfill.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   drop function if exists public.copilot_executar_custo(uuid, uuid);
-- e reverter o ramo de custo na rota para `reservarParaExecucao` + `gravar`.
-- Nenhuma Proposal precisa ser migrada.
-- ============================================================
