-- 057 — a descrição e as palavras-chave passam a ser executadas atomicamente
--
-- ============================================================
-- POR QUE UMA FUNÇÃO, E NÃO DUAS
-- ============================================================
--
-- Descrição e palavras-chave gravam na MESMA linha de `anuncios_gerados`,
-- percorrem a MESMA transição de proposta e têm a MESMA conferência de tenant.
-- O que muda é qual chave do jsonb é tocada — e uma chave é parâmetro, não
-- arquitetura.
--
-- Duas funções divergiriam no primeiro conserto que passasse só por uma. Este
-- repositório já pagou por isso mais de uma vez este mês.
--
-- ============================================================
-- A DIFERENÇA QUE NÃO É COSMÉTICA
-- ============================================================
--
--   DESCRIÇÃO      substitui `descricaoCompleta`.
--   PALAVRAS-CHAVE ACRESCENTAM a `palavrasChaveSecundarias`.
--
-- Trocar palavras-chave em vez de acrescentar apagaria termos que já traziam
-- comprador — e ninguém pediu isso. O acréscimo acontece AQUI, no banco, e não
-- no TypeScript, porque é aqui que a linha está travada: ler no app, concatenar
-- e gravar abriria janela para duas execuções perderem uma da outra.
--
-- `secundarias` e não `principais`: as principais saíram da esteira junto com o
-- título e sustentam a busca de hoje. O que o assistente acrescenta entra como
-- reforço, não por cima do que já funciona.
--
-- ============================================================
-- O QUE ELA NÃO FAZ
-- ============================================================
--
-- Igual à 048: NÃO revalida precondições e NÃO grava auditoria, procedência ou
-- consequência. Isso é da rota, antes e depois da chamada. Ver INC-002.

create or replace function public.copilot_executar_texto_do_anuncio(
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
  v_novas     jsonb;
  v_atuais    jsonb;
begin
  -- 1. A EXCLUSIVIDADE, igual às 045/046/047/048.
  select cliente_id, tipo, status, texto, alvos
    into v_cliente, v_tipo, v_status, v_texto, v_alvos
    from public.copilot_propostas
   where id = p_proposta
     for update;

  if not found then return query select 'nao_encontrada'::text, 0; return; end if;

  -- 2. O TENANT vem da SESSÃO e é CONFERIDO contra o objeto persistido.
  if v_cliente is distinct from p_cliente then return query select 'outro_tenant'::text, 0; return; end if;

  if v_tipo not in ('descricao', 'palavras_chave') then
    return query select 'tipo_invalido'::text, 0; return;
  end if;
  if v_status = 'executada' then return query select 'ja_executada'::text, 0; return; end if;
  if v_status is distinct from 'pendente' then return query select 'status_invalido'::text, 0; return; end if;

  if v_alvos is null or array_length(v_alvos, 1) is null then
    return query select 'sem_alvos'::text, 0; return;
  end if;
  v_anuncio := v_alvos[1];

  v_texto := btrim(coalesce(v_texto, ''));
  if v_texto = '' then
    return query select 'sem_texto'::text, 0; return;
  end if;

  if v_tipo = 'descricao' then
    -- SUBSTITUI. Uma chave de topo, o resto do jsonb preservado.
    update public.anuncios_gerados
       set anuncio = jsonb_set(anuncio, '{descricaoCompleta}', to_jsonb(v_texto), true)
     where id = v_anuncio
       and cliente_id = p_cliente;
    get diagnostics v_afetados = row_count;
  else
    -- ACRESCENTA. A leitura e a concatenação acontecem com a linha já travada
    -- pelo `for update` acima — fazer isso no app abriria janela para duas
    -- execuções perderem uma da outra.
    --
    -- O texto da proposta é a lista separada por vírgula, como o cartão mostrou
    -- à lojista. Converter aqui mantém uma fonte só para o que ela leu.
    select coalesce(anuncio->'palavrasChaveSecundarias', '[]'::jsonb)
      into v_atuais
      from public.anuncios_gerados
     where id = v_anuncio
       and cliente_id = p_cliente;

    if v_atuais is null then
      return query select 'nada_gravado'::text, 0; return;
    end if;

    select jsonb_agg(t)
      into v_novas
      from (
        select btrim(x) as t
          from unnest(string_to_array(v_texto, ',')) as x
         where btrim(x) <> ''
      ) s;

    update public.anuncios_gerados
       set anuncio = jsonb_set(
             anuncio,
             '{palavrasChaveSecundarias}',
             v_atuais || coalesce(v_novas, '[]'::jsonb),
             true
           )
     where id = v_anuncio
       and cliente_id = p_cliente;
    get diagnostics v_afetados = row_count;
  end if;

  -- ZERO LINHAS NÃO É SUCESSO — e não queima a proposta. O anúncio sumiu ou é
  -- de outro tenant; o status não foi tocado, então ela continua `pendente`.
  if v_afetados = 0 then
    return query select 'nada_gravado'::text, 0; return;
  end if;

  update public.copilot_propostas
     set status = 'executada',
         executada_em = now()
   where id = p_proposta;

  return query select 'ok'::text, v_afetados;
end;
$$;

comment on function public.copilot_executar_texto_do_anuncio(uuid, uuid) is
  'Executa uma Proposal de DESCRICAO ou PALAVRAS_CHAVE: trava a proposta, confere o tenant da sessao, e grava na mesma transacao. Descricao SUBSTITUI descricaoCompleta; palavras-chave ACRESCENTAM a palavrasChaveSecundarias (a concatenacao acontece aqui, com a linha travada, para duas execucoes nao perderem uma da outra). alvos[1] e o ID DO ANUNCIO, nao do produto. NAO revalida precondicoes e NAO grava auditoria/procedencia/consequencia — ver INC-002.';

revoke all on function public.copilot_executar_texto_do_anuncio(uuid, uuid) from public;
revoke all on function public.copilot_executar_texto_do_anuncio(uuid, uuid) from anon;
revoke all on function public.copilot_executar_texto_do_anuncio(uuid, uuid) from authenticated;
grant execute on function public.copilot_executar_texto_do_anuncio(uuid, uuid) to service_role;

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('057', '057-execucao-atomica-do-texto-do-anuncio', now(),
        'Funcao copilot_executar_texto_do_anuncio: descricao e palavras-chave passam pela mesma disciplina atomica do titulo (048). Uma funcao para os dois tipos porque gravam na MESMA linha e percorrem a MESMA transicao — a chave do jsonb e parametro, nao arquitetura. Descricao SUBSTITUI descricaoCompleta; palavras-chave ACRESCENTAM a palavrasChaveSecundarias, com a concatenacao no banco e a linha travada.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   drop function public.copilot_executar_texto_do_anuncio(uuid, uuid);
--
-- Seguro enquanto nenhuma proposta de descricao/palavras_chave estiver
-- pendente: sem a funcao, a rota recusa executar e a proposta fica pendente.
