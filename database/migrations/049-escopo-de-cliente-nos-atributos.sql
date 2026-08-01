-- ============================================================
-- 049 — `produto_atributos` ganha escopo de cliente
-- ============================================================
--
-- O DEFEITO
-- ---------
-- `produto_atributos` era a ÚNICA tabela do catálogo sem `cliente_id` e com uma
-- política só (`equipe_total`). As irmãs têm as duas:
--
--   produtos           cliente_id NOT NULL   equipe_total + cliente_escopo
--   produto_variantes  cliente_id NOT NULL   equipe_total + cliente_escopo
--   imagens_produto    cliente_id NOT NULL   equipe_total + cliente_escopo
--   produto_atributos  —                     equipe_total                  ← aqui
--
-- Isso é resíduo de quando o Zion era agência: a ficha era da equipe. Depois do
-- pivô self-service, o botão "Trazer as informações do Mercado Livre" nasceu no
-- portal da lojista — e o RLS o barrou, corretamente:
--
--   new row violates row-level security policy for table "produto_atributos"
--
-- Medido em 2026-08-01: o botão aparece SÓ para quem tem `papel = "cliente"`,
-- porque a equipe não tem `clienteId` e a importação para antes. Ou seja: quem
-- podia escrever não alcançava, e quem alcançava não podia.
--
-- NÃO se conserta afrouxando `equipe_total` nem criando política permissiva. A
-- tabela ganha escopo, como as irmãs.
--
-- SEGURANÇA DESTA MIGRAÇÃO
-- ------------------------
-- A tabela está VAZIA — 0 linhas, conferido antes de escrever. Por isso o
-- `NOT NULL` entra direto, sem backfill e sem risco de linha órfã.
--
-- `NOT NULL` é a escolha certa e não zelo: um `cliente_id` nulo seria uma linha
-- invisível para a lojista e visível só para a equipe — um estado que ninguém
-- escolheu e que ninguém saberia explicar.
--
-- `equipe_total` NÃO é tocada. A equipe continua enxergando tudo.
-- ============================================================

alter table public.produto_atributos
  add column if not exists cliente_id uuid references public.clientes(id) on delete cascade;

-- Guarda: se um dia esta migração for reaplicada numa base com dados, o
-- NOT NULL abaixo falharia em silêncio conceitual. Aqui ele grita antes.
do $$
declare
  orfas integer;
begin
  select count(*) into orfas from public.produto_atributos where cliente_id is null;
  if orfas > 0 then
    raise exception 'ha % linhas sem cliente_id em produto_atributos: faca o backfill antes do NOT NULL', orfas;
  end if;
end $$;

alter table public.produto_atributos alter column cliente_id set not null;

create index if not exists idx_produto_atributos_cliente
  on public.produto_atributos (cliente_id);

-- A MESMA política das três irmãs, palavra por palavra. Não invento forma nova
-- para uma tabela que faz parte de um conjunto.
drop policy if exists cliente_escopo on public.produto_atributos;
create policy cliente_escopo on public.produto_atributos
  for all to authenticated
  using      (cliente_id = cliente_do_usuario())
  with check (cliente_id = cliente_do_usuario());

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('049', '049-escopo-de-cliente-nos-atributos', now(),
        'produto_atributos ganha cliente_id NOT NULL + politica cliente_escopo, iguais as irmas do catalogo. Tabela vazia: sem backfill. equipe_total intocada.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   drop policy if exists cliente_escopo on public.produto_atributos;
--   drop index if exists idx_produto_atributos_cliente;
--   alter table public.produto_atributos drop column if exists cliente_id;
--
-- Reverter também o tipo `ProdutoAtributo` e os dois chamadores de
-- `criarAtributo` / `substituirAtributosDoMarketplace`.
-- ============================================================
