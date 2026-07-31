-- ============================================================
-- Zion OS — Migração 045: execução atômica do peso (INC-002, camada 5 / H3)
--
-- INCREMENTAL. Cria UMA função. Nenhuma tabela, coluna, policy ou grant de
-- tabela é alterado. A migração 044 e a coluna `autoridade` ficam intactas.
--
-- ============================================================
-- O DEFEITO — T1
-- ============================================================
--
-- `reservarParaExecucao` faz o CAS `pendente -> executada` E carimba
-- `executada_em` ANTES da mutação, numa transação separada da escrita. Entre as
-- duas há três idas ao PostgREST. Se o processo morrer nesse intervalo:
--
--     Proposal  = executada, executada_em preenchido
--     catálogo  = INTACTO
--     copilot_acoes = nenhuma linha
--     nova tentativa = recusada com HTTP 200 "Isso já foi feito"
--
-- Ou seja: a autorização do lojista é consumida, nada é gravado, e o sistema
-- afirma a ele que gravou. A única evidência é a AUSÊNCIA de linha de auditoria,
-- que ninguém consulta.
--
-- ============================================================
-- A INVARIANTE QUE ESTA FUNÇÃO ESTABELECE
-- ============================================================
--
--     status = 'executada'  ⇒  a mutação de peso correspondente COMMITOU
--
-- Não é "a janela ficou menor". A transição de status é a ÚLTIMA escrita da
-- MESMA transação que faz a mutação: não existe COMMIT em que uma exista sem a
-- outra. Qualquer falha antes do COMMIT reverte as duas, e a Proposal volta
-- intacta a `pendente` — reutilizável, em vez de queimada.
--
-- ============================================================
-- A PROPOSAL É A AUTORIZAÇÃO — POR ISSO OS PARÂMETROS SÃO DOIS
-- ============================================================
--
-- `valor`, `alvos` e os ids aprovados NÃO são parâmetros: são lidos da linha
-- persistida, SOB LOCK. Se fossem parâmetros, quem chama poderia combinar
-- "Proposal X + peso diferente" ou "Proposal X + outros produtos" e a função
-- executaria — a autorização passaria a ser o argumento, não o objeto aprovado.
--
-- `p_cliente` é a ÚNICA exceção, e é obrigatória: o tenant vem da SESSÃO, nunca
-- do objeto. Ele não autoriza nada — é CONFERIDO contra `cliente_id` da
-- Proposal, e divergir recusa. Derivá-lo da própria Proposal apagaria a
-- checagem que existe para pegar acesso cruzado.
--
-- ============================================================
-- SECURITY INVOKER, e não DEFINER
-- ============================================================
--
-- As funções `portal_*` são DEFINER porque o NAVEGADOR as chama e precisa
-- atravessar a RLS. Esta é chamada pelo servidor como `service_role`, que já tem
-- DML completo e `bypassrls`: DEFINER não acrescentaria capacidade nenhuma e
-- criaria uma superfície que, se um dia ganhasse GRANT para `authenticated`,
-- escreveria fora da RLS. INVOKER mantém o privilégio igual ao do chamador.
--
-- ============================================================
-- O QUE ESTA FUNÇÃO NÃO FAZ
-- ============================================================
--
-- Não revalida precondições nem `pesoConhecido`: isso continua acontecendo na
-- aplicação, antes da chamada. O TOCTOU da CAMADA 4 permanece aberto e é risco
-- conhecido e aceito — ver INC-002. Trazê-lo para cá seria resolver outro
-- problema de carona.
--
-- Não grava auditoria, procedência nem consequência. Elas seguem depois do
-- COMMIT, fora daqui, e continuam eventuais. Isto NÃO é atomicidade operacional
-- completa: é a garantia de que `executada` não mente sobre o catálogo.
--
-- Não serve custo, preço, título nem cadastro. `cadastro` em especial é
-- multi-statement, não idempotente e valida em TypeScript; forçá-lo aqui
-- exigiria reescrever `validarRascunho` em SQL com risco de semântica divergente.
-- ============================================================

