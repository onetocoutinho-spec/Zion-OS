-- ============================================================
-- Zion OS — Migração 035: a Proposal do Copilot como primitive de segurança
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
--
-- O QUE ESTAVA FALTANDO
--
-- O Copilot já propunha mudanças e o lojista já confirmava — mas a proposta era
-- um objeto React em memória, e a confirmação era um clique num cartão que a
-- própria tela montou. Isso significa três buracos:
--
--   1. A autorização não tinha identidade. Qualquer objeto vindo do navegador
--      seria aceito como "o que o lojista aprovou".
--   2. A autorização não tinha validade. Uma proposta calculada com custo de
--      R$ 42 executava igual cinco minutos depois, com o custo já em R$ 55.
--   3. A autorização não tinha unicidade. Duplo clique, retry ou refresh
--      aplicariam a mesma mudança duas vezes.
--
-- Esta migração cria o substrato dessas três proteções. A lógica de decisão
-- vive no domínio puro (`modules/assistant/domain/propostaPersistida.ts`) e é
-- testada sem banco; aqui está só o que precisa ser durável e isolado.
--
-- POR QUE NÃO REUSAR `suggestion_offers` (025)
--
-- Aquela é a oferta do motor de sugestão da AIL: presa a um `pattern_id`, sem
-- ciclo de vida de aprovação, sem alvo múltiplo e sem expiração. Adjacente, não
-- equivalente. Encaixar o Copilot nela distorceria as duas — e a AIL não se
-- mexe sem autorização explícita. Ver COPILOT-001.
--
-- IDEMPOTÊNCIA — onde ela realmente mora
--
-- Não num `if` da aplicação: numa transição de status atômica. `executada` só
-- pode ser alcançada A PARTIR de `pendente`, e o UPDATE condicional faz o banco
-- arbitrar quem chegou primeiro. Duplo clique disputa a mesma linha; um ganha,
-- o outro recebe zero linhas afetadas e responde "já foi feito".
--
-- A chave de idempotência é um reforço para o caso de a requisição ser
-- reenviada antes de a primeira responder — aí nem o status ajuda, porque as
-- duas leram `pendente`.
--
-- ACESSO — o cliente NÃO escreve nestas tabelas
--
-- Toda escrita passa por rota autenticada no servidor, que deriva o tenant da
-- SESSÃO (nunca do corpo). O cliente tem apenas SELECT do que é dele, para a
-- tela conseguir reidratar a conversa. Dar-lhe UPDATE em `copilot_propostas`
-- seria deixá-lo marcar a própria proposta como executada.
-- ============================================================

-- ---------- conversas ----------

create table if not exists public.copilot_conversas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  -- Quem falou. Auditoria precisa do humano, não só do tenant.
  criada_por uuid references auth.users(id) on delete set null,
  titulo text,
  -- Onde a conversa foi aberta. "Por que não publicou?" na tela de um produto
  -- significa AQUELE produto — e sem isto a reidratação perde o sujeito.
  rota text,
  produto_id uuid references public.produtos(id) on delete set null,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);

create index if not exists copilot_conversas_cliente_idx
  on public.copilot_conversas (cliente_id, atualizada_em desc);

-- ---------- mensagens ----------

create table if not exists public.copilot_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.copilot_conversas(id) on delete cascade,
  -- Desnormalizado de propósito: a política de RLS precisa do tenant sem join,
  -- e uma política que depende de join é uma política que alguém desliga.
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  papel text not null check (papel in ('lojista', 'assistente')),
  texto text not null,
  -- As ferramentas que rodaram para produzir esta resposta. É o que permite
  -- reconstruir "de onde veio esse número" sem reprocessar a conversa.
  ferramentas text[] not null default '{}',
  tokens integer,
  criada_em timestamptz not null default now()
);

create index if not exists copilot_mensagens_conversa_idx
  on public.copilot_mensagens (conversa_id, criada_em);

-- ---------- propostas ----------

create table if not exists public.copilot_propostas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  conversa_id uuid not null references public.copilot_conversas(id) on delete cascade,
  criada_por uuid references auth.users(id) on delete set null,

  -- Lista fechada: o que não está aqui não executa. Ampliar exige migração, que
  -- é revisão — e não uma string nova que alguém passou numa terça.
  tipo text not null check (tipo in ('peso', 'custo')),
  risco text not null check (risco in ('leitura', 'baixo', 'medio', 'alto', 'critico')),
  status text not null default 'pendente'
    check (status in ('pendente','aprovada','rejeitada','expirada','executada','falhou','obsoleta')),

  -- ARRAY porque o escopo é o que se aprova. Quando o lote chegar, a proposta
  -- de 47 variantes executa 47 — nem 48 porque o filtro mudou, nem 46.
  alvos uuid[] not null check (array_length(alvos, 1) >= 1),
  -- Unidade canônica: gramas para peso, reais para custo.
  valor numeric not null,
  -- O texto que a pessoa LEU antes de confirmar. Guardado porque a auditoria
  -- precisa saber o que foi mostrado, não só o que foi gravado.
  resumo text not null,

  -- O estado do mundo quando a proposta nasceu. Guardamos o VALOR e não um
  -- hash: quando ela fica obsoleta, o lojista merece saber O QUE mudou.
  -- Formato: [{ "campo": "custo", "valorNaCriacao": 17.16 }]
  precondicoes jsonb not null default '[]'::jsonb,

  criada_em timestamptz not null default now(),
  expira_em timestamptz not null,
  decidida_em timestamptz,
  executada_em timestamptz,
  -- Sobrevive a reenvio antes da primeira resposta — quando nem o status ajuda,
  -- porque as duas requisições leram `pendente`.
  chave_idempotencia text,
  erro text
);

