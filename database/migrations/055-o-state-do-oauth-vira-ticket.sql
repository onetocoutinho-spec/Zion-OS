-- 055 — o `state` do OAuth deixa de ser um dado e vira um ticket
--
-- ============================================================
-- O QUE ESTA MIGRAÇÃO EXISTE PARA PERMITIR
-- ============================================================
--
-- Uma agência conectar a conta do Mercado Livre de CADA loja que ela opera.
--
-- Hoje isso é impossível, e por um bom motivo: a tela de conexão descobre de
-- qual loja se trata olhando a SESSÃO (`useClientPortal().clienteId`). Isso
-- funciona para quem tem uma loja só, e não funciona para quem tem dez — uma
-- agência não tem loja própria.
--
-- ============================================================
-- POR QUE NÃO BASTA LER O `state` QUE O ML DEVOLVE
-- ============================================================
--
-- `/api/ml/autorizar` já MANDA `state=clienteId` para o Mercado Livre. E a
-- página de callback IGNORA esse valor por completo. Isso não é descuido: é o
-- que a mantém segura.
--
-- O `state` volta pela URL do navegador — quem quiser troca. Se a página
-- passasse a confiar nele:
--
--   • qualquer pessoa conectaria a PRÓPRIA conta do ML a QUALQUER loja, só
--     editando um parâmetro;
--   • e o inverso, pior: dá para induzir um operador legítimo a autorizar e
--     gravar o token DELE numa loja de terceiro.
--
-- O caminho óbvio — "é só ler o state" — é exatamente o que não pode ser feito.
--
-- ============================================================
-- O QUE MUDA
-- ============================================================
--
-- O `state` deixa de ser uma AFIRMAÇÃO do navegador e vira uma CONSULTA ao
-- banco. Ele passa a ser um ticket opaco, aleatório, de vida curta, gravado
-- aqui e amarrado a (usuário, loja):
--
--   1. o operador pede conexão para a loja X
--   2. o servidor confere que ele opera X, grava o ticket e manda o TICKET
--   3. o ML devolve o ticket
--   4. o servidor PROCURA o ticket, tira dali a loja, confere o usuário, e
--      queima o ticket
--
-- Quem não tem o ticket não tem nada. E o ticket não diz de qual loja é —
-- quem diz é a linha, que só o servidor lê.
--
-- ============================================================
-- O QUE NÃO MUDA
-- ============================================================
--
-- `/api/ml/conectar` continua chamando `exigirAcessoAoCliente` antes de gravar
-- o refresh_token. A parede final já existe e não é esta: aqui só se constrói
-- o caminho até ela. Duas conferências para a mesma coisa é de propósito —
-- ticket válido de uma loja que o usuário perdeu acesso no meio do caminho
-- ainda precisa ser recusado.

-- ============================================================
-- 1) A TABELA
-- ============================================================

create table if not exists public.ml_conexoes_pendentes (
  ticket      text primary key,
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  marketplace text not null default 'Mercado Livre',
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null default now() + interval '15 minutes',
  usado_em    timestamptz
);

comment on table public.ml_conexoes_pendentes is
  'Tickets de OAuth em voo. O `state` mandado ao marketplace e o `ticket`; a loja fica AQUI, nunca na URL.';
comment on column public.ml_conexoes_pendentes.ticket is
  'Opaco e aleatorio. Gerado no servidor; nao carrega informacao nenhuma.';
comment on column public.ml_conexoes_pendentes.usado_em is
  'Queimado. Ticket usado nao serve de novo, nem em corrida.';

create index if not exists idx_ml_pendentes_expira
  on public.ml_conexoes_pendentes (expira_em)
  where usado_em is null;

alter table public.ml_conexoes_pendentes enable row level security;

-- ============================================================
-- 2) QUEM PODE CRIAR UM TICKET
-- ============================================================
--
-- Só para uma loja que a pessoa JÁ alcança — e "alcança" tem a mesma definição
-- de todo o resto do sistema, reusando as funções que já existem. Sem isto,
-- alguém autenticado criaria um ticket para a loja de outro e o OAuth gravaria
-- o token no lugar errado, com um ticket perfeitamente válido.
--
-- `usuario_id = auth.uid()` fecha o outro lado: ninguém cria ticket em nome
-- de terceiro.

drop policy if exists cria_o_proprio_ticket on public.ml_conexoes_pendentes;
create policy cria_o_proprio_ticket on public.ml_conexoes_pendentes
  for insert
  with check (
    usuario_id = auth.uid()
    and (
      public.eh_equipe()
      or cliente_id = public.cliente_do_usuario()
      or cliente_id in (select public.lojas_da_agencia())
    )
  );

