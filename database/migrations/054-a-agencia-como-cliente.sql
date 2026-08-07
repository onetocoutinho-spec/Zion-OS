-- 054 — a agência como cliente: um nível de hierarquia, e só um
--
-- ============================================================
-- O QUE ISTO RESOLVE
-- ============================================================
--
-- Hoje o acesso tem DOIS níveis, e o segundo não tem escopo:
--
--     papel = 'cliente'  →  cliente_id = cliente_do_usuario()   uma loja
--     papel = 'equipe'   →  eh_equipe()                         TODAS as lojas
--
-- Uma agência que opera dez contas não cabe em nenhum dos dois. Como 'cliente'
-- ela vê uma; como 'equipe' ela vê o banco INTEIRO — inclusive as lojas de
-- outros assinantes. Dar 'equipe' a uma agência cliente não seria um recurso,
-- seria vazamento.
--
-- Falta o nível do meio:  usuário → AGÊNCIA → lojas
--
-- ============================================================
-- O QUE NÃO MUDA — e isto é a parte importante
-- ============================================================
--
-- NADA do que existe é alterado. Esta migração é ADITIVA:
--
--   • nenhuma política existente é removida, reescrita ou renomeada;
--   • `cliente_do_usuario()` e `eh_equipe()` ficam byte a byte como estão;
--   • quem é `papel = 'cliente'` (a Leilane) continua vendo exatamente a mesma
--     linha de sempre, pela MESMA política de sempre;
--   • `equipe_total` continua sendo só de vocês.
--
-- Políticas de RLS para o mesmo comando são combinadas com OR. Uma política
-- NOVA só pode ALARGAR o acesso de quem ela descreve — e ela descreve apenas
-- `papel = 'agencia'`, que hoje não existe em nenhuma linha. No instante
-- seguinte à aplicação, o comportamento observável é idêntico ao anterior.
--
-- ============================================================
-- POR QUE UMA TABELA `agencias`, E NÃO UM `parent_id` EM `clientes`
-- ============================================================
--
-- Uma agência NÃO é uma loja. Ela não tem produtos, não tem canal do Mercado
-- Livre, não tem preço mínimo. Reaproveitar `clientes` faria toda consulta do
-- produto ter que perguntar "esta linha é loja de verdade ou é um agrupador?",
-- e a primeira que esquecesse contaria a agência como loja em algum número que
-- a lojista lê.
--
-- ============================================================
-- O QUE UMA AGÊNCIA PODE E NÃO PODE
-- ============================================================
--
--   PODE   ler e escrever tudo das lojas DELA — é o trabalho dela.
--   PODE   ler e renomear as próprias lojas (`clientes`: select, update).
--   NÃO    criar nem apagar loja pelo banco. Criar loja é provisionamento e já
--          tem caminho com sessão validada (`/api/loja/provisionar`); apagar é
--          destrutivo e não deve depender de uma política estar certa.
--   NÃO    ler `perfis` de ninguém. Identidade não é dado operacional, e uma
--          agência não precisa da lista de e-mails para otimizar anúncios.
--
-- ============================================================
-- ORDEM DE APLICAÇÃO
-- ============================================================
--
-- Este arquivo NÃO cria nenhuma agência e NÃO muda nenhum perfil. Depois de
-- aplicado, o sistema tem a CAPACIDADE de ter agências e nenhuma agência.
-- Ligar a primeira é um `insert` deliberado, revisado à parte.
--
-- Antes de aplicar em produção: rodar `054-verificacao-do-isolamento.sql`, que
-- prova o isolamento com duas agências fictícias e desfaz tudo no final.

-- ============================================================
-- 1) A AGÊNCIA
-- ============================================================

create table if not exists public.agencias (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

comment on table public.agencias is
  'Quem opera VARIAS lojas. Nao e uma loja: nao tem produto, canal nem preco.';

alter table public.agencias enable row level security;

-- Só a equipe administra agências. A própria agência lê a sua (política logo
-- abaixo, depois de `agencia_do_usuario` existir).
drop policy if exists equipe_total on public.agencias;
create policy equipe_total on public.agencias for all using (public.eh_equipe());

-- ============================================================
-- 2) A LOJA PODE PERTENCER A UMA AGÊNCIA — OU A NINGUÉM
-- ============================================================
--
-- `null` é o caso da Leilane: loja que se cadastrou sozinha e não tem agência.
-- É o padrão, e continua sendo o padrão.

