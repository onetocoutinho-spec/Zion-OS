-- 054 — a prova de que o isolamento existe
--
-- ============================================================
-- POR QUE ESTE ARQUIVO EXISTE
-- ============================================================
--
-- Uma política de RLS errada não quebra nada: ela devolve linhas a mais, em
-- silêncio, e o sintoma aparece no dia em que uma agência abre a tela e vê a
-- loja de outra. Não há teste de unidade que pegue isso — a regra vive no banco,
-- e é no banco que ela tem que ser provada.
--
-- ============================================================
-- É SEGURO RODAR EM PRODUÇÃO
-- ============================================================
--
-- Tudo acontece dentro de uma transação que termina em ROLLBACK. Nenhuma linha
-- sobrevive: nem as agências fictícias, nem os usuários, nem as lojas.
--
-- Rode DEPOIS de aplicar a 054 e ANTES de criar a primeira agência de verdade.
-- Qualquer asserção que falhar levanta exceção e aborta — silêncio é aprovação,
-- e o resumo no fim diz o que passou.

begin;

-- ============================================================
-- O CENÁRIO
-- ============================================================
--
--   agência ALFA   → loja A1, loja A2
--   agência BETA   → loja B1
--   Leilane        → loja SOZINHA, sem agência (papel = cliente)
--
-- Os ids são fixos e improváveis de propósito: se algo escapar do rollback,
-- dá para encontrar e remover pelo prefixo.

do $$
declare
  ag_alfa   uuid := '0000a1fa-0000-4000-8000-000000000001';
  ag_beta   uuid := '0000be7a-0000-4000-8000-000000000002';
  loja_a1   uuid := '0000a1fa-0000-4000-8000-00000000a001';
  loja_a2   uuid := '0000a1fa-0000-4000-8000-00000000a002';
  loja_b1   uuid := '0000be7a-0000-4000-8000-00000000b001';
  loja_solo uuid := '00005010-0000-4000-8000-000000005010';
  u_alfa    uuid := '0000a1fa-0000-4000-8000-000000000f01';
  u_beta    uuid := '0000be7a-0000-4000-8000-000000000f02';
  u_solo    uuid := '00005010-0000-4000-8000-000000000f03';
  n         int;