create or replace function public.copilot_executar_peso(
  p_proposta uuid,
  p_cliente  uuid
)
returns table (motivo text, afetados integer, elegiveis integer)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_cliente      uuid;
  v_tipo         text;
  v_status       text;
  v_valor        numeric;
  v_alvos        uuid[];
  v_precond      jsonb;
  v_ids          uuid[];
  v_peso_kg      numeric;
  v_afetados     integer := 0;
  v_elegiveis    integer := 0;
begin
  -- 1. A EXCLUSIVIDADE. `FOR UPDATE` na linha da Proposal: duas execuções
  --    simultâneas da MESMA proposta não correm — a segunda espera, e ao
  --    entrar encontra `executada`. É mais forte que o CAS anterior, que
  --    dependia de a perdedora ver zero linhas atualizadas.
  select cliente_id, tipo, status, valor, alvos, precondicoes
    into v_cliente, v_tipo, v_status, v_valor, v_alvos, v_precond
    from public.copilot_propostas
   where id = p_proposta
     for update;

  if not found then
    return query select 'nao_encontrada'::text, 0, 0; return;
  end if;

  -- 2. O TENANT, conferido contra o objeto persistido.
  if v_cliente is distinct from p_cliente then
    return query select 'outro_tenant'::text, 0, 0; return;
  end if;

  -- 3. Esta função só sabe peso. Outro tipo aqui é erro de fiação, não recusa
  --    de negócio — e é melhor dizer isso do que executar algo parecido.
  if v_tipo is distinct from 'peso' then
    return query select 'tipo_invalido'::text, 0, 0; return;
  end if;

  -- 4. `ja_executada` ANTES de `status_invalido`: é o caso do duplo clique, e
  --    ele merece a frase própria que a rota já tem.
  if v_status = 'executada' then
    return query select 'ja_executada'::text, 0, 0; return;
  end if;
  if v_status is distinct from 'pendente' then
    return query select 'status_invalido'::text, 0, 0; return;
  end if;

  if v_alvos is null or array_length(v_alvos, 1) is null then
    return query select 'sem_alvos'::text, 0, 0; return;
  end if;

  -- 5. O CONJUNTO APROVADO (CICLO G.1), lido da Proposal.
  --
  --    AUSÊNCIA É CONTRATO LEGACY, NUNCA CONJUNTO VAZIO. `v_ids` nulo torna o
  --    predicado neutro lá embaixo — a escrita alcança o que alcançava antes
  --    deste contrato existir. Tratar ausência como vazio transformaria toda
  --    proposta antiga numa que não grava.
  select array_agg(distinct e::uuid)
    into v_ids
    from jsonb_array_elements(coalesce(v_precond, '[]'::jsonb)) c
    cross join lateral jsonb_array_elements_text(c->'idsAprovados') e
   where c->>'campo' like 'variacoesSemPeso:%';

  -- `valor` da Proposal é em GRAMAS; a coluna guarda KG.
  v_peso_kg := v_valor / 1000.0;

  -- 6. Quantas do conjunto aprovado ainda estavam elegíveis — para a ressalva
  --    do desfecho parcial não comparar a escrita com um universo que o
  --    lojista nunca viu.
  select count(*) into v_elegiveis
    from public.produto_variantes v
   where v.produto_id = any(v_alvos)
     and v.cliente_id = p_cliente
     and v.peso <= 0
     and (v_ids is null or v.id = any(v_ids));

  -- 7. A MUTAÇÃO, com todas as barreiras dos ciclos anteriores:
  --      cliente_id  o tenant da sessão
  --      produto_id  o escopo aprovado, da Proposal
  --      peso <= 0   PREENCHER, não SUBSTITUIR (INC-002)
  --      id          a IDENTIDADE do conjunto aprovado (CICLO G.1)
  --    Menos que o aprovado PODE ser escrito — a redução legítima continua
  --    permitida. Mais que o aprovado, nunca.
  update public.produto_variantes v
     set peso = v_peso_kg
   where v.produto_id = any(v_alvos)
     and v.cliente_id = p_cliente
     and v.peso <= 0
     and (v_ids is null or v.id = any(v_ids));
  get diagnostics v_afetados = row_count;

  -- 8. ZERO LINHAS NÃO É SUCESSO — e também não queima a proposta. O status
  --    não foi tocado, então ela continua `pendente` e o lojista pode tentar de
  --    novo com a MESMA autorização. É a mudança de comportamento em relação ao
  --    caminho antigo, que marcava `falhou`.
  if v_afetados = 0 then
    return query select 'nada_gravado'::text, 0, v_elegiveis; return;
  end if;

  -- 9. A TRANSIÇÃO, por último. Se qualquer coisa acima tivesse lançado, nada
  --    disto existiria — e é exatamente isso que elimina o T1.
  update public.copilot_propostas
     set status = 'executada',
         executada_em = now()
   where id = p_proposta;

  return query select 'ok'::text, v_afetados, v_elegiveis;
