-- 077 — a loja enxerga a própria equipe
--
-- INCREMENTAL e ADITIVA. Cria UMA política de `select`. Nenhuma existente é
-- tocada, e políticas do mesmo comando se combinam com OR: quem já via, segue
-- vendo o mesmo.
--
-- ============================================================
-- O QUE ISTO DESTRAVA
-- ============================================================
--
-- `/api/usuarios` deixou de exigir `equipe`: o lojista passa a convidar gente
-- para a PRÓPRIA loja (ver `quemPodeConvidar.ts`). Convidar sem conseguir ver
-- quem já tem acesso é meia funcionalidade — a pessoa não sabe se já convidou,
-- não sabe quem entrou, e reconvida.
--
-- O RLS de `perfis` tinha duas políticas e nenhuma serve aqui:
--
--   perfil_proprio       id = auth.uid()  → a lojista vê só a si mesma
--   perfil_equipe_admin  eh_equipe()      → a Zion vê tudo
--
-- Falta a do meio: a loja vendo as pessoas DA LOJA.
--
-- ============================================================
-- POR QUE ISTO NÃO CONTRARIA A REGRA DA 054
-- ============================================================
--
-- A 054 diz, sobre a agência: "NÃO ler `perfis` de ninguém. Identidade não é
-- dado operacional, e uma agência não precisa da lista de e-mails para
-- otimizar anúncios."
--
-- A regra continua valendo, e esta política não a fura, por duas razões:
--
--   1. Ela descreve `cliente_do_usuario()`, não `agencia_do_usuario()`. A
--      agência segue sem enxergar `perfis` — a fatia dela é outra e virá com o
--      desenho dela.
--   2. O argumento da 054 é sobre ler identidade ALHEIA para operar. Aqui a
--      loja lê a EQUIPE DELA MESMA, que é o time que ela acabou de poder
--      convidar. É a mesma linha que ela já podia ver de si própria, estendida
--      às pessoas que ela mesma pôs lá.
--
-- E não há e-mail em `perfis`: a tabela guarda `id`, `cliente_id`, `papel`,
-- `nome`, `agencia_id`, `ativo`. O e-mail mora no Auth e só o servidor o vê.
-- O que a lojista passa a ler é nome e papel de quem ela convidou.
--
-- ============================================================
-- SÓ `select`
-- ============================================================
--
-- Sem `insert`, `update` ou `delete`, pelo mesmo motivo que a 054 recusou
-- `insert` em `clientes`: criar acesso é provisionamento e já tem caminho com
-- sessão validada (`/api/usuarios`, com `decidirConvite` decidindo o vínculo no
-- servidor). Uma política de escrita aqui seria um segundo caminho, mais fraco,
-- para a mesma coisa — e o dia em que os dois discordassem, quem venceria
-- seria o mais permissivo.

drop policy if exists perfil_da_propria_loja on public.perfis;
create policy perfil_da_propria_loja on public.perfis
  for select to authenticated
  using (
    cliente_id is not null
    and cliente_id = public.cliente_do_usuario()
  );

comment on policy perfil_da_propria_loja on public.perfis is
  'A loja le as pessoas DELA (nome, papel, ativo) — nao ha e-mail nesta tabela. Complementa perfil_proprio, que so mostrava a propria linha. Somente select: criar acesso passa por /api/usuarios.';

-- ============================================================
-- CONFERÊNCIA
-- ============================================================
--
-- Como lojista da loja X, isto tem que devolver as pessoas de X e mais
-- ninguém:
--
--   select id, nome, papel from public.perfis;
--
-- E como lojista de X, isto tem que voltar VAZIO (a política filtra, não
-- levanta erro):
--
--   select count(*) from public.perfis where cliente_id <> '<id da loja X>';

-- ============================================================
-- O LEDGER (regra da 043: a propria migracao registra a propria linha)
-- ============================================================

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('077', '077-a-loja-enxerga-a-propria-equipe', now(),
        'Politica perfil_da_propria_loja em perfis: select onde cliente_id = cliente_do_usuario(). Sem ela a loja podia convidar (rota /api/usuarios aberta ao papel cliente) e nao via quem ja tinha acesso. Somente select; escrita segue so por /api/usuarios. A agencia NAO ganha leitura de perfis — a regra da 054 continua de pe.')
on conflict do nothing;
