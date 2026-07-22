-- ============================================================
-- Zion OS — Migração 022: Decision Journal (Adaptive Intelligence Layer)
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
-- Persiste as Decisions observadas pelo Decision Journal (Release R-DJ-3).
-- Log APPEND-ONLY: linhas nunca são editadas nem apagadas (auditoria — RFC-AIL-001 §8).
-- ============================================================

create table if not exists public.decisoes (
  -- A identidade NASCE NO DOMÍNIO: o Producer gera o DecisionId e a persistência
  -- apenas o registra (contrato R-INF-001 / repository-pattern-identity.md).
  -- Deliberadamente SEM default: um insert sem id deve falhar alto, nunca ser
  -- mascarado por um id gerado pelo banco.
  id uuid primary key,

  -- Tenant (isolamento por empresa — ARQ-003 princ. 8). Texto e SEM FK:
  -- o módulo adaptive-intelligence é isolado e não se acopla ao schema de
  -- outros contextos (ARQ-003 princ. 12).
  empresa text not null,

  autor text not null default '',
  contexto text not null,            -- Bounded Context canônico (ex.: catalogo)
  entidade_tipo text not null,       -- onde a decisão ocorreu (não participa da Pattern Key)
  entidade_id text not null,
  campo text not null,               -- assunto decidido (ex.: informacaoPendente)
  valor_anterior text,               -- o que o sistema propôs (null = informação ausente)
  valor_novo text not null,          -- a escolha do cliente (RFC-AIL-003: parte da Pattern Key)
  origem text not null default '',   -- tela/ação de origem (rastreabilidade — RFC-AIL-001 §5)

  -- ── DOIS conceitos temporais, deliberadamente distintos ─────────────────
  -- decidido_em  = Decision.timestamp — QUANDO o cliente decidiu (DOMÍNIO).
  -- created_at   = o instante em que a PERSISTÊNCIA registrou a linha (infra).
  -- created_at NUNCA representa a decisão de negócio: toda semântica temporal
  -- de aprendizado (recência, janelas — RFC-AIL-002 §7) usa decidido_em.
  decidido_em timestamptz not null,

  correlacao text,                   -- liga decisões da mesma sessão/passada (nullable)
  metadados jsonb,                   -- extensão futura, sem quebrar o modelo (nullable)

  created_at timestamptz not null default now()
);

create index if not exists idx_decisoes_empresa on public.decisoes (empresa);

alter table public.decisoes enable row level security;

create policy "equipe_autenticada" on public.decisoes
  for all to authenticated using (true) with check (true);

-- Sem updated_at/trigger: o log é append-only, nunca editado.
-- Sem realtime: observador lateral (ARQ-003 §3.1) — nenhuma tela consome este log.