create index if not exists copilot_propostas_cliente_idx
  on public.copilot_propostas (cliente_id, status, criada_em desc);

-- A unicidade que fecha a corrida por reenvio. Parcial: só entre as pendentes
-- e executadas de um mesmo cliente, para não bloquear uma chave reaproveitada
-- depois de uma rejeição.
create unique index if not exists copilot_propostas_idempotencia_uk
  on public.copilot_propostas (cliente_id, chave_idempotencia)
  where chave_idempotencia is not null;

-- ---------- ações executadas (auditoria) ----------
--
-- A cadeia inteira, em uma linha por ação:
--
--   usuário → conversa → proposta → confirmação → revalidação → execução → resultado
--
-- Existe SEPARADA do Decision Journal da AIL de propósito. A AIL observa
-- correções de campos observados do produto e tem semântica própria (autoria,
-- padrões, maturação). Esta tabela responde outra pergunta: "o que o Copilot
-- fez, a mando de quem, sobre qual proposta". Fundir as duas faria uma delas
-- mentir. Ver COPILOT-001.
--
-- É isto que cobre a cegueira histórica ao PESO: `atualizarVariantesBulk` vai
-- direto ao repositório e a AIL não vê. A escrita continua igual — mas agora
-- deixa rastro aqui.

create table if not exists public.copilot_acoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  conversa_id uuid references public.copilot_conversas(id) on delete set null,
  proposta_id uuid references public.copilot_propostas(id) on delete set null,
  executada_por uuid references auth.users(id) on delete set null,

  ferramenta text not null,
  alvos uuid[] not null default '{}',
  -- ANTES e DEPOIS. Sem o antes, a auditoria diz o que ficou e não o que mudou
  -- — e é o que mudou que permite desfazer.
  antes jsonb,
  depois jsonb,

  resultado text not null check (resultado in ('sucesso','parcial','falhou','recusada')),
  -- Quantos alvos realmente mudaram. Numa execução parcial, 37 de 42 é a
  -- verdade; "sucesso" seria mentira e "falhou" também.
  afetados integer not null default 0,
  erro text,
  criada_em timestamptz not null default now()
);

create index if not exists copilot_acoes_cliente_idx
  on public.copilot_acoes (cliente_id, criada_em desc);
create index if not exists copilot_acoes_proposta_idx
  on public.copilot_acoes (proposta_id);

-- ============================================================
-- RLS — leitura do próprio tenant, escrita só pelo servidor
-- ============================================================

alter table public.copilot_conversas  enable row level security;
alter table public.copilot_mensagens  enable row level security;
alter table public.copilot_propostas  enable row level security;
alter table public.copilot_acoes      enable row level security;

-- O cliente do portal enxerga o que é dele. Nada de UPDATE ou INSERT: a
-- escrita passa pela rota autenticada, que usa a service key e deriva o tenant
-- da sessão. Um cliente com UPDATE em `copilot_propostas` marcaria a própria
-- proposta como executada e pularia a revalidação inteira.

do $$
begin
  if exists (select 1 from pg_proc where proname = 'cliente_do_usuario') then
    -- Reusa a função de tenancy que o portal já tem (005/029).
    execute $p$
      create policy copilot_conversas_leitura on public.copilot_conversas
        for select using (cliente_id = public.cliente_do_usuario());
    $p$;
    execute $p$
      create policy copilot_mensagens_leitura on public.copilot_mensagens
        for select using (cliente_id = public.cliente_do_usuario());
    $p$;
    execute $p$
      create policy copilot_propostas_leitura on public.copilot_propostas
        for select using (cliente_id = public.cliente_do_usuario());
    $p$;
    execute $p$
      create policy copilot_acoes_leitura on public.copilot_acoes
        for select using (cliente_id = public.cliente_do_usuario());
    $p$;
  else
    -- Sem a função de tenancy, NÃO criamos política permissiva. Tabela com RLS
    -- ligado e sem política nenhuma nega tudo — que é o padrão seguro. Melhor a
    -- tela não ler do que ler o tenant errado.
    raise notice 'cliente_do_usuario() ausente: RLS ligado sem politicas (nega tudo). Crie as politicas junto da funcao de tenancy.';
  end if;
exception when duplicate_object then
  raise notice 'politicas do copilot ja existiam; nada a fazer';
end $$;

-- ============================================================
-- Conferência
-- ============================================================
-- select table_name from information_schema.tables
--  where table_schema = 'public' and table_name like 'copilot_%';
--
-- Esperado: copilot_acoes, copilot_conversas, copilot_mensagens, copilot_propostas