alter table public.clientes
  add column if not exists agencia_id uuid references public.agencias(id) on delete set null;

comment on column public.clientes.agencia_id is
  'A agencia que opera esta loja. NULL = loja self-service, sem agencia (o padrao).';

create index if not exists idx_clientes_agencia on public.clientes (agencia_id)
  where agencia_id is not null;

-- ============================================================
-- 3) O PERFIL DE AGÊNCIA
-- ============================================================

alter table public.perfis
  add column if not exists agencia_id uuid references public.agencias(id) on delete cascade;

comment on column public.perfis.agencia_id is
  'Preenchido apenas quando papel = agencia. Ver a constraint perfis_forma_do_papel.';

-- A CONSTRAINT É A PEÇA DE SEGURANÇA, não a documentação.
--
-- Sem ela, um perfil com `papel = 'agencia'` E `cliente_id` preenchido passaria
-- pelas DUAS políticas — a de agência e a de cliente — e o resultado seria a
-- união. Pior: um `papel = 'equipe'` com `agencia_id` sugeriria escopo a quem
-- não tem nenhum, e alguém leria isso como limite.
--
-- As três formas são exclusivas, e o banco recusa qualquer outra.
alter table public.perfis drop constraint if exists perfis_forma_do_papel;
alter table public.perfis add constraint perfis_forma_do_papel check (
  (papel = 'cliente' and cliente_id is not null and agencia_id is null) or
  (papel = 'agencia' and agencia_id is not null and cliente_id is null) or
  (papel = 'equipe'  and agencia_id is null)
);

-- ============================================================
-- 4) AS FUNÇÕES — mesma forma das duas que já existem
-- ============================================================
--
-- `stable security definer` + `set search_path = public` é a assinatura das
-- duas atuais, e não é enfeite: sem `security definer` a função leria `perfis`
-- sob a RLS de quem pergunta e daria recursão; sem `search_path` fixo um schema
-- no caminho poderia sequestrar o nome da tabela.

create or replace function public.agencia_do_usuario()
returns uuid
language sql
stable security definer
set search_path = public
as $$
  select p.agencia_id from public.perfis p
  where p.id = auth.uid()
    and p.papel = 'agencia'
    and coalesce(p.ativo, true);
$$;

comment on function public.agencia_do_usuario() is
  'A agencia de quem esta perguntando, ou NULL. NULL nunca casa com nada.';

-- As lojas da agência de quem está perguntando. Conjunto VAZIO para quem não é
-- agência — e `x in (select … )` sobre conjunto vazio é falso, nunca verdadeiro.
create or replace function public.lojas_da_agencia()
returns setof uuid
language sql
stable security definer
set search_path = public
as $$
  select c.id from public.clientes c
  where c.agencia_id is not null
    and c.agencia_id = public.agencia_do_usuario();
$$;

comment on function public.lojas_da_agencia() is
  'As lojas da agencia do usuario. Vazio para todo mundo que nao e agencia.';

-- A agência enxerga a própria agência (para mostrar o nome na tela).
drop policy if exists agencia_le_a_propria on public.agencias;
create policy agencia_le_a_propria on public.agencias
  for select using (id = public.agencia_do_usuario());

-- ============================================================
-- 5) A AGÊNCIA VÊ AS LOJAS DELA
-- ============================================================
--
-- `select` e `update` — ler a lista e renomear. Sem `insert` e sem `delete`,
-- pelos motivos no cabeçalho.

drop policy if exists agencia_le_as_lojas on public.clientes;
create policy agencia_le_as_lojas on public.clientes
  for select using (agencia_id = public.agencia_do_usuario());

drop policy if exists agencia_edita_as_lojas on public.clientes;
create policy agencia_edita_as_lojas on public.clientes
  for update
  using (agencia_id = public.agencia_do_usuario())
  with check (agencia_id = public.agencia_do_usuario());

