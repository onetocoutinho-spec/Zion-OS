-- ============================================================
-- Zion OS — Migração 012: Fila de otimização por produto
--
-- INCREMENTAL. Rode UMA vez no SQL Editor, depois da 011.
--
-- Fila para o "Otimizar tudo" rodar no SERVIDOR (worker + Vercel Cron), sem
-- depender da aba aberta. O cliente enfileira os produtos; o worker consome
-- (service_role, ignora RLS) rodando a esteira e gravando os anúncios.
-- ============================================================

create table if not exists public.fila_otimizacao_produto (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  -- pendente | processando | concluido | erro
  status text not null default 'pendente',
  tentativas integer not null default 0,
  erro text default '',
  anuncio_id uuid references public.anuncios_gerados (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (produto_id) -- 1 item de fila por produto (reenfileirar atualiza)
);
create index if not exists idx_fila_op_status on public.fila_otimizacao_produto (status);
create index if not exists idx_fila_op_cliente on public.fila_otimizacao_produto (cliente_id);
create trigger trg_fila_op_updated_at
  before update on public.fila_otimizacao_produto
  for each row execute function public.set_updated_at();

-- RLS: o cliente enfileira e lê o status da PRÓPRIA fila; a equipe vê tudo.
-- (O worker usa a chave service_role e ignora a RLS.)
alter table public.fila_otimizacao_produto enable row level security;
drop policy if exists "cliente_escopo" on public.fila_otimizacao_produto;
create policy "cliente_escopo" on public.fila_otimizacao_produto
  for all to authenticated
  using (cliente_id = public.cliente_do_usuario() or public.eh_equipe())
  with check (cliente_id = public.cliente_do_usuario() or public.eh_equipe());
