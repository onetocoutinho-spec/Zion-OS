-- ============================================================
-- Zion OS — Migração 047: execução atômica do preço (INC-002, camada 5 / H3)
--
-- INCREMENTAL. Cria UMA função. Nenhuma tabela, coluna, policy ou grant de
-- tabela muda. As migrações 044, 045 e 046 ficam intactas.
--
-- ============================================================
-- O MESMO DEFEITO, NO ÚLTIMO TIPO DE CAMPO SIMPLES
-- ============================================================
--
-- Preço continuava no caminho antigo: `reservarParaExecucao` marcava
-- `pendente -> executada` e carimbava `executada_em` ANTES da mutação, em
-- transação separada. Morte no intervalo consumia a autorização, deixava o
-- preço antigo no catálogo, e a próxima tentativa recebia "Isso já foi feito".
--
--     status = 'executada'  ⇒  o preço correspondente COMMITOU
--
-- ============================================================
-- POR QUE ESTA FUNÇÃO TEM UM TERCEIRO PARÂMETRO
-- ============================================================
--
-- A 045 e a 046 recebem só `(proposta, cliente)` porque tudo o que escrevem
-- está na Proposal. Aqui não: a escrita toca DUAS colunas — `preco_venda` e
-- `margem` — e a margem NÃO está na Proposal.
--
-- `margem = margemLiquida(custo, preco, taxas)` é calculada em TypeScript, e
-- depende do modelo de tarifas do ML: ~470 linhas entre `modeloPreco.ts` e
-- `custosML.ts`, incluindo a tabela de frete encodada. Portar isso para SQL
-- criaria DUAS implementações da mesma conta, e a divergência entre elas
-- apareceria como um número errado numa tela — exatamente o defeito que
-- `embalagemDoProduto` foi extraído para não ter.
--
-- ============================================================
-- E POR QUE ISSO NÃO ABRE A BRECHA QUE A 045 FECHOU
-- ============================================================
--
-- `valor` e `alvos` continuam vindo da Proposal, sob lock. O que muda é que um
-- valor DERIVADO viaja como argumento — e a distinção é a que sustenta o
-- desenho:
--
--   `valor` é o FATO AUTORIZADO. O lojista aprovou aquele preço. Recebê-lo por
--   parâmetro permitiria combinar "esta proposta com outro preço", e a
--   autorização passaria a ser o argumento.
--
--   `margem` NÃO é autorizada por ninguém. É um subproduto que o sistema
--   calcula a partir do preço e das entradas do momento. Ninguém a aprova,
--   nada a revalida, e nenhuma decisão depende dela.
--
-- Isso foi CONFERIDO antes de escrever esta migração, e não presumido:
--
--   * `CAMPO_MARGEM` não existe em lugar nenhum do repositório;
--   * as precondições de preço são exatamente quatro — CAMPO_CUSTO,
--     CAMPO_PRECO_ATUAL, CAMPO_PESO_COBRAVEL, CAMPO_CONFIGURACAO — e nenhuma
--     delas é margem;
--   * `podeExecutar` não menciona margem;
--   * na rota ela aparece só em `antesDoPreco` e `rastroDaEscrita`, que
--     REGISTRAM o que aconteceu; nenhum deles decide nada.
--
-- ESTA FUNÇÃO TAMPOUCO A USA COMO CRITÉRIO. `p_margem` aparece uma única vez, no
-- SET do UPDATE. Nenhum `if`, nenhum filtro, nenhuma comparação. Se um dia
-- alguém a usar para decidir, o teste de guarda quebra.
--
-- `null` é valor legítimo: `margemLiquida` devolve null quando a margem não é
-- calculável, e a coluna aceita. Gravar 0 afirmaria "sem margem".
--
-- ============================================================
-- O QUE ESTA FUNÇÃO NÃO FAZ
-- ============================================================
--
-- Não revalida precondições — segue na aplicação, antes da chamada, como no
-- peso e no custo. Não grava auditoria, procedência nem consequência.
--
-- Não serve título nem cadastro. `cadastro` é multi-statement, não idempotente
-- e valida em TypeScript.
-- ============================================================

