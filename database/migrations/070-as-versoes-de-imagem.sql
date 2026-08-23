-- 070 — as versões de imagem geradas pela IA
--
-- NÃO APLICADA. Nasceu como arquivo, para o dono aplicar no projeto principal
-- (auditoria do Copilot, 2026-08-22, roadmap NEXT item 8 / trilha 5).
--
-- O QUE MUDA
--
-- Imagem era geração única: dois botões fixos, preview, Salvar ou Descartar.
-- Rejeitar = perder. "Não gostei, quero fundo branco e o produto maior" não
-- tinha caminho: nem motivo coletado, nem v2 a partir da v1, nem como voltar.
--
-- 1. `imagens_versoes`: uma linha por geração, com o BRIEFING que a produziu
--    (slot, instrução, feedback acumulado), o PAI (a versão da qual partiu),
--    o status, o provedor e o modelo. O feedback humano é a coluna que muda
--    o briefing seguinte — é o laço que não existia.
--
-- 2. O bucket PRIVADO `imagens-ia`: os rascunhos não são foto do produto
--    ainda, e o bucket público `produtos-imagens` expõe tudo a quem tiver a
--    URL. Só a versão APROVADA é copiada para o bucket público, porque é só
--    ela que o Mercado Livre precisa baixar. Decisão registrada: o bucket
--    público fica como está — trocá-lo por URL assinada alcança toda tela
--    que desenha foto e o PUT do ML, e isso é outra migração.
--
-- Escrita só pelo servidor (service_role); leitura no alcance de quem opera
-- a loja. A URL assinada é gerada pelo servidor a cada leitura.
--
-- REVERTER: drop table public.imagens_versoes; delete from storage.buckets
-- where id = 'imagens-ia'; voltar o check de copilot_propostas.tipo ao da 069.

create table if not exists public.imagens_versoes (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  produto_id    uuid not null references public.produtos(id) on delete cascade,
  -- A versão da qual esta partiu. NULL na primeira de uma linhagem.
  pai_id        uuid references public.imagens_versoes(id) on delete set null,
  -- capa | infografico | detalhe | medidas | humanizada | beneficios
  slot          text not null,
  -- { slot, instrucao, feedback: [..], fonte: { tipo: 'foto'|'versao', id } }
  briefing      jsonb not null,
  -- O que a pessoa disse desta versão ("fundo branco, produto maior").
  feedback      text,
  -- gerada | rejeitada | aprovada
  status        text not null default 'gerada',
  provedor      text,
  modelo        text,
  -- O caminho no bucket imagens-ia: <cliente_id>/<produto_id>/<id>.<ext>
  caminho       text not null,
  mime          text not null default 'image/png',
  -- Quando aprovada: a foto do produto que nasceu dela.
  imagem_produto_id uuid references public.imagens_produto(id) on delete set null,
  proposta_id   uuid references public.copilot_propostas(id) on delete set null,
  criada_por    uuid,
  criada_em     timestamptz not null default now()
);

create index if not exists imagens_versoes_produto_idx
  on public.imagens_versoes (cliente_id, produto_id, criada_em desc);

alter table public.imagens_versoes enable row level security;

drop policy if exists cliente_le_versoes on public.imagens_versoes;
create policy cliente_le_versoes on public.imagens_versoes
  for select to authenticated using (cliente_id = public.cliente_do_usuario());

drop policy if exists agencia_escopo on public.imagens_versoes;
create policy agencia_escopo on public.imagens_versoes
  for select to authenticated using (cliente_id in (select public.lojas_da_agencia()));

drop policy if exists equipe_le_versoes on public.imagens_versoes;
create policy equipe_le_versoes on public.imagens_versoes
  for select to authenticated using (public.eh_equipe());

revoke insert, update, delete on public.imagens_versoes from anon, authenticated;

-- ---------- o bucket privado ----------

insert into storage.buckets (id, name, public)
values ('imagens-ia', 'imagens-ia', false)
on conflict (id) do nothing;

-- Nenhuma policy de storage para `authenticated`: a leitura é por URL assinada
-- gerada pelo servidor, e a escrita é do service_role. Sem policy, o bucket
-- privado recusa tudo que não venha do servidor — que é o ponto.

-- ---------- a proposta de imagem ----------

alter table public.copilot_propostas
  drop constraint if exists copilot_propostas_tipo_check;

alter table public.copilot_propostas
  add constraint copilot_propostas_tipo_check
  check (tipo = any (array['peso'::text, 'custo'::text, 'cadastro'::text,
                           'titulo'::text, 'preco'::text,
                           'descricao'::text, 'palavras_chave'::text,
                           'publicacao'::text, 'tarefas'::text, 'imagem'::text]));

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('070', '070-as-versoes-de-imagem', now(),
        'imagens_versoes (briefing, pai, feedback, status, provedor/modelo) + bucket privado imagens-ia (URL assinada pelo servidor). Rascunho da IA nao e foto do produto; so a versao aprovada e copiada para produtos-imagens. Check de copilot_propostas.tipo ganha imagem.')
on conflict do nothing;
