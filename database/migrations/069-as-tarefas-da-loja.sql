-- 069 — as tarefas DA LOJA
--
-- APLICADA em 2026-08-23 no projeto principal. Nasceu como arquivo
-- (auditoria do Copilot, 2026-08-22, roadmap NEXT item 6 — "cria as tarefas").
--
-- DECISÃO DE PRODUTO, registrada aqui porque a alternativa parecia óbvia e
-- estava errada: a tabela `tarefas` que já existe é NOTA DA ZION SOBRE O
-- CLIENTE (responsável, prazo, próxima ação) e a 055b a tirou do alcance da
-- agência exatamente por isso. "Cria as tarefas" no Copilot é outra coisa: a
-- lista de coisas que a LOJA decidiu fazer — "conferir estoque da Sandália B",
-- "revisar o preço dos que caíram" — escrita por ela (ou pela agência em nome
-- dela), a partir de um diagnóstico. Misturar as duas colocaria nota interna
-- da Zion na tela da lojista ou tarefa da lojista na gestão da Zion.
--
-- Então: `tarefas_da_loja`, com `cliente_id`, no alcance de quem opera a
-- loja. O Copilot PROPÕE (proposta tipo `tarefas`, risco baixo — criar uma
-- lista é reversível com um clique) e só o clique grava.
--
-- O check de `copilot_propostas.tipo` ganha `tarefas` (o mesmo sintoma da
-- 058/066: sem isto, `criarProposta` falha e o chat responde sem cartão).
--
-- REVERTER: drop table public.tarefas_da_loja; voltar o check ao da 066.

create table if not exists public.tarefas_da_loja (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  titulo        text not null,
  -- POR QUE: o número ou fato que motivou ("sumiu das vendas nos últimos 30 dias").
  motivo        text,
  -- copilot | manual
  origem        text not null default 'manual',
  -- aberta | feita | descartada
  status        text not null default 'aberta',
  -- alta | media | baixa
  prioridade    text not null default 'media',
  produto_id    uuid references public.produtos(id) on delete set null,
  proposta_id   uuid references public.copilot_propostas(id) on delete set null,
  criada_por    uuid,
  criada_em     timestamptz not null default now(),
  concluida_em  timestamptz
);

create index if not exists tarefas_da_loja_cliente_status_idx
  on public.tarefas_da_loja (cliente_id, status, criada_em desc);

alter table public.tarefas_da_loja enable row level security;

drop policy if exists cliente_escopo on public.tarefas_da_loja;
create policy cliente_escopo on public.tarefas_da_loja
  for all to authenticated
  using (cliente_id = public.cliente_do_usuario())
  with check (cliente_id = public.cliente_do_usuario());

drop policy if exists agencia_escopo on public.tarefas_da_loja;
create policy agencia_escopo on public.tarefas_da_loja
  for all to authenticated
  using (cliente_id in (select public.lojas_da_agencia()))
  with check (cliente_id in (select public.lojas_da_agencia()));

drop policy if exists equipe_total on public.tarefas_da_loja;
create policy equipe_total on public.tarefas_da_loja
  for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());

alter table public.copilot_propostas
  drop constraint if exists copilot_propostas_tipo_check;

alter table public.copilot_propostas
  add constraint copilot_propostas_tipo_check
  check (tipo = any (array['peso'::text, 'custo'::text, 'cadastro'::text,
                           'titulo'::text, 'preco'::text,
                           'descricao'::text, 'palavras_chave'::text,
                           'publicacao'::text, 'tarefas'::text]));

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('069', '069-as-tarefas-da-loja', now(),
        'tarefas_da_loja: a lista de coisas que a LOJA decidiu fazer (distinta de tarefas, que e nota da Zion sobre o cliente — 055b). O Copilot propoe (tipo tarefas, risco baixo) e o clique grava. Check de copilot_propostas.tipo ganha tarefas. RLS: cliente a propria, agencia o escopo, equipe tudo.')
on conflict do nothing;
