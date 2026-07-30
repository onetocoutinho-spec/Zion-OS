-- ============================================================
-- Zion OS — Migração 021: Versão do Produto Mestre (histórico imutável)
--
-- Fundação canônica (PR-006). Ver 001-product-master §8 (toda mudança material
-- versiona) e o agregado ProdutoMestre (puxarEventos/versionar). Tabela NOVA e
-- dormente; nenhuma tabela existente é tocada.
--
-- INCREMENTAL, IDEMPOTENTE e REVERSÍVEL. NÃO destrói dados.
-- Rode UMA vez no SQL Editor, DEPOIS da 020. Valide em staging primeiro.
--
-- IMUTÁVEL / append-only: cada versão é um fato histórico. Por isso NÃO tem
-- `updated_at` nem trigger — só `created_at`. Correções são NOVAS versões.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabela produto_mestre_versao
-- ------------------------------------------------------------
create table if not exists public.produto_mestre_versao (
  id                uuid primary key default gen_random_uuid(),
  organizacao_id    uuid not null references public.organizacoes (id)    on delete cascade,
  cliente_id        uuid not null references public.clientes (id)        on delete cascade,
  produto_mestre_id uuid not null references public.produto_mestre (id)  on delete cascade,
  versao            integer not null,
  snapshot          jsonb not null default '{}'::jsonb,   -- estado do conteúdo na versão
  diff              jsonb not null default '[]'::jsonb,   -- [{campo, antes, depois}]
  autor_tipo        text not null,          -- humano | agente
  autor_id          text not null default '',
  agente_codigo     text,                   -- A0..A12 (quando autor_tipo='agente')
  confianca         numeric(5,4),           -- 0..1 (quando aplicável)
  created_at        timestamptz not null default now(),
  constraint produto_mestre_versao_autor_chk
    check (autor_tipo in ('humano','agente')),
  constraint produto_mestre_versao_num_chk
    check (versao >= 1),
  constraint produto_mestre_versao_confianca_chk
    check (confianca is null or (confianca >= 0 and confianca <= 1)),
  -- Uma linha por (produto, versão): impede duplicar a mesma versão.
  constraint produto_mestre_versao_uk
    unique (produto_mestre_id, versao)
);

-- ------------------------------------------------------------
-- 2) Índices
-- ------------------------------------------------------------
create index if not exists idx_pm_versao_mestre  on public.produto_mestre_versao (produto_mestre_id);
create index if not exists idx_pm_versao_cliente on public.produto_mestre_versao (cliente_id);

-- (Sem trigger updated_at: tabela imutável / append-only.)

-- ------------------------------------------------------------
-- 3) RLS: escopo por cliente (mesmo padrão). Deny-by-default (016).
-- ------------------------------------------------------------
alter table public.produto_mestre_versao enable row level security;

drop policy if exists "cliente_escopo" on public.produto_mestre_versao;
create policy "cliente_escopo" on public.produto_mestre_versao
  for all to authenticated
  using (cliente_id = public.cliente_do_usuario() or public.eh_equipe())
  with check (cliente_id = public.cliente_do_usuario() or public.eh_equipe());

-- ============================================================
-- REVERTER (não afeta nenhuma tabela existente):
--   drop policy if exists "cliente_escopo" on public.produto_mestre_versao;
--   drop table if exists public.produto_mestre_versao;
-- ============================================================
