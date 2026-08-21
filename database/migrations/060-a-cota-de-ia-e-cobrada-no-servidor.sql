-- 060 — a cota de IA é cobrada no servidor, por chamada, de forma atômica
--
-- Findings: ZION-QUOTA-001 (P1) e ZION-COST-001 (P1), auditoria de 2026-08-21.
--
-- ============================================================
-- O QUE HAVIA
-- ============================================================
--
-- `clientes.limite_esteira_mes` é a cota do plano. `quota_esteira()` (006) a
-- calcula certo: `count(*)` de `anuncios_gerados` no mês contra o limite. Mas
-- o ÚNICO chamador era o navegador (src/lib/services/perfil.ts), que a usava
-- para desabilitar um botão. As rotas `/api/agentes/esteira` e
-- `/api/agentes/executar` nunca a consultavam.
--
-- E o cadastro é aberto: qualquer pessoa vira `authenticated` com perfil e
-- loja em dois passos (signUp + /api/loja/provisionar). Uma conta nova, com
-- `fetch` direto na rota, rodava Claude Opus em laço, sem limite.
--
-- Havia um segundo defeito escondido no primeiro: o contador mede ANÚNCIOS
-- GRAVADOS, não CHAMADAS. Uma chamada que não chega a gravar (o atacante que
-- não está na tela; a geração que falha no JSON) não sobe o contador. A cota
-- media a saída, e o custo é na entrada.
--
-- ============================================================
-- O QUE MUDA
-- ============================================================
--
-- 1. `consumo_ia`: um registro por chamada paga, com tenant, tipo e quando.
--    É o ledger. Quem escreve é só o servidor (service_role); o navegador
--    lê o próprio tenant para mostrar o saldo.
--
-- 2. `reservar_cota_ia(cliente, tipo)`: a decisão ATÔMICA. Tranca a linha do
--    cliente (`for update`), conta o mês, compara com o limite, e ou grava o
--    consumo e devolve ok, ou devolve a recusa — na mesma transação. Duas
--    requisições simultâneas no último crédito não passam as duas: a segunda
--    espera o lock e vê o contador já incrementado.
--
--    Equipe e agência não têm `cliente_id` próprio e continuam sem cota —
--    é a decisão de produto que já valia. A função recebe o tenant como
--    argumento porque roda com service_role no servidor, DEPOIS de
--    `exigirAutenticado`; não é exposta a `authenticated`.
--
-- 3. `quota_esteira()` passa a contar o ledger em vez de `anuncios_gerados`.
--    O navegador continua chamando a mesma função e mostrando o mesmo
--    {limite, usado} — só que agora o número é o mesmo que o servidor usa
--    para recusar.
--
-- ============================================================
-- O QUE NÃO MUDA
-- ============================================================
--
-- A cota continua sendo uma por loja (limite_esteira_mes). Não nasce cota
-- separada para extração de catálogo: ela pesa o mesmo crédito, e o
-- servidor decide quantos créditos uma extração custa (hoje, um). Separar é
-- decisão de plano, não de segurança.
-- ============================================================

create table if not exists public.consumo_ia (
  id          bigint generated always as identity primary key,
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  tipo        text not null,                 -- 'esteira' | 'agente' | 'catalogo' | ...
  creditos    integer not null default 1 check (creditos > 0),
  usuario_id  uuid,                          -- quem disparou (auth.users.id), se houver
  criado_em   timestamptz not null default now()
);

create index if not exists idx_consumo_ia_cliente_mes
  on public.consumo_ia (cliente_id, criado_em desc);

alter table public.consumo_ia enable row level security;

-- O navegador lê o PRÓPRIO consumo, para mostrar saldo. Nenhuma política de
-- escrita: só service_role grava, pelo servidor, depois de autorizar.
drop policy if exists cliente_le_o_proprio_consumo on public.consumo_ia;
create policy cliente_le_o_proprio_consumo on public.consumo_ia
  for select to authenticated
  using (cliente_id = public.cliente_do_usuario());

drop policy if exists equipe_le_consumo on public.consumo_ia;
create policy equipe_le_consumo on public.consumo_ia
  for select to authenticated
  using (public.eh_equipe());

-- A agência vê o consumo das lojas dela: é operação da loja, e é o que ela
-- precisa para explicar "acabou a cota". Só leitura. O NOME é `agencia_escopo`
-- porque é o que database/verificacoes/alcance-da-agencia.sql procura; o
-- `for select` é a decisão — a 054 fazia `for all`, aqui o servidor escreve.
drop policy if exists agencia_escopo on public.consumo_ia;
create policy agencia_escopo on public.consumo_ia
  for select to authenticated
  using (cliente_id in (select public.lojas_da_agencia()));