-- ============================================================
-- 6) AS 28 TABELAS OPERACIONAIS
-- ============================================================
--
-- POR QUE UM LAÇO, E NÃO 28 `create policy` ESCRITOS À MÃO
--
-- A regra é uma invariante: TODA tabela escopada por `cliente_id` precisa da
-- política de agência. Escrever 28 vezes é afirmar a invariante 28 vezes — e
-- basta esquecer uma para a agência perder acesso a um pedaço do produto sem
-- que nada acuse. O laço torna o esquecimento impossível.
--
-- `perfis` fica DE FORA de propósito: tem `cliente_id`, mas guarda identidade,
-- não operação. Uma agência não precisa da lista de e-mails para otimizar
-- anúncios, e o menor acesso que resolve é o acesso certo.
--
-- Uma tabela nova com `cliente_id` NÃO entra sozinha: este laço roda uma vez,
-- agora. A migração que criar a tabela precisa criar a política — e é isso que
-- a consulta de conferência no fim deste arquivo mede.

do $$
declare
  t text;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity
       and c.relname <> 'perfis'
       and exists (
         select 1 from information_schema.columns ic
          where ic.table_schema = 'public'
            and ic.table_name = c.relname
            and ic.column_name = 'cliente_id'
       )
    order by c.relname
  loop
    execute format('drop policy if exists agencia_escopo on public.%I', t);
    execute format(
      'create policy agencia_escopo on public.%I for all '
      'using (cliente_id in (select public.lojas_da_agencia())) '
      'with check (cliente_id in (select public.lojas_da_agencia()))',
      t
    );
  end loop;
end $$;

-- ============================================================
-- 7) CONFERÊNCIA — para rodar DEPOIS, e ler o resultado
-- ============================================================
--
--   -- toda tabela escopada tem as três políticas?
--   select c.relname,
--          bool_or(p.policyname = 'cliente_escopo')  as tem_cliente,
--          bool_or(p.policyname = 'equipe_total')    as tem_equipe,
--          bool_or(p.policyname = 'agencia_escopo')  as tem_agencia
--     from pg_class c
--     join pg_namespace n on n.oid = c.relnamespace
--     left join pg_policies p on p.tablename = c.relname and p.schemaname = 'public'
--    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
--      and c.relname <> 'perfis'
--      and exists (select 1 from information_schema.columns ic
--                   where ic.table_name = c.relname and ic.column_name = 'cliente_id')
--    group by c.relname
--   having not bool_or(p.policyname = 'agencia_escopo');
--
--   -- espera-se ZERO linhas. Qualquer linha é uma tabela que a agência não
--   -- alcança, e o sintoma na tela seria "esta parte do produto está vazia".

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('054', '054-a-agencia-como-cliente', now(),
        'Terceiro nivel de acesso: usuario -> agencia -> lojas. Tabela agencias, clientes.agencia_id (null = self-service, o padrao), perfis.agencia_id + papel agencia, constraint perfis_forma_do_papel tornando as tres formas exclusivas, funcoes agencia_do_usuario() e lojas_da_agencia() no mesmo molde das duas existentes, e a politica agencia_escopo em toda tabela com cliente_id e RLS (perfis fora: identidade nao e operacao). ADITIVA: nenhuma politica existente tocada, cliente_do_usuario() e eh_equipe() intactas. Aplicada sem nenhuma agencia criada — o comportamento observavel no instante seguinte e identico ao anterior.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   do $$ declare t text; begin
--     for t in select tablename from pg_policies
--               where schemaname='public' and policyname='agencia_escopo'
--     loop execute format('drop policy if exists agencia_escopo on public.%I', t); end loop;
--   end $$;
--   drop policy if exists agencia_le_as_lojas    on public.clientes;
--   drop policy if exists agencia_edita_as_lojas on public.clientes;
--   drop policy if exists agencia_le_a_propria   on public.agencias;
--   drop function if exists public.lojas_da_agencia();
--   drop function if exists public.agencia_do_usuario();
--   alter table public.perfis drop constraint if exists perfis_forma_do_papel;
--   alter table public.perfis   drop column if exists agencia_id;
--   alter table public.clientes drop column if exists agencia_id;
--   drop table if exists public.agencias;
--
-- Seguro enquanto nenhuma agência tiver sido criada. Depois disso, derrubar
-- `agencias` apaga o vínculo das lojas (`on delete set null`) — as lojas e os
-- dados permanecem, o agrupamento é que se perde.
-- ============================================================
