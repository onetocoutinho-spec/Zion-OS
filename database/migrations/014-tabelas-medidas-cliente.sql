-- ============================================================
-- Zion OS — Migração 014: Tabelas de medidas gerenciáveis por cliente
--
-- INCREMENTAL. Rode UMA vez no SQL Editor, depois da 013.
--
-- Cada cliente cria suas próprias tabelas de medidas (calçado, roupa P/M/G,
-- etc.). Quando `marca` está preenchida, a tabela aplica a TODOS os produtos
-- daquela marca (massa). O override por produto (produtos.tabela_medidas)
-- continua tendo prioridade sobre esta.
-- ============================================================

create table if not exists public.tabelas_medidas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null default '',
  -- Quando preenchida, a tabela vale para todos os produtos desta marca.
  marca text default '',
  como_medir text default '',
  -- Linhas: [{ "rotulo": "37/38", "valor": "24,5 cm" }, ...]
  linhas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tabmed_cliente on public.tabelas_medidas (cliente_id);
create index if not exists idx_tabmed_marca on public.tabelas_medidas (cliente_id, marca);
create trigger trg_tabmed_updated_at
  before update on public.tabelas_medidas
  for each row execute function public.set_updated_at();

alter table public.tabelas_medidas enable row level security;
drop policy if exists "cliente_escopo" on public.tabelas_medidas;
create policy "cliente_escopo" on public.tabelas_medidas
  for all to authenticated
  using (cliente_id = public.cliente_do_usuario() or public.eh_equipe())
  with check (cliente_id = public.cliente_do_usuario() or public.eh_equipe());
