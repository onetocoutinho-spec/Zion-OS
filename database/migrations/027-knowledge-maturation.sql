-- ============================================================
-- Zion OS — Migração 027: Knowledge Maturation (E5.10a — executa a ADR-002)
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
-- Materializa o agregado Knowledge da ADR-002: FATOS append-only de
-- maturação (promoção/rebaixamento) que REFERENCIAM o Pattern (pattern_id)
-- e CONGELAM a fotografia da evidência no instante. O estado vigente é
-- PROJEÇÃO sobre estes fatos — jamais uma coluna de status.
--
-- Log APPEND-ONLY: linhas nunca são editadas nem apagadas
-- ("esquecer não é apagar" — agora também para o conhecimento institucional).
-- ============================================================

create table if not exists public.conhecimentos (
  -- Identidade nasce no DOMÍNIO (contrato R-INF-001). Sem default.
  id uuid primary key,

  -- O Pattern de origem (referência — ADR-002 Q1) e o slot institucional:
  pattern_id text not null,
  empresa text not null,
  contexto text not null,
  campo text not null,
  valor text not null,               -- o valor institucionalizado (fotografado)

  -- O fato de maturação:
  tipo text not null,                -- 'promocao' | 'rebaixamento'
  versao integer not null,           -- promocao: versão criada; rebaixamento: versão rebaixada
  autor_humano text not null,        -- QUEM assinou (e-mail da sessão — ADR-002 Q3; nunca vazio)
  motivo text not null,              -- obrigatório (mitigação "carimbo sem leitura")

  -- A fotografia congelada da evidência no instante (ADR-002 Q7/Q9):
  fotografia jsonb not null,

  -- Sob qual política este fato foi produzido (ADR-002 Q9):
  versao_politica text not null,     -- 'ADR-002 v1'

  ocorrido_em timestamptz not null,  -- QUANDO (domínio)
  created_at timestamptz not null default now()
);

create index if not exists idx_conhecimentos_empresa on public.conhecimentos (empresa);
create index if not exists idx_conhecimentos_pattern on public.conhecimentos (pattern_id);

alter table public.conhecimentos enable row level security;

create policy "equipe_autenticada" on public.conhecimentos
  for all to authenticated using (true) with check (true);

-- Sem updated_at/trigger: log append-only. Sem realtime.

-- ------------------------------------------------------------
-- VERIFICAÇÃO (somente leitura):
--   select count(*) as fatos from public.conhecimentos;              -- esperado: 0
--   select policyname from pg_policies where tablename='conhecimentos';
--
-- REVERTER:
--   drop table if exists public.conhecimentos;
--   delete from public.migracoes_aplicadas where numero = '027';
-- ------------------------------------------------------------

-- ★ Auto-registro (convenção ≥024):
insert into public.migracoes_aplicadas (numero, nome, observacao)
values ('027','027-knowledge-maturation','fatos append-only de maturacao do Knowledge — executa a ADR-002 (E5.10a)')
on conflict (numero) do nothing;