end;
$$;

comment on function public.copilot_executar_peso(uuid, uuid) is
  'Executa uma Proposal de PESO: trava a proposta, le dela os fatos autorizados (valor, alvos, idsAprovados), muta produto_variantes com as barreiras do INC-002/CICLO G.1 e so entao marca executada — tudo na MESMA transacao. status=executada passa a implicar mutacao commitada. NAO revalida precondicoes (camada 4 segue aberta) e NAO grava auditoria/procedencia/consequencia. Ver INC-002.';

-- ---------- grants: só quem precisa ----------

revoke all on function public.copilot_executar_peso(uuid, uuid) from public;
revoke all on function public.copilot_executar_peso(uuid, uuid) from anon;
revoke all on function public.copilot_executar_peso(uuid, uuid) from authenticated;
grant execute on function public.copilot_executar_peso(uuid, uuid) to service_role;

-- ---------- a prova ----------

do $$
declare
  v_sec  boolean;
  v_anon boolean;
  v_auth boolean;
  v_srv  boolean;
begin
  select p.prosecdef into v_sec from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'copilot_executar_peso';
  if v_sec then
    raise exception 'MIGRACAO 045: a funcao ficou SECURITY DEFINER. O desenho exige INVOKER.';
  end if;

  select has_function_privilege('anon',          'public.copilot_executar_peso(uuid,uuid)', 'execute') into v_anon;
  select has_function_privilege('authenticated', 'public.copilot_executar_peso(uuid,uuid)', 'execute') into v_auth;
  select has_function_privilege('service_role',  'public.copilot_executar_peso(uuid,uuid)', 'execute') into v_srv;

  if v_anon or v_auth then
    raise exception 'MIGRACAO 045: anon/authenticated conseguem executar a funcao. So o servidor deve.';
  end if;
  if not v_srv then
    raise exception 'MIGRACAO 045: service_role NAO consegue executar a funcao.';
  end if;

  raise notice '045 conferida: INVOKER, execute so para service_role.';
end $$;

-- ---------- a regra da 043, exercida por esta migração ----------

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('045', '045-execucao-atomica-do-peso', now(),
        'copilot_executar_peso: trava a proposta, muta o peso e marca executada na MESMA transacao; fecha o T1 para peso. Sem tabela, coluna, RLS ou backfill.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   drop function if exists public.copilot_executar_peso(uuid, uuid);
-- e reverter a rota para `reservarParaExecucao` + `gravar`. Nenhuma Proposal
-- precisa ser migrada: uma executada por aqui é indistinguível de uma executada
-- pelo caminho antigo.
-- ============================================================