create or replace function public.copilot_executar_preco(
  p_proposta uuid,
  p_cliente  uuid,
  p_margem   numeric
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
  -- 1. A EXCLUSIVIDADE, igual às 045 e 046.
  select cliente_id, tipo, status, valor, alvos
    into v_cliente, v_tipo, v_status, v_valor, v_alvos
    from public.copilot_propostas
   where id = p_proposta
     for update;

  if not found then return query select 'nao_encontrada'::text, 0; return; end if;

  -- 2. O TENANT vem da SESSÃO e é CONFERIDO contra o objeto persistido.
  if v_cliente is distinct from p_cliente then return query select 'outro_tenant'::text, 0; return; end if;

  if v_tipo is distinct from 'preco' then return query select 'tipo_invalido'::text, 0; return; end if;
  if v_status = 'executada' then return query select 'ja_executada'::text, 0; return; end if;
  if v_status is distinct from 'pendente' then return query select 'status_invalido'::text, 0; return; end if;

  if v_alvos is null or array_length(v_alvos, 1) is null then
    return query select 'sem_alvos'::text, 0; return;
  end if;
  v_produto := v_alvos[1];

  -- 3. A MUTAÇÃO. `preco_venda` vem da PROPOSAL; `margem` vem do parâmetro, e
  --    é a ÚNICA aparição de `p_margem` nesta função — só escrita, nunca
  --    critério.
  update public.produtos
     set preco_venda = v_valor,
         margem      = p_margem
   where id = v_produto
     and cliente_id = p_cliente;
  get diagnostics v_afetados = row_count;

  -- 4. ZERO LINHAS NÃO É SUCESSO — e não queima a proposta.
  if v_afetados = 0 then
    return query select 'nada_gravado'::text, 0; return;
  end if;

  -- 5. A TRANSIÇÃO, por último.
  update public.copilot_propostas
     set status = 'executada',
         executada_em = now()
   where id = p_proposta;

  return query select 'ok'::text, v_afetados;
end;
$$;

comment on function public.copilot_executar_preco(uuid, uuid, numeric) is
  'Executa uma Proposal de PRECO: trava a proposta, le dela os fatos AUTORIZADOS (valor, alvos), grava produtos.preco_venda e produtos.margem com o tenant da sessao conferido, e so entao marca executada — tudo na MESMA transacao. p_margem e valor DERIVADO calculado em TypeScript (modelo de tarifas do ML) e NAO e autorizacao: nao e precondicao, nao e revalidado e nao decide nada aqui. status=executada passa a implicar mutacao commitada. Ver INC-002.';

-- ---------- grants: só quem precisa ----------

revoke all on function public.copilot_executar_preco(uuid, uuid, numeric) from public;
revoke all on function public.copilot_executar_preco(uuid, uuid, numeric) from anon;
revoke all on function public.copilot_executar_preco(uuid, uuid, numeric) from authenticated;
grant execute on function public.copilot_executar_preco(uuid, uuid, numeric) to service_role;

-- ---------- a prova ----------

do $$
declare v_sec boolean; v_anon boolean; v_auth boolean; v_srv boolean; v_irmas int;
begin
  select p.prosecdef into v_sec from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'copilot_executar_preco';
  if v_sec then
    raise exception 'MIGRACAO 047: a funcao ficou SECURITY DEFINER. O desenho exige INVOKER.';
  end if;

  select has_function_privilege('anon',          'public.copilot_executar_preco(uuid,uuid,numeric)', 'execute') into v_anon;
  select has_function_privilege('authenticated', 'public.copilot_executar_preco(uuid,uuid,numeric)', 'execute') into v_auth;
  select has_function_privilege('service_role',  'public.copilot_executar_preco(uuid,uuid,numeric)', 'execute') into v_srv;

  if v_anon or v_auth then
    raise exception 'MIGRACAO 047: anon/authenticated conseguem executar a funcao. So o servidor deve.';
  end if;
  if not v_srv then
    raise exception 'MIGRACAO 047: service_role NAO consegue executar a funcao.';
  end if;

  -- As irmãs das 045 e 046 não podem ter sido tocadas.
  select count(*) into v_irmas from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('copilot_executar_peso', 'copilot_executar_custo');
  if v_irmas <> 2 then
    raise exception 'MIGRACAO 047: as funcoes das 045/046 nao estao ambas presentes (achei %).', v_irmas;
  end if;

  raise notice '047 conferida: INVOKER, execute so para service_role, 045 e 046 intactas.';
end $$;

-- ---------- a regra da 043, exercida por esta migração ----------

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('047', '047-execucao-atomica-do-preco', now(),
        'copilot_executar_preco: trava a proposta, grava preco_venda e margem e marca executada na MESMA transacao; fecha o T1 para preco. margem e parametro DERIVADO, nunca criterio. Sem tabela, coluna, RLS ou backfill.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   drop function if exists public.copilot_executar_preco(uuid, uuid, numeric);
-- e reverter o ramo de preço na rota para `reservarParaExecucao` + `gravar`.
-- Nenhuma Proposal precisa ser migrada.
-- ============================================================
