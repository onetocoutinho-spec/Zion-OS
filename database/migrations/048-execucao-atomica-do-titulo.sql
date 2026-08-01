-- ============================================================
-- Zion OS — Migração 048: execução atômica do título (INC-002, camada 5 / H3)
--
-- INCREMENTAL. Cria UMA função. Nenhuma tabela, coluna, policy ou grant de
-- tabela muda. As migrações 044–047 ficam intactas.
--
-- ============================================================
-- O MESMO T1
-- ============================================================
--
-- Título continuava no caminho antigo: `reservarParaExecucao` marcava
-- `pendente -> executada` ANTES da mutação, em transação separada. Morte no
-- intervalo consumia a autorização, deixava o título antigo no anúncio, e a
-- próxima tentativa recebia "Isso já foi feito".
--
--     status = 'executada'  ⇒  o título correspondente COMMITOU
--
-- ============================================================
-- POR QUE ESTE É O CASO MAIS LIMPO DOS QUATRO
-- ============================================================
--
-- Diferente do preço, aqui NADA extra viaja: o título proposto está na Proposal,
-- em `texto`, e o alvo em `alvos[1]`. A função recebe `(proposta, cliente)` como
-- as 045 e 046.
--
-- O `alvos` de uma proposta de título carrega o ID DO ANÚNCIO, não o do produto
-- — é o anúncio que muda. Ver `conversa/route.ts`, onde a proposta nasce.
--
-- ============================================================
-- O MERGE DO JSONB — POR QUE ELE NÃO É PORTE DE DOMÍNIO
-- ============================================================
--
-- O caminho antigo fazia, em TypeScript:
--
--     .update({ anuncio: { ...atual, tituloOtimizado: titulo } })
--
-- Isso é uma operação ESTRUTURAL — troca uma chave de topo e preserva o resto —,
-- não uma regra de negócio. `jsonb_set(anuncio, '{tituloOtimizado}', ...)` faz
-- exatamente a mesma coisa, e por isso não repete o erro que a rejeição do porte
-- de `margemLiquida` evitou: ali seriam duas implementações de uma CONTA; aqui é
-- a mesma substituição de chave, escrita na linguagem de quem guarda o dado.
--
-- `to_jsonb(v_texto)` e não `to_jsonb(v_texto)::text`: a chave guarda uma string
-- JSON, como o spread produzia.
--
-- ============================================================
-- O QUE O `if (!atual) return null` SIGNIFICAVA
-- ============================================================
--
-- `anuncios_gerados.anuncio` é `jsonb NOT NULL` — conferido: 582 linhas, zero
-- nulas. Então aquela guarda só era verdadeira quando a LINHA não existia (ou
-- era de outro tenant). O `where id = ... and cliente_id = ...` reproduz isso
-- sozinho, e acrescentar um `anuncio is not null` seria predicado morto.
--
-- ============================================================
-- O QUE ESTA FUNÇÃO NÃO FAZ
-- ============================================================
--
-- Não revalida a precondição do título (a impressão do título atual) — segue na
-- aplicação, antes da chamada, como nos outros tipos. Não grava auditoria,
-- procedência nem consequência.
--
-- Não serve cadastro: multi-statement, não idempotente, valida em TypeScript.
-- ============================================================

