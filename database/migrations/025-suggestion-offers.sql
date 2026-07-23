-- ============================================================
-- Zion OS — Migração 025: Registro de Ofertas (Suggestion Engine, E4.2)
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
-- Materializa a ADR-001 (Suggestion Memory): "a Suggestion é efêmera como
-- OFERTA; o FATO de ter sido oferecida é histórico e imutável."
--
-- Log APPEND-ONLY: linhas nunca são editadas nem apagadas. O Outcome NÃO
-- vive aqui — será PROJEÇÃO futura: Outcomes = f(ofertas × decisoes).
-- ============================================================

create table if not exists public.ofertas (
  -- OfferId nasce no DOMÍNIO (contrato R-INF-001). Sem default: um insert
  -- sem id deve falhar alto, nunca ser mascarado por id gerado pelo banco.
  id uuid primary key,

  -- Decision Context — o slot da decisão em andamento (RFC-AIL-003 §3.3).
  -- Texto e SEM FK: o módulo adaptive-intelligence é isolado (ARQ-003 pr. 12).
  empresa text not null,
  contexto text not null,
  campo text not null,
  entidade_tipo text,                -- entidade em edição (null em criação)
  entidade_id text,

  -- O que foi oferecido, com a base CONGELADA no instante (a projeção
  -- `padroes` evolui; a oferta registra o que o operador viu):
  pattern_id text not null,          -- o Pattern de origem (SHA-256 da chave)
  valor_oferecido text not null,
  confidence_utilizada text not null,
  ocorrencias_no_momento integer not null,

  -- Auditoria: o sistema ASSINA o que oferece (fecha metade da lacuna S-30).
  autor_da_oferta text not null,     -- 'suggestion-engine'
  versao_contrato text not null,     -- contrato de elegibilidade vigente
  origem_explicacao text not null,   -- de onde veio a explicação exibida
  correlacao text,                   -- dedup futuro (ADR-001 QA3) — nullable

  oferecida_em timestamptz not null, -- QUANDO a oferta aconteceu (domínio)
  created_at timestamptz not null default now()  -- quando a persistência gravou
);

create index if not exists idx_ofertas_empresa on public.ofertas (empresa);
-- A consulta que a projeção de Outcomes fará: ofertas × decisões do slot.
create index if not exists idx_ofertas_slot on public.ofertas (empresa, contexto, campo);

alter table public.ofertas enable row level security;

create policy "equipe_autenticada" on public.ofertas
  for all to authenticated using (true) with check (true);

-- Sem updated_at/trigger: o log é append-only, nunca editado.
-- Sem realtime: fato de auditoria; nenhuma tela consome este log em tempo real.

-- ------------------------------------------------------------
-- VERIFICAÇÃO (somente leitura):
--   select count(*) as ofertas from public.ofertas;               -- esperado: 0
--   select policyname from pg_policies where tablename = 'ofertas'; -- equipe_autenticada
--
-- REVERTER (remove só o registro de ofertas; nada mais depende dele):
--   drop table if exists public.ofertas;
--   delete from public.migracoes_aplicadas where numero = '025';
-- ------------------------------------------------------------

-- ★ Auto-registro (convenção ≥024):
insert into public.migracoes_aplicadas (numero, nome, observacao)
values ('025','025-suggestion-offers','registro append-only de ofertas — ADR-001 materializada (release E4.2)')
on conflict (numero) do nothing;
