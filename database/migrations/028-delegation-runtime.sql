-- ============================================================
-- Zion OS — Migração 028: Delegation Runtime (E5.10b)
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
-- Fatos append-only de DELEGAÇÃO: a concessão (e revogação) da autoridade
-- de executar um Knowledge institucional VIGENTE. Nunca depende de
-- Confidence — Confidence mede aprendizagem; Knowledge representa decisão
-- institucional (ADR-002 Q8).
--
-- A revogação fecha a torneira FUTURA; o passado permanece (o espelho da
-- desconexão de canal — PR-011). Execuções delegadas são auditadas no
-- LEDGER DE OFERTAS existente (assinadas por sistema:delegation-runtime,
-- correlacao 'delegacao:<id>') — Outcomes as observam automaticamente.
-- ============================================================

create table if not exists public.delegacoes (
  id uuid primary key,               -- identidade do domínio (R-INF-001)

  -- O escopo delegado = o slot do Knowledge (ADR-002 Q8):
  empresa text not null,
  contexto text not null,
  campo text not null,

  -- O Knowledge que fundamenta a delegação (com a versão exata):
  knowledge_pattern_id text not null,
  knowledge_versao integer not null,
  valor_delegado text not null,      -- o valor institucional no instante

  tipo text not null,                -- 'concessao' | 'revogacao'
  delegado_por text not null,        -- a AUTORIDADE humana (assinada; nunca vazia)
  motivo text not null,

  -- A assinatura VERSIONADA do executor (E5.9 — sistema:delegation-runtime):
  assinatura jsonb not null,
  -- As evidências que sustentaram o ato (fotografia do Knowledge vigente):
  evidencias jsonb not null,

  ocorrido_em timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_delegacoes_empresa on public.delegacoes (empresa);
create index if not exists idx_delegacoes_slot on public.delegacoes (empresa, contexto, campo);

alter table public.delegacoes enable row level security;

create policy "equipe_autenticada" on public.delegacoes
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- VERIFICAÇÃO:  select count(*) from public.delegacoes;   -- esperado: 0
-- REVERTER:     drop table if exists public.delegacoes;
--               delete from public.migracoes_aplicadas where numero = '028';
-- ------------------------------------------------------------

-- ★ Auto-registro (convenção ≥024):
insert into public.migracoes_aplicadas (numero, nome, observacao)
values ('028','028-delegation-runtime','fatos append-only de delegacao sobre Knowledge vigente — E5.10b')
on conflict (numero) do nothing;
