-- 063 — a cota também limita o minuto
--
-- Hardening pós-060 (ZION-QUOTA-001, item 4 do relatório de remediação).
--
-- A 060 fechou o MÊS: 30 chamadas e acabou. Não fechou o MINUTO: as 30
-- podem ser disparadas em paralelo, e o que se paga ao provedor — e o que
-- se espera na fila — é o mesmo. Um laço de `fetch` ainda é um laço.
--
-- Como a reserva já é atômica (lock na linha do cliente), a janela curta é
-- uma segunda contagem na mesma transação. Sem tabela nova, sem estado em
-- memória (que na Vercel não sobrevive à próxima função), sem Redis.
--
-- O teto: 6 por minuto por loja. Uma esteira leva 25–40 s; uma pessoa na
-- tela não passa de 2–3 por minuto. 6 é folga para quem usa e parede para
-- quem abusa. É `p_max_por_minuto`, com padrão — a rota pode pedir outro.
--
-- A recusa por minuto NÃO grava consumo e NÃO conta na cota do mês: recusar
-- é de graça, e cobrar o crédito de uma recusa seria punir duas vezes.

create or replace function public.reservar_cota_ia(
  p_cliente_id     uuid,
  p_tipo           text,
  p_creditos       integer default 1,
  p_usuario_id     uuid default null,
  p_max_por_minuto integer default 6
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
  v_minuto integer;
begin
  if p_cliente_id is null then
    return json_build_object('ok', false, 'motivo', 'sem_cliente', 'limite', 0, 'usado', 0);
  end if;
  if p_creditos is null or p_creditos < 1 then
    raise exception 'creditos precisa ser >= 1';
  end if;

  select limite_esteira_mes into v_limite
    from public.clientes
   where id = p_cliente_id
     for update;

  if v_limite is null then
    return json_build_object('ok', false, 'motivo', 'cliente_inexistente', 'limite', 0, 'usado', 0);
  end if;

  -- O minuto, antes do mês: é a recusa mais barata e a que um laço atinge primeiro.
  select count(*) into v_minuto
    from public.consumo_ia
   where cliente_id = p_cliente_id
     and criado_em >= now() - interval '1 minute';
  if p_max_por_minuto is not null and v_minuto >= p_max_por_minuto then
    return json_build_object('ok', false, 'motivo', 'ritmo', 'limite', v_limite,
                             'usado', (select coalesce(sum(creditos), 0) from public.consumo_ia
                                        where cliente_id = p_cliente_id
                                          and criado_em >= date_trunc('month', now())),
                             'por_minuto', v_minuto);
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

-- A assinatura mudou (um parâmetro a mais, com default): a antiga de 4
-- argumentos deixa de existir como sobrecarga separada, e os grants
-- precisam ser refeitos para a nova.
drop function if exists public.reservar_cota_ia(uuid, text, integer, uuid);
revoke execute on function public.reservar_cota_ia(uuid, text, integer, uuid, integer) from public, anon, authenticated;
grant  execute on function public.reservar_cota_ia(uuid, text, integer, uuid, integer) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.reservar_cota_ia(uuid,text,integer,uuid,integer)', 'execute')
  or has_function_privilege('authenticated', 'public.reservar_cota_ia(uuid,text,integer,uuid,integer)', 'execute') then
    raise exception 'MIGRACAO 063 INCOMPLETA: reservar_cota_ia executavel pelo navegador.';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' and p.proname='reservar_cota_ia' and p.pronargs = 4) then
    raise exception 'MIGRACAO 063 INCOMPLETA: a sobrecarga antiga de 4 argumentos ainda existe.';
  end if;
  raise notice '063 conferida: reservar_cota_ia com teto por minuto, so por service_role.';
end $$;

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('063', '063-a-cota-tambem-limita-o-minuto', now(),
        'reservar_cota_ia ganha p_max_por_minuto (padrao 6): conta as chamadas do ultimo minuto na mesma transacao atomica da 060 e recusa com motivo=ritmo antes de olhar o mes. Recusa nao grava consumo. Sem tabela nova nem estado em memoria. A sobrecarga de 4 argumentos e removida; o codigo chama com os defaults.')
on conflict do nothing;
