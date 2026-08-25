-- 067 — as execuções de IA
--
-- APLICADA em 2026-08-23 no projeto principal. Nasceu como arquivo
-- (auditoria do Copilot, 2026-08-22, roadmap NOW item 5).
--
-- O QUE MUDA
--
-- "Quanto custa um usuário por mês?", "qual intenção é mais frequente?",
-- "a qualidade caiu porque o modelo mudou?" — nenhuma tinha resposta. O que
-- existia: `copilot_mensagens.tokens` (a soma, sem modelo, sem custo, sem
-- latência, e nada em caso de erro) e `consumo_ia.creditos` (a cota, não o
-- gasto). O próprio repositório media o cache de prompt num TESTE DE FONTE
-- porque não havia como medi-lo em produção.
--
-- 1. `ia_execucoes`: UMA linha por chamada paga — chat (o turno inteiro),
--    intenção, agente, esteira, imagem, título, descrição. Com tenant,
--    usuário, conversa, modelo, tokens (entrada/saída/cache), latência e o
--    desfecho — inclusive `erro` e `timeout`. Gravada pelo servidor, sempre,
--    também no `catch`: execução que falha e some é a que mais custa.
--
-- 2. `ia_precos_modelo`: o preço por milhão de tokens, por modelo, com
--    vigência. NASCE VAZIA, de propósito: um preço escrito de memória aqui
--    seria a mesma suposição-vestida-de-fato que a AUD-001 caçou. Quem sabe o
--    preço do contrato preenche; até lá, `custo_estimado` é NULL — e NULL
--    não vira zero.
--
-- 3. `ia_execucoes_custo`: a view que junta as duas. O custo é calculado na
--    LEITURA, nunca gravado: trocar o preço reprecifica o histórico inteiro
--    sem migrar dado.
--
-- RLS no molde de `consumo_ia` (060): o lojista lê as suas, a agência as
-- das lojas dela, a equipe todas. NINGUÉM escreve pelo navegador — só o
-- `service_role`.
--
-- REVERTER: drop view ia_execucoes_custo; drop table ia_execucoes;
-- drop table ia_precos_modelo.

create table if not exists public.ia_execucoes (
  id            bigint generated always as identity primary key,
  cliente_id    uuid references public.clientes(id) on delete set null,
  usuario_id    uuid,
  conversa_id   uuid,
  -- chat | intencao | agente | esteira | imagem | titulo | descricao | palavras_chave | catalogo
  origem        text not null,
  provedor      text,
  modelo        text,
  ferramentas   text[] not null default '{}',
  passos        integer,
  tokens_entrada        integer,
  tokens_saida          integer,
  tokens_cache_lidos    integer,
  tokens_cache_escritos integer,
  tokens_total          integer,
  ms            integer not null,
  -- ok | erro | timeout | parcial | recusado
  status        text not null,
  erro          text,
  degradado     boolean not null default false,
  criada_em     timestamptz not null default now()
);

create index if not exists ia_execucoes_cliente_criada_idx
  on public.ia_execucoes (cliente_id, criada_em desc);
create index if not exists ia_execucoes_origem_criada_idx
  on public.ia_execucoes (origem, criada_em desc);

alter table public.ia_execucoes enable row level security;

drop policy if exists cliente_le_as_proprias_execucoes on public.ia_execucoes;
create policy cliente_le_as_proprias_execucoes on public.ia_execucoes
  for select to authenticated using (cliente_id = public.cliente_do_usuario());

drop policy if exists agencia_escopo on public.ia_execucoes;
create policy agencia_escopo on public.ia_execucoes
  for select to authenticated using (cliente_id in (select public.lojas_da_agencia()));

drop policy if exists equipe_le_execucoes on public.ia_execucoes;
create policy equipe_le_execucoes on public.ia_execucoes
  for select to authenticated using (public.eh_equipe());

revoke insert, update, delete on public.ia_execucoes from anon, authenticated;

-- ---------- os preços ----------

create table if not exists public.ia_precos_modelo (
  modelo                 text not null,
  vigente_desde          date not null default current_date,
  -- em USD por MILHÃO de tokens
  entrada_por_milhao        numeric(10, 4),
  saida_por_milhao          numeric(10, 4),
  cache_leitura_por_milhao  numeric(10, 4),
  cache_escrita_por_milhao  numeric(10, 4),
  observacao             text,
  primary key (modelo, vigente_desde)
);

alter table public.ia_precos_modelo enable row level security;

drop policy if exists equipe_total on public.ia_precos_modelo;
create policy equipe_total on public.ia_precos_modelo
  for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());

-- ---------- o custo, calculado na leitura ----------

create or replace view public.ia_execucoes_custo
with (security_invoker = true)
as
select
  e.*,
  p.vigente_desde as preco_vigente_desde,
  case
    when p.modelo is null then null
    else
      coalesce(e.tokens_entrada, 0)        * coalesce(p.entrada_por_milhao, 0)       / 1000000.0
    + coalesce(e.tokens_saida, 0)          * coalesce(p.saida_por_milhao, 0)         / 1000000.0
    + coalesce(e.tokens_cache_lidos, 0)    * coalesce(p.cache_leitura_por_milhao, 0) / 1000000.0
    + coalesce(e.tokens_cache_escritos, 0) * coalesce(p.cache_escrita_por_milhao, 0) / 1000000.0
  end as custo_estimado_usd
from public.ia_execucoes e
left join lateral (
  select *
  from public.ia_precos_modelo pm
  where pm.modelo = e.modelo
    and pm.vigente_desde <= e.criada_em::date
  order by pm.vigente_desde desc
  limit 1
) p on true;

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('067', '067-as-execucoes-de-ia', now(),
        'ia_execucoes (uma linha por chamada paga, com tenant, modelo, tokens, latencia e desfecho — inclusive erro), ia_precos_modelo (vazia, preco por milhao com vigencia) e a view ia_execucoes_custo (custo calculado na leitura). RLS de leitura no molde de consumo_ia; escrita so por service_role.')
on conflict do nothing;
