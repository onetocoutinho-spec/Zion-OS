-- ============================================================
-- Zion OS — Migração 029: margem mínima é escolha do lojista
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
--
-- Até aqui a margem mínima (5%) vivia como número mágico no código: a Zion
-- decidia qual lucro era aceitável para o cliente. No self-service isso não se
-- sustenta — quem escolhe a margem é quem vende.
--
-- O default 5 preserva exatamente o comportamento atual: nenhum cliente vê
-- número diferente até mexer no valor. NOT NULL para que "não escolheu" nunca
-- signifique "sem piso".
--
-- ACESSO — segue o padrão do portal (migração 005): o cliente NÃO lê nem
-- escreve `clientes` direto (a tabela só tem a política `equipe_total`). O
-- acesso é por funções security definer que expõem EXATAMENTE um campo. Uma
-- política de update na tabela deixaria o cliente alterar plano, status e
-- risco da própria conta — poder que ele não deve ter.
--
-- NÃO ENTRA NESTA MIGRAÇÃO (decisão consciente):
--   comissão, custo por unidade e frete. Os três dependem de peso, dimensão,
--   categoria e reputação — `produtos` ainda não tem peso, então guardá-los
--   como número único por cliente só trocaria um chute da Zion por um chute do
--   cliente. Ficam como parâmetro no código (modules/pricing) até haver peso.
-- ============================================================

alter table public.clientes
  add column if not exists margem_minima numeric(5,2) not null default 5;

-- Faixa de sanidade. O app valida antes; isto é a segunda camada.
-- Margem negativa não é piso, e acima de 60% o preço mínimo dispara para
-- valores que não vendem.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clientes_margem_minima_faixa'
  ) then
    alter table public.clientes
      add constraint clientes_margem_minima_faixa
      check (margem_minima >= 0 and margem_minima <= 60);
  end if;
end $$;

comment on column public.clientes.margem_minima is
  'Margem mínima de lucro (%) escolhida pelo lojista. Piso do cálculo de preço ideal. Default 5 = comportamento anterior ao self-service.';

-- ---- Leitura pelo portal ----------------------------------------------------
-- Devolve o default (5) quando o usuário não é cliente: o portal nunca fica
-- sem piso, e a equipe usa a coluna direto pela política `equipe_total`.
create or replace function public.portal_margem_minima()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(
    (select c.margem_minima from public.clientes c where c.id = public.cliente_do_usuario()),
    5
  );
$$;

-- ---- Escrita pelo portal ----------------------------------------------------
-- Escreve UM campo, na própria linha, com a faixa revalidada aqui. Devolve a
-- margem efetivamente gravada — quem chamou nunca precisa supor que deu certo.
create or replace function public.portal_definir_margem_minima(nova numeric)
returns numeric language plpgsql volatile security definer set search_path = public as $$
declare
  alvo uuid := public.cliente_do_usuario();
  gravada numeric;
begin
  if alvo is null then
    raise exception 'Apenas o próprio cliente pode definir a margem mínima.';
  end if;
  if nova is null or nova < 0 or nova > 60 then
    raise exception 'Margem mínima fora da faixa permitida (0 a 60).';
  end if;
  update public.clientes set margem_minima = nova where id = alvo
    returning margem_minima into gravada;
  return gravada;
end $$;

revoke all on function public.portal_margem_minima() from public;
revoke all on function public.portal_definir_margem_minima(numeric) from public;
grant execute on function public.portal_margem_minima() to authenticated;
grant execute on function public.portal_definir_margem_minima(numeric) to authenticated;

-- ------------------------------------------------------------
-- VERIFICAÇÃO (somente leitura):
--   select count(*) filter (where margem_minima = 5) as no_padrao, count(*) as total
--     from public.clientes;                       -- esperado: no_padrao = total
--   select public.portal_margem_minima();         -- esperado: 5 (ou a margem do cliente logado)
--
-- REVERTER:
--   drop function if exists public.portal_definir_margem_minima(numeric);
--   drop function if exists public.portal_margem_minima();
--   alter table public.clientes drop constraint if exists clientes_margem_minima_faixa;
--   alter table public.clientes drop column if exists margem_minima;
--   delete from public.migracoes_aplicadas where numero = '029';
-- ------------------------------------------------------------

-- ★ Auto-registro (convenção ≥024):
insert into public.migracoes_aplicadas (numero, nome, observacao)
values ('029','029-margem-minima-cliente','a margem mínima passa a ser escolha do lojista — default 5 preserva o comportamento anterior')
on conflict (numero) do nothing;
