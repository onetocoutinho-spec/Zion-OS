-- 064 — a loja em operação
--
-- Aplicada em 2026-08-22 no projeto principal (aprovada pelo dono). É a Fase 3
-- (só funções, nenhuma tabela) de docs/product/ux/03-RECOMMENDED-EXPERIENCE.md.
--
-- O QUE MUDA
--
-- As funções do portal (`quota_esteira`, `portal_custos_do_lojista`,
-- `portal_margem_minima` e as duas de escrita) resolvem a loja por
-- `cliente_do_usuario()` — que para a AGÊNCIA e para a EQUIPE é nulo. Por
-- isso a agência nunca conseguiu entrar na experiência da loja: as telas
-- vinham vazias (docs/product/ux/02-PROBLEMS.md, P0 #3 "operar a loja X").
--
-- Cada função ganha uma SOBRECARGA com `p_cliente_id uuid`, e todas passam
-- pelo mesmo portão, `loja_em_operacao(uuid)`:
--
--   * o lojista só alcança a própria loja (`cliente_do_usuario()`);
--   * a agência só alcança as lojas dela (`lojas_da_agencia()`, migração 054);
--   * a equipe alcança qualquer loja (`eh_equipe()`);
--   * fora disso, EXCEÇÃO — nunca "a loja errada em silêncio".
--
-- As versões sem argumento continuam existindo, intactas: o portal do lojista
-- não muda de comportamento. O parâmetro NÃO é autoridade — é o pedido; quem
-- decide é o portão, com o JWT de quem chamou.
--
-- O QUE NÃO MUDA: nenhuma tabela, nenhuma policy, nenhuma função existente.
--
-- REVERTER: drop das sobrecargas com (uuid) e de `loja_em_operacao(uuid)`.

-- ---------- o portão ----------

create or replace function public.loja_em_operacao(p_cliente_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_cliente_id is null then
    raise exception 'loja_em_operacao: loja nao informada';
  end if;
  if p_cliente_id = public.cliente_do_usuario() then
    return p_cliente_id;
  end if;
  if public.eh_equipe() then
    return p_cliente_id;
  end if;
  if p_cliente_id in (select public.lojas_da_agencia()) then
    return p_cliente_id;
  end if;
  raise exception 'loja_em_operacao: voce nao opera esta loja' using errcode = '42501';
end;
$$;

revoke all on function public.loja_em_operacao(uuid) from public, anon;
grant execute on function public.loja_em_operacao(uuid) to authenticated, service_role;

-- ---------- leituras ----------

create or replace function public.quota_esteira(p_cliente_id uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'limite', coalesce((select limite_esteira_mes from public.clientes where id = public.loja_em_operacao(p_cliente_id)), 0),
    'usado',  (select coalesce(sum(creditos), 0) from public.consumo_ia
               where cliente_id = public.loja_em_operacao(p_cliente_id)
                 and criado_em >= date_trunc('month', now()))
  );
$$;

create or replace function public.portal_custos_do_lojista(p_cliente_id uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'embalagem',                   coalesce(c.custo_embalagem, 0),
    'etiqueta',                    coalesce(c.custo_etiqueta, 0),
    'informativos',                coalesce(c.custo_informativos, 0),
    'impostoPercentual',           coalesce(c.imposto_percentual, 0),
    'comissaoGestorPercentual',    coalesce(c.comissao_gestor_percentual, 0),
    'comissaoSistemaPercentual',   coalesce(c.comissao_sistema_percentual, 0),
    'cupomPercentual',             coalesce(c.cupom_percentual, 0)
  )
  from public.clientes c
  where c.id = public.loja_em_operacao(p_cliente_id);
$$;

create or replace function public.portal_margem_minima(p_cliente_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(
    (select c.margem_minima from public.clientes c where c.id = public.loja_em_operacao(p_cliente_id)),
    5
  );
$$;

-- ---------- escritas ----------

create or replace function public.portal_definir_margem_minima(p_cliente_id uuid, nova numeric)
returns numeric language plpgsql volatile security definer set search_path = public as $$
declare
  alvo uuid := public.loja_em_operacao(p_cliente_id);
  gravada numeric;
begin
  if nova is null or nova < 0 or nova > 60 then
    raise exception 'Margem mínima fora da faixa permitida (0 a 60).';
  end if;
  update public.clientes set margem_minima = nova where id = alvo
    returning margem_minima into gravada;
  return gravada;
end;
$$;

create or replace function public.portal_definir_custos_do_lojista(
  p_cliente_id uuid,
  p_embalagem numeric,
  p_etiqueta numeric,
  p_informativos numeric,
  p_imposto numeric,
  p_gestor numeric,
  p_sistema numeric,
  p_cupom numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid := public.loja_em_operacao(p_cliente_id);
begin
  update public.clientes
     set custo_embalagem             = greatest(coalesce(p_embalagem, 0), 0),
         custo_etiqueta              = greatest(coalesce(p_etiqueta, 0), 0),
         custo_informativos          = greatest(coalesce(p_informativos, 0), 0),
         imposto_percentual          = greatest(coalesce(p_imposto, 0), 0),
         comissao_gestor_percentual  = greatest(coalesce(p_gestor, 0), 0),
         comissao_sistema_percentual = greatest(coalesce(p_sistema, 0), 0),
         cupom_percentual            = greatest(coalesce(p_cupom, 0), 0)
   where id = alvo;
end;
$$;

-- ---------- permissões: o mesmo recorte das versões sem argumento ----------

revoke all on function public.quota_esteira(uuid) from public, anon;
revoke all on function public.portal_custos_do_lojista(uuid) from public, anon;
revoke all on function public.portal_margem_minima(uuid) from public, anon;
revoke all on function public.portal_definir_margem_minima(uuid, numeric) from public, anon;
revoke all on function public.portal_definir_custos_do_lojista(uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon;

grant execute on function public.quota_esteira(uuid) to authenticated, service_role;
grant execute on function public.portal_custos_do_lojista(uuid) to authenticated, service_role;
grant execute on function public.portal_margem_minima(uuid) to authenticated, service_role;
grant execute on function public.portal_definir_margem_minima(uuid, numeric) to authenticated, service_role;
grant execute on function public.portal_definir_custos_do_lojista(uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated, service_role;

-- ---------- a prova ----------

do $$
declare
  sem_search_path int;
  com_anon int;
begin
  select count(*) into sem_search_path
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('loja_em_operacao','quota_esteira','portal_custos_do_lojista','portal_margem_minima','portal_definir_margem_minima','portal_definir_custos_do_lojista')
     and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%');
  if sem_search_path > 0 then
    raise exception 'MIGRACAO 064 INCOMPLETA: % funcao(oes) security definer sem search_path fixo.', sem_search_path;
  end if;
  select count(*) into com_anon
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('loja_em_operacao','quota_esteira','portal_custos_do_lojista','portal_margem_minima','portal_definir_margem_minima','portal_definir_custos_do_lojista')
     and has_function_privilege('anon', p.oid, 'execute');
  if com_anon > 0 then
    raise exception 'MIGRACAO 064 INCOMPLETA: % funcao(oes) executaveis por anon.', com_anon;
  end if;
  raise notice '064 conferida: sobrecargas com p_cliente_id passam por loja_em_operacao; anon fora.';
end $$;

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('064', '064-a-loja-em-operacao', now(),
        'loja_em_operacao(uuid) e o portao: lojista so a propria loja, agencia so as dela (054), equipe qualquer. quota_esteira, portal_custos_do_lojista, portal_margem_minima e as duas escritas ganham sobrecarga com p_cliente_id. As versoes sem argumento ficam intactas. Nenhuma tabela ou policy muda.')
on conflict do nothing;
