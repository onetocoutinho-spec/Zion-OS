-- ============================================================
-- Zion OS — Migração 017: Organizações (tenant / agência)
--
-- Fundação canônica (PR-006). Base para 000-business-domain / 001-product-master.
-- INCREMENTAL, IDEMPOTENTE e REVERSÍVEL. NÃO destrói dados.
-- Rode UMA vez no SQL Editor, DEPOIS da 016. Valide em staging primeiro.
--
-- O QUE FAZ:
--   Cria a `organizacoes` — o tenant/agência acima de `clientes` (000). É uma
--   tabela NOVA e dormente: nenhuma tabela existente é alterada, nenhum dado é
--   tocado, nenhum comportamento do app atual muda (Strangler Fig).
--
-- O QUE NÃO FAZ (de propósito):
--   NÃO adiciona `organizacao_id` em `clientes`/`perfis` nem faz backfill — esse
--   vínculo e a migração de dados ficam para a migração de backfill (fora deste
--   PR). As tabelas canônicas (018–021) carregam `organizacao_id` próprio.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabela organizacoes
-- ------------------------------------------------------------
create table if not exists public.organizacoes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  documento     text,                       -- CNPJ/ref (nullable)
  status        text not null default 'ativo',   -- ativo | inativo
  observacoes   text default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint organizacoes_status_chk check (status in ('ativo','inativo'))
);

-- ------------------------------------------------------------
-- 2) Trigger updated_at (idempotente)
-- ------------------------------------------------------------
drop trigger if exists trg_organizacoes_updated_at on public.organizacoes;
create trigger trg_organizacoes_updated_at
  before update on public.organizacoes
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3) RLS: só a EQUIPE gerencia organizações (estrutura de tenant não é do
--    cliente — mesmo princípio de canais_marketplace/009). Deny-by-default
--    herdado de eh_equipe() (016): sem perfil = sem acesso.
-- ------------------------------------------------------------
alter table public.organizacoes enable row level security;

drop policy if exists "equipe_total" on public.organizacoes;
create policy "equipe_total" on public.organizacoes
  for all to authenticated
  using (public.eh_equipe())
  with check (public.eh_equipe());

-- ============================================================
-- REVERTER (não afeta nenhuma tabela existente):
--   drop policy if exists "equipe_total" on public.organizacoes;
--   drop trigger if exists trg_organizacoes_updated_at on public.organizacoes;
--   drop table if exists public.organizacoes;   -- só se 018–021 já revertidas
-- ============================================================
