-- ============================================================
-- Zion OS — Migração 023: Pattern Detector (Adaptive Intelligence Layer)
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
-- Materializa os Patterns detectados no Decision Journal (Release R-PD-1).
-- A tabela é uma PROJEÇÃO do log `decisoes` (ARQ-003 §5): descartável e
-- reconstituível a qualquer momento reexecutando o Detector (determinístico).
-- ============================================================

create table if not exists public.padroes (
  -- PatternId: SHA-256 (hex, 64 chars) da PatternKey canônica — identidade
  -- nasce no DOMÍNIO e é preservada via Repository.salvar() (R-INF-001).
  -- Nota: a coluna chama-se `id` porque o contrato do Repository Pattern
  -- (criarRepositorio/salvar, upsert onConflict:"id") exige o PK com esse
  -- nome; o CONTEÚDO é o PatternId. Sem default: id ausente falha alto.
  id text primary key,

  -- PatternKey canônica textual (JSON da quádrupla) — armazenada para
  -- explicabilidade (RFC-AIL-002 §8: "qual Pattern?" responde-se com a chave).
  pattern_key text not null,

  -- Componentes canônicos da chave como colunas de primeira classe
  -- (RFC-AIL-003 §3.2; o slot (empresa, contexto, campo) é consultável):
  empresa text not null,             -- tenant (isolamento — ARQ-003 princ. 8)
  contexto text not null,            -- Bounded Context canônico
  campo text not null,               -- assunto decidido
  valor text not null,               -- o valorNovo canônico (o que se aprende)

  -- Acúmulos derivados (RFC-AIL-004 §4.2/§5 — recomputados, nunca mutados ad hoc):
  ocorrencias integer not null,      -- |DecisionIds distintos| (monotônico)
  confidence text not null,          -- observado | recorrente | consistente (§4.3)
  estado text not null,              -- emergente | estabelecido (§4.3)
  estado_slot text not null,         -- emergente | consistente | em_disputa (§4.4)
  primeira_ocorrencia timestamptz not null,  -- min(decidido_em) dos suportes
  ultima_ocorrencia timestamptz not null,    -- max(decidido_em) dos suportes
  decisoes_de_suporte jsonb not null default '[]'::jsonb,  -- DecisionIds (explicabilidade)

  created_at timestamptz not null default now(),
  -- updated_at é CONTROLADO PELA APLICAÇÃO (definido a cada materialização
  -- pelo Detector). Deliberadamente SEM trigger.
  updated_at timestamptz not null default now()
);

create index if not exists idx_padroes_empresa on public.padroes (empresa);
-- O slot (empresa, contexto, campo) — agrupamento da consistência (RFC-AIL-003
-- §3.3) e a consulta que o futuro Suggestion Engine fará (pull por slot).
create index if not exists idx_padroes_slot on public.padroes (empresa, contexto, campo);

alter table public.padroes enable row level security;

create policy "equipe_autenticada" on public.padroes
  for all to authenticated using (true) with check (true);

-- Sem trigger de updated_at (controlado pela aplicação, por instrução).
-- Sem realtime: projeção interna; nenhuma tela consome (R-PD-1: sem UI, sem ação).
