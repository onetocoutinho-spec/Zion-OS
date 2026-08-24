-- 071 — as INVESTIGAÇÕES do Copilot
--
-- NÃO APLICADA. Nasce como arquivo, para o dono aplicar (Operador Universal,
-- 2026-08-24, etapa 5 do plano).
--
-- ===========================================================================
-- O PROBLEMA QUE ESTA TABELA RESOLVE
-- ===========================================================================
--
-- Um turno do chat cabe em uma requisição HTTP: seis passos, 45 segundos de
-- orçamento, `maxDuration` de 60. Isso responde bem "quantos produtos estão
-- sem peso?" e não responde "descobre o que está errado nessa loja" — o
-- pedido que o dono descreveu em 24/08/2026 e que tem dez a vinte operações:
-- achar o produto, achar os SKUs, achar os anúncios, ler o estado de cada um,
-- comparar, diagnosticar, propor.
--
-- A saída NÃO é aumentar o teto: a plataforma mata a função, e um turno que
-- morre no meio perde tudo que já tinha descoberto.
--
-- ===========================================================================
-- A DECISÃO: RODADAS, NÃO UM TURNO MAIOR
-- ===========================================================================
--
-- A investigação vira um RASCUNHO que atravessa turnos, do mesmo jeito que
-- `copilot_cadastros` (037) faz o cadastro em conversa atravessar falas.
-- Cada turno gasta os seis passos que tem, grava o que descobriu, e a
-- conversa seguinte continua de onde parou — com os achados no contexto.
--
-- Por que assim, e não com um worker no cron (o padrão da
-- `fila_otimizacao_produto`): o worker não tem sessão, e o contexto de
-- ferramentas do Copilot é construído a partir dela — papel, loja, permissão.
-- Reconstruí-lo sem sessão seria duplicar a fronteira de tenancy no lugar mais
-- perigoso possível. A investigação por rodadas reusa o caminho autenticado
-- que já existe, inteiro.
--
-- ===========================================================================
-- O QUE ELA NÃO É
-- ===========================================================================
--
-- Não é autorização para nada. Uma investigação só LÊ e ANOTA; toda escrita
-- continua passando por `copilot_propostas` e pelo clique humano. É por isso
-- que a tabela não tem `alvos`, não tem `valor` e não tem `status: executada`.

create table if not exists public.copilot_investigacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  usuario_id uuid references auth.users (id) on delete set null,
  conversa_id uuid references public.copilot_conversas (id) on delete cascade,

  -- O que se quer descobrir, na palavra de quem pediu.
  pergunta text not null,

  -- aberta | concluida | abandonada
  --
  -- Não há "erro": uma rodada que falha não invalida o que as anteriores
  -- descobriram. O que falhou vira um achado com a fonte, como já acontece
  -- quando uma ferramenta explode dentro de um turno.
  status text not null default 'aberta',

  -- Quantas rodadas já foram gastas. É o teto que impede uma investigação
  -- eterna consumindo cota a cada pergunta.
  rodadas integer not null default 0,

  -- O que já se descobriu: [{rodada, texto, ferramentas[], em}].
  -- Array e não tabela filha porque nada consulta um achado isolado — ele só
  -- existe dentro da investigação, e sempre inteiro.
  achados jsonb not null default '[]'::jsonb,

  -- O que ainda falta, escrito pelo modelo ao fim de cada rodada. É isto que
  -- a rodada seguinte lê para saber por onde continuar.
  proximo_passo text not null default '',

  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);

-- Uma investigação ABERTA por conversa. Duas seriam duas memórias
-- competindo pelo mesmo fio, e o modelo não teria como escolher.
create unique index if not exists copilot_investigacoes_uma_aberta_por_conversa
  on public.copilot_investigacoes (conversa_id)
  where status = 'aberta' and conversa_id is not null;

create index if not exists copilot_investigacoes_cliente_idx
  on public.copilot_investigacoes (cliente_id, status, atualizada_em desc);

alter table public.copilot_investigacoes enable row level security;

-- LEITURA por tenant; ESCRITA só pelo servidor.
--
-- O mesmo desenho das outras tabelas do copiloto (035): dar UPDATE ao
-- navegador numa tabela que o modelo lê seria deixar o cliente escrever o
-- próprio contexto — o buraco que a Proposal persistida fechou.
drop policy if exists cliente_escopo on public.copilot_investigacoes;
create policy cliente_escopo on public.copilot_investigacoes
  for select to authenticated
  using (cliente_id = public.cliente_do_usuario());

drop policy if exists agencia_escopo on public.copilot_investigacoes;
create policy agencia_escopo on public.copilot_investigacoes
  for select to authenticated
  using (cliente_id in (select public.lojas_da_agencia()));

drop policy if exists equipe_total on public.copilot_investigacoes;
create policy equipe_total on public.copilot_investigacoes
  for select to authenticated using (public.eh_equipe());

revoke insert, update, delete on public.copilot_investigacoes from anon, authenticated;

-- Depois de aplicar: rodar database/verificacoes/alcance-da-agencia.sql.
-- A tabela está classificada lá como operação da agência (ela opera a loja e
-- precisa ver o que o Copilot investigou nela).