revoke all on table public.consumo_ia from anon;
revoke insert, update, delete on table public.consumo_ia from authenticated;

-- ---------- a reserva atômica ----------

create or replace function public.reservar_cota_ia(
  p_cliente_id uuid,
  p_tipo       text,
  p_creditos   integer default 1,
  p_usuario_id uuid default null
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_limite integer;
  v_usado  integer;
begin
  if p_cliente_id is null then
    return json_build_object('ok', false, 'motivo', 'sem_cliente', 'limite', 0, 'usado', 0);
  end if;
  if p_creditos is null or p_creditos < 1 then
    raise exception 'creditos precisa ser >= 1';
  end if;

  -- O lock é o que torna isto atômico. Sem ele, duas requisições leem o
  -- mesmo `usado`, as duas passam, e a cota vira sugestão.
  select limite_esteira_mes into v_limite
    from public.clientes
   where id = p_cliente_id
     for update;

  if v_limite is null then
    return json_build_object('ok', false, 'motivo', 'cliente_inexistente', 'limite', 0, 'usado', 0);
  end if;

  select coalesce(sum(creditos), 0) into v_usado
    from public.consumo_ia
   where cliente_id = p_cliente_id
     and criado_em >= date_trunc('month', now());

  if v_usado + p_creditos > v_limite then
    return json_build_object('ok', false, 'motivo', 'cota_esgotada', 'limite', v_limite, 'usado', v_usado);
  end if;

  insert into public.consumo_ia (cliente_id, tipo, creditos, usuario_id)
  values (p_cliente_id, p_tipo, p_creditos, p_usuario_id);

  return json_build_object('ok', true, 'limite', v_limite, 'usado', v_usado + p_creditos);
end $$;

-- Só o servidor reserva. `authenticated` NÃO executa: a função recebe o tenant
-- como argumento, e um navegador que pudesse chamá-la escolheria o tenant.
revoke execute on function public.reservar_cota_ia(uuid, text, integer, uuid) from public, anon, authenticated;
grant  execute on function public.reservar_cota_ia(uuid, text, integer, uuid) to service_role;

-- ---------- quota_esteira passa a olhar o ledger ----------

create or replace function public.quota_esteira()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'limite', coalesce((select limite_esteira_mes from public.clientes where id = public.cliente_do_usuario()), 0),
    'usado',  (select coalesce(sum(creditos), 0) from public.consumo_ia
               where cliente_id = public.cliente_do_usuario()
                 and criado_em >= date_trunc('month', now()))
  );
$$;

-- ---------- a prova ----------

do $$
declare
  pode_anon boolean;
  pode_auth boolean;
begin
  select has_function_privilege('anon', 'public.reservar_cota_ia(uuid, text, integer, uuid)', 'execute') into pode_anon;
  select has_function_privilege('authenticated', 'public.reservar_cota_ia(uuid, text, integer, uuid)', 'execute') into pode_auth;
  if pode_anon or pode_auth then
    raise exception 'MIGRACAO 060 INCOMPLETA: reservar_cota_ia executavel pelo navegador (anon=%, authenticated=%).', pode_anon, pode_auth;
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='consumo_ia') then
    raise exception 'MIGRACAO 060 INCOMPLETA: consumo_ia sem politica.';
  end if;
  raise notice '060 conferida: reservar_cota_ia so por service_role; consumo_ia com RLS e politicas.';
end $$;

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('060', '060-a-cota-de-ia-e-cobrada-no-servidor', now(),
        'ZION-QUOTA-001 + ZION-COST-001. A cota mensal (limite_esteira_mes) so existia no navegador: as rotas de IA nunca a consultavam, e o contador media anuncios gravados, nao chamadas. Nasce consumo_ia (ledger, um registro por chamada paga) e reservar_cota_ia() — atomica com for update na linha do cliente, executavel so por service_role, chamada pelo servidor depois de exigirAutenticado. quota_esteira() passa a somar o ledger, entao o saldo que a tela mostra e o mesmo que o servidor usa para recusar com 429.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   Recriar quota_esteira() como na 006 (count de anuncios_gerados), e
--   drop function reservar_cota_ia; drop table consumo_ia. As rotas
--   precisam voltar a não chamar a cota — o que é voltar ao finding.
-- ============================================================