create or replace function public.copilot_executar_titulo(
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
  v_texto     text;
  v_alvos     uuid[];
  v_anuncio   uuid;
  v_afetados  integer := 0;
begin
  -- 1. A EXCLUSIVIDADE, igual às 045/046/047.
  select cliente_id, tipo, status, texto, alvos
    into v_cliente, v_tipo, v_status, v_texto, v_alvos
    from public.copilot_propostas
   where id = p_proposta
     for update;

  if not found then return query select 'nao_encontrada'::text, 0; return; end if;

  -- 2. O TENANT vem da SESSÃO e é CONFERIDO contra o objeto persistido.
  if v_cliente is distinct from p_cliente then return query select 'outro_tenant'::text, 0; return; end if;

  if v_tipo is distinct from 'titulo' then return query select 'tipo_invalido'::text, 0; return; end if;
  if v_status = 'executada' then return query select 'ja_executada'::text, 0; return; end if;
  if v_status is distinct from 'pendente' then return query select 'status_invalido'::text, 0; return; end if;

  if v_alvos is null or array_length(v_alvos, 1) is null then
    return query select 'sem_alvos'::text, 0; return;
  end if;
  v_anuncio := v_alvos[1];

  -- 3. O TEXTO, da Proposal. `btrim` porque o caminho antigo aplicava `.trim()`
  --    e recusava vazio — uma proposta de título sem título não é executável.
  v_texto := btrim(coalesce(v_texto, ''));
  if v_texto = '' then
    return query select 'sem_texto'::text, 0; return;
  end if;

  -- 4. A MUTAÇÃO. `jsonb_set` troca UMA chave de topo e preserva o resto —
  --    exatamente o que `{ ...atual, tituloOtimizado: titulo }` fazia.
  update public.anuncios_gerados
     set anuncio = jsonb_set(anuncio, '{tituloOtimizado}', to_jsonb(v_texto), true)
   where id = v_anuncio
     and cliente_id = p_cliente;
  get diagnostics v_afetados = row_count;

  -- 5. ZERO LINHAS NÃO É SUCESSO — e não queima a proposta. O anúncio sumiu ou
  --    é de outro tenant; o status não foi tocado, então ela continua
  --    `pendente`.
  if v_afetados = 0 then
    return query select 'nada_gravado'::text, 0; return;
  end if;

  -- 6. A TRANSIÇÃO, por último.
  update public.copilot_propostas
     set status = 'executada',
         executada_em = now()
   where id = p_proposta;

  return query select 'ok'::text, v_afetados;
end;
$$;

comment on function public.copilot_executar_titulo(uuid, uuid) is
  'Executa uma Proposal de TITULO: trava a proposta, le dela os fatos autorizados (texto e alvos — onde alvos[1] e o ID DO ANUNCIO, nao do produto), troca a chave tituloOtimizado do jsonb com o tenant da sessao conferido, e so entao marca executada — tudo na MESMA transacao. jsonb_set e a mesma substituicao de chave que o spread fazia em TypeScript, nao um porte de regra de negocio. status=executada passa a implicar mutacao commitada. NAO revalida precondicoes e NAO grava auditoria/procedencia/consequencia. Ver INC-002.';

-- ---------- grants: só quem precisa ----------

revoke all on function public.copilot_executar_titulo(uuid, uuid) from public;
revoke all on function public.copilot_executar_titulo(uuid, uuid) from anon;
revoke all on function public.copilot_executar_titulo(uuid, uuid) from authenticated;
grant execute on function public.copilot_executar_titulo(uuid, uuid) to service_role;

-- ---------- a prova ----------

do $$
declare v_sec boolean; v_anon boolean; v_auth boolean; v_srv boolean; v_irmas int;
begin
  select p.prosecdef into v_sec from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'copilot_executar_titulo';
  if v_sec then
    raise exception 'MIGRACAO 048: a funcao ficou SECURITY DEFINER. O desenho exige INVOKER.';
  end if;

  select has_function_privilege('anon',          'public.copilot_executar_titulo(uuid,uuid)', 'execute') into v_anon;
  select has_function_privilege('authenticated', 'public.copilot_executar_titulo(uuid,uuid)', 'execute') into v_auth;
  select has_function_privilege('service_role',  'public.copilot_executar_titulo(uuid,uuid)', 'execute') into v_srv;

  if v_anon or v_auth then
    raise exception 'MIGRACAO 048: anon/authenticated conseguem executar a funcao. So o servidor deve.';
  end if;
  if not v_srv then
    raise exception 'MIGRACAO 048: service_role NAO consegue executar a funcao.';
  end if;

  select count(*) into v_irmas from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('copilot_executar_peso', 'copilot_executar_custo', 'copilot_executar_preco');
  if v_irmas <> 3 then
    raise exception 'MIGRACAO 048: as funcoes das 045/046/047 nao estao todas presentes (achei %).', v_irmas;
  end if;

  raise notice '048 conferida: INVOKER, execute so para service_role, 045/046/047 intactas.';
end $$;

-- ---------- a regra da 043, exercida por esta migração ----------

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('048', '048-execucao-atomica-do-titulo', now(),
        'copilot_executar_titulo: trava a proposta, troca tituloOtimizado no jsonb e marca executada na MESMA transacao; fecha o T1 para titulo. Sem tabela, coluna, RLS ou backfill.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   drop function if exists public.copilot_executar_titulo(uuid, uuid);
-- e reverter o ramo de título na rota. Nenhuma Proposal precisa ser migrada.
-- ============================================================