-- Leitura só do próprio ticket. Ninguém precisa ler o de outro, e quem não
-- precisa não pode.
drop policy if exists le_o_proprio_ticket on public.ml_conexoes_pendentes;
create policy le_o_proprio_ticket on public.ml_conexoes_pendentes
  for select using (usuario_id = auth.uid());

-- SEM POLÍTICA DE UPDATE NEM DELETE, e isso é decisão.
--
-- Queimar o ticket é o passo de segurança do fluxo — se o navegador pudesse
-- fazer isso por conta própria, poderia também NÃO fazer. Quem queima é a
-- função abaixo, e ela é a única forma de consumir.

-- ============================================================
-- 3) CONSUMIR — atômico, ou não serve
-- ============================================================
--
-- O `update ... where usado_em is null returning` é o ponto inteiro: duas
-- chamadas simultâneas com o mesmo ticket, e só UMA vê a linha. A segunda
-- recebe nulo. Ler-e-depois-escrever teria a janela em que as duas passam.
--
-- `security definer` porque a tabela não tem política de update — a função é a
-- única porta, e ela impõe as três condições de uma vez: é do usuário, não foi
-- usado, não expirou.

create or replace function public.consumir_ticket_ml(p_ticket text)
returns table (cliente_id uuid, marketplace text)
language sql
volatile security definer
set search_path = public
as $fn$
  update public.ml_conexoes_pendentes t
     set usado_em = now()
   where t.ticket = p_ticket
     and t.usuario_id = auth.uid()
     and t.usado_em is null
     and t.expira_em > now()
  returning t.cliente_id, t.marketplace;
$fn$;

comment on function public.consumir_ticket_ml(text) is
  'Queima o ticket e devolve a loja. Atomico: duas chamadas, so uma recebe linha.';

revoke execute on function public.consumir_ticket_ml(text) from public, anon;

-- ============================================================
-- 4) A LIMPEZA, sem cron
-- ============================================================
--
-- Ticket velho não faz mal — expirado não passa pela função. Mas linha morta se
-- acumula, e esta tabela ganha uma por clique em "Conectar". A limpeza anda de
-- carona em quem já está escrevendo, e olha só o que já venceu há um dia.

create or replace function public.limpar_tickets_ml_vencidos()
returns integer
language sql
volatile security definer
set search_path = public
as $fn$
  with mortos as (
    delete from public.ml_conexoes_pendentes
     where expira_em < now() - interval '1 day'
    returning 1
  ) select count(*)::int from mortos;
$fn$;

revoke execute on function public.limpar_tickets_ml_vencidos() from public, anon;

-- ============================================================
-- Conferência
-- ============================================================
--
--   select policyname, cmd from pg_policies
--    where schemaname='public' and tablename='ml_conexoes_pendentes';
--   -- espera-se DUAS: cria_o_proprio_ticket (INSERT) e le_o_proprio_ticket
--   -- (SELECT). Nenhuma de UPDATE ou DELETE.
--
--   select proname, array_to_string(proacl,' | ') from pg_proc p
--     join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public'
--      and proname in ('consumir_ticket_ml','limpar_tickets_ml_vencidos');
--   -- as duas: postgres | authenticated | service_role — sem anon, sem PUBLIC

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('055', '055-o-state-do-oauth-vira-ticket', now(),
        'Tabela ml_conexoes_pendentes: o state do OAuth vira ticket opaco amarrado a (usuario, loja), com validade de 15 min e uso unico. Existe para a AGENCIA poder conectar o ML de cada loja que opera — hoje a tela descobre a loja pela sessao, o que so funciona para quem tem uma. Ler o state da URL seria a correcao obvia e e uma vulnerabilidade: o state e controlavel pelo navegador, e confiar nele deixaria conectar a propria conta do ML a qualquer loja. Politica de INSERT so para loja que o usuario ja alcanca (reusa eh_equipe / cliente_do_usuario / lojas_da_agencia); SELECT so do proprio; sem UPDATE e sem DELETE de proposito — queimar o ticket e passo de seguranca e so consumir_ticket_ml() faz, com update atomico where usado_em is null. /api/ml/conectar continua chamando exigirAcessoAoCliente: duas conferencias para a mesma coisa, de proposito.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   drop function if exists public.limpar_tickets_ml_vencidos();
--   drop function if exists public.consumir_ticket_ml(text);
--   drop table if exists public.ml_conexoes_pendentes;
--
-- Seguro: a tabela só guarda tickets em voo (15 minutos). Derrubá-la cancela as
-- conexões no meio do caminho, e quem estiver conectando refaz o clique.
-- ============================================================