begin
  -- Usuários. `perfis.id` referencia `auth.users`, então eles precisam existir.
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (u_alfa, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alfa@teste.invalid', now(), now()),
         (u_beta, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beta@teste.invalid', now(), now()),
         (u_solo, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'solo@teste.invalid', now(), now());

  insert into public.agencias (id, nome) values (ag_alfa, 'Agência Alfa'), (ag_beta, 'Agência Beta');

  -- `clientes` guarda o nome em `empresa` (not null), nao em `nome`.
  insert into public.clientes (id, empresa, agencia_id)
  values (loja_a1, 'Loja A1', ag_alfa),
         (loja_a2, 'Loja A2', ag_alfa),
         (loja_b1, 'Loja B1', ag_beta),
         (loja_solo, 'Loja da Leilane', null);

  insert into public.perfis (id, papel, cliente_id, agencia_id, nome, ativo)
  values (u_alfa, 'agencia', null, ag_alfa, 'Operador Alfa', true),
         (u_beta, 'agencia', null, ag_beta, 'Operador Beta', true),
         (u_solo, 'cliente', loja_solo, null, 'Leilane', true);

  -- Um produto em cada loja, para medir o escopo numa tabela operacional real.
  insert into public.produtos (id, cliente_id, nome, sku, preco_venda, custo, estoque)
  values (gen_random_uuid(), loja_a1,   'Produto da A1',   'A1-001', 100, 40, 5),
         (gen_random_uuid(), loja_a2,   'Produto da A2',   'A2-001', 100, 40, 5),
         (gen_random_uuid(), loja_b1,   'Produto da B1',   'B1-001', 100, 40, 5),
         (gen_random_uuid(), loja_solo, 'Produto da solo', 'S1-001', 100, 40, 5);

  -- ==========================================================
  -- A CONSTRAINT RECUSA AS FORMAS IMPOSSÍVEIS
  -- ==========================================================
  --
  -- É ela que impede um perfil de casar com DUAS políticas ao mesmo tempo.
  begin
    insert into public.perfis (id, papel, cliente_id, agencia_id)
    values (u_alfa, 'agencia', loja_a1, ag_alfa)
    on conflict (id) do update set cliente_id = excluded.cliente_id;
    raise exception 'FALHOU: perfil de agencia aceitou cliente_id — casaria com as duas politicas';
  exception when check_violation then
    raise notice 'ok  · a constraint recusa agencia com cliente_id';
  end;

  raise notice '--- cenario montado: 2 agencias, 4 lojas, 4 produtos ---';
end $$;

-- ============================================================
-- A AGÊNCIA ALFA
-- ============================================================

set local role authenticated;
set local request.jwt.claims = '{"sub":"0000a1fa-0000-4000-8000-000000000f01","role":"authenticated"}';

do $$
declare n int; begin
  select count(*) into n from public.clientes;
  if n <> 2 then raise exception 'FALHOU: Alfa ve % lojas, deveria ver 2 (A1 e A2)', n; end if;
  raise notice 'ok  · Alfa ve exatamente as 2 lojas dela';

  select count(*) into n from public.clientes where empresa in ('Loja B1', 'Loja da Leilane');
  if n <> 0 then raise exception 'FALHOU: Alfa enxerga % loja(s) de terceiros', n; end if;
  raise notice 'ok  · Alfa NAO ve a loja da Beta nem a da Leilane';

  select count(*) into n from public.produtos;
  if n <> 2 then raise exception 'FALHOU: Alfa ve % produtos, deveria ver 2', n; end if;
  raise notice 'ok  · Alfa ve os 2 produtos das lojas dela, e so eles';

  select count(*) into n from public.lojas_da_agencia();
  if n <> 2 then raise exception 'FALHOU: lojas_da_agencia() devolveu % para Alfa', n; end if;
  raise notice 'ok  · lojas_da_agencia() devolve 2 para Alfa';
end $$;

-- Escrever numa loja de TERCEIRO precisa falhar. `update` sob RLS não levanta
-- erro: ele simplesmente não encontra a linha. Zero linhas afetadas É a prova.
do $$
declare n int; begin
  with alterado as (
    update public.produtos set nome = 'INVASAO' where sku = 'B1-001' returning 1
  ) select count(*) into n from alterado;
  if n <> 0 then raise exception 'FALHOU: Alfa alterou % produto(s) da Beta', n; end if;
  raise notice 'ok  · Alfa nao consegue escrever na loja da Beta';
end $$;

-- ============================================================
-- A AGÊNCIA BETA — o outro lado da mesma parede
-- ============================================================

set local request.jwt.claims = '{"sub":"0000be7a-0000-4000-8000-000000000f02","role":"authenticated"}';

do $$
declare n int; begin
  select count(*) into n from public.clientes;
  if n <> 1 then raise exception 'FALHOU: Beta ve % lojas, deveria ver 1', n; end if;
  select count(*) into n from public.produtos;
  if n <> 1 then raise exception 'FALHOU: Beta ve % produtos, deveria ver 1', n; end if;
  raise notice 'ok  · Beta ve 1 loja e 1 produto — os dela';
end $$;

-- ============================================================
-- A LEILANE — o caminho que já existia, e que não pode ter mudado
-- ============================================================

set local request.jwt.claims = '{"sub":"00005010-0000-4000-8000-000000000f03","role":"authenticated"}';

do $$
declare n int; begin
  select count(*) into n from public.produtos;
  if n <> 1 then raise exception 'FALHOU: a lojista ve % produtos, deveria ver 1', n; end if;
  raise notice 'ok  · a lojista continua vendo so a loja dela';

  select count(*) into n from public.lojas_da_agencia();
  if n <> 0 then raise exception 'FALHOU: lojas_da_agencia() devolveu % para quem nao e agencia', n; end if;
  raise notice 'ok  · lojas_da_agencia() e VAZIO para quem nao e agencia';

  -- A pergunta que mais importa desta migração inteira: a lojista sem agência
  -- não pode ter ganhado acesso a nada por causa da política nova.
  select count(*) into n from public.clientes;
  if n <> 0 then raise exception 'FALHOU: a lojista passou a ver % linha(s) de clientes', n; end if;
  raise notice 'ok  · a lojista NAO ganhou acesso a `clientes` (nao tinha antes)';
end $$;

-- ============================================================
-- SEM PERFIL — ninguém entra
-- ============================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000ff","role":"authenticated"}';

do $$
declare n int; begin
  select count(*) into n from public.produtos;
  if n <> 0 then raise exception 'FALHOU: usuario sem perfil ve % produtos', n; end if;
  raise notice 'ok  · usuario sem perfil nao ve nada';
end $$;

reset role;

do $$ begin
  raise notice '';
  raise notice '=========================================================';
  raise notice ' TODAS AS ASSERCOES PASSARAM — desfazendo tudo agora';
  raise notice '=========================================================';
end $$;

rollback;
