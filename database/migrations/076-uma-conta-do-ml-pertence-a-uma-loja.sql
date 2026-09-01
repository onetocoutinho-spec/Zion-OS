-- 076 — uma conta do Mercado Livre pertence a UMA loja
--
-- INCREMENTAL. NÃO destrutiva: não apaga nem altera linha nenhuma. Cria um
-- índice e ensina uma frase a `ml_credencial_gravar`.
--
-- ============================================================
-- O QUE ESTAVA ABERTO
-- ============================================================
--
-- `canais_marketplace` tem `unique (cliente_id, marketplace)` desde a 009 — um
-- canal por loja. Mas `seller_id` nunca teve restrição, e nada impedia que DUAS
-- lojas diferentes tivessem um canal ativo apontando para a MESMA conta do
-- Mercado Livre.
--
-- Não é hipótese de laboratório: desde a 055 uma agência conecta a conta de
-- cada loja da carteira escolhendo a loja pelo `?cliente=` da tela. Errar a
-- loja nesse passo é plausível — ela opera várias e nenhuma é "a dela" — e o
-- fluxo gravava sem reclamar.
--
-- ============================================================
-- POR QUE É ESTADO INVÁLIDO, E NÃO UM CASO DE USO
-- ============================================================
--
-- Procurei um cenário legítimo e não achei:
--
--   * "a lojista e a agência querem cada uma o seu acesso" — isso já é
--     resolvido em `perfis`: a lojista com papel `cliente` + `cliente_id`, a
--     agência alcançando a mesma loja por `clientes.agencia_id`. UMA linha em
--     `clientes`.
--   * "a loja trocou de agência" — é `update clientes set agencia_id`, na
--     mesma linha.
--   * "um vendedor com duas frentes de negócio" — a conta do ML é uma só, e
--     `buscarAnunciosDoVendedor` devolve TODOS os anúncios dela. O Zion não tem
--     noção de "parte de um vendedor"; fingir que tem corromperia as duas.
--
-- E o dano é concreto. Quatro consequências, todas medidas no código:
--
--   1. O catálogo duplica e nenhuma das cópias sabe. A deduplicação da
--      importação é por loja (`listarResumoDeAnunciosDoCliente(clienteId)`), e
--      `anuncios_gerados` não tem unicidade em `ml_item_id`. O mesmo MLB real
--      passa a existir duas vezes, em dois inquilinos, cada um achando que é
--      dono.
--   2. As duas escrevem no MESMO anúncio real — publicar, corrigir título
--      (072), trocar foto, encerrar. A última escrita vence, em silêncio.
--   3. Os números mentem nas duas. `/api/ml/vendas` busca os pedidos por
--      `seller_id`: os MESMOS pedidos entram no faturamento e na margem das
--      duas lojas, e a visão geral conta "2 lojas" onde há uma.
--   4. A guarda de reincidência fica cega de um olho — e esta decide.
--      `publicacaoML` monta os MLBs "deste produto" a partir da loja
--      (`listarAnunciosGeradosDoCliente`), mas a punição do ML é por CONTA. Um
--      anúncio publicado pela loja B é desconhecido da loja A até A reimportar.
--      O comentário no código diz o que está em jogo: "republicar o que o ML
--      cancelou é reincidência, e reincidência de propriedade intelectual custa
--      a conta, não o anúncio".
--
-- As três primeiras estragam dado. A quarta custa a conta do vendedor. É ela
-- que decide.
--
-- ============================================================
-- POR QUE O ÍNDICE É PARCIAL
-- ============================================================
--
-- `... where seller_id is not null and ativo`.
--
-- `ml_credencial_limpar` desconecta marcando `ativo = false` e MANTÉM o
-- `seller_id`. Isso é proposital e é histórico útil. Um índice sobre a tabela
-- inteira impediria o caminho legítimo: desconectar a conta da loja A e
-- conectá-la à loja B — que é o que acontece quando alguém corrige o engano ou
-- quando a operação realmente muda de mãos.
--
-- Com o `where`, o canal desativado não ocupa o lugar, e a regra passa a ser a
-- que se queria: uma conta ATIVA pertence a uma loja.

-- ============================================================
-- 1) MEDIR ANTES DE RESTRINGIR
-- ============================================================
--
-- Se já existir duplicata, o `create unique index` falharia com a prosa do
-- Postgres e sem dizer QUAIS lojas. Aqui a migração para antes, e nomeia.

do $$
declare
  divergencias text;
begin
  select string_agg(format('  conta %s (%s) em: %s', d.seller_id, d.marketplace, d.lojas), E'\n')
    into divergencias
    from (
      select c.marketplace,
             c.seller_id,
             string_agg(cl.empresa, ', ' order by cl.empresa) as lojas
        from public.canais_marketplace c
        join public.clientes cl on cl.id = c.cliente_id
       where c.seller_id is not null
         and c.ativo
       group by c.marketplace, c.seller_id
      having count(*) > 1
    ) d;

  if divergencias is not null then
    raise exception E'A mesma conta de marketplace esta ativa em mais de uma loja:\n%\n\nDecida qual loja fica com cada conta e desconecte a outra (o botao Desconectar, ou public.ml_credencial_limpar(cliente, marketplace)). Depois rode esta migracao de novo.', divergencias;
  end if;
end $$;

-- ============================================================
-- 2) A REGRA
-- ============================================================

create unique index if not exists canais_marketplace_conta_ativa_unica
  on public.canais_marketplace (marketplace, seller_id)
  where seller_id is not null and ativo;

comment on index public.canais_marketplace_conta_ativa_unica is
  'Uma conta ATIVA de marketplace pertence a uma loja so (076). Parcial: canal desconectado (ativo=false) guarda o seller_id como historico e nao ocupa o lugar.';

-- ============================================================
-- 3) A FRASE
-- ============================================================
--
-- O índice sozinho entregaria "duplicate key value violates unique constraint
-- canais_marketplace_conta_ativa_unica" — em inglês, prosa de máquina, sem
-- caminho. É exatamente o defeito que o módulo `credencialRecusada` foi criado
-- para matar em 06/08/2026, e não vale reintroduzi-lo num caminho novo.
--
-- `ml_credencial_gravar` passa a olhar antes e a dizer QUAL loja já tem a
-- conta. O corpo do insert é o da 061, sem alteração — só ganhou a conferência
-- na frente.
--
-- `errcode 23505` de propósito: é o mesmo que o índice levantaria se alguém
-- chegasse à tabela por outro caminho, então o app trata os dois iguais.

create or replace function public.ml_credencial_gravar(
  p_cliente uuid, p_marketplace text, p_token text, p_seller_id text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  outra_loja text;
begin
  if p_token is null or p_token = '' then
    raise exception 'token vazio';
  end if;

  if p_seller_id is not null then
    select cl.empresa
      into outra_loja
      from public.canais_marketplace c
      join public.clientes cl on cl.id = c.cliente_id
     where c.marketplace = p_marketplace
       and c.seller_id   = p_seller_id
       and c.ativo
       and c.cliente_id <> p_cliente
     limit 1;

    if outra_loja is not null then
      raise exception 'conta_em_outra_loja: Esta conta do % ja esta conectada a loja "%". Uma conta de marketplace pertence a uma loja so — se a conta mudou de maos, desconecte-a la antes de conecta-la aqui.',
        p_marketplace, outra_loja
        using errcode = '23505';
    end if;
  end if;

  insert into public.canais_marketplace (cliente_id, marketplace, refresh_token_cifrado, seller_id, ativo, atualizado_em)
  values (p_cliente, p_marketplace, pgp_sym_encrypt(p_token, public.ml_chave_da_credencial()), p_seller_id, true, now())
  on conflict (cliente_id, marketplace) do update
     set refresh_token_cifrado = excluded.refresh_token_cifrado,
         seller_id             = coalesce(excluded.seller_id, public.canais_marketplace.seller_id),
         ativo                 = true,
         atualizado_em         = now();
end $$;

-- Os GRANTs da 061 seguem valendo: `create or replace` preserva as permissões.
-- Repetidos aqui porque um `drop`/`create` futuro que os esquecesse abriria a
-- função para `authenticated`, e o custo de repetir é zero.
revoke execute on function public.ml_credencial_gravar(uuid, text, text, text) from public, anon, authenticated;
grant  execute on function public.ml_credencial_gravar(uuid, text, text, text) to service_role;

-- ============================================================
-- CONFERÊNCIA
-- ============================================================
--
--   select marketplace, seller_id, count(*)
--     from public.canais_marketplace
--    where seller_id is not null and ativo
--    group by 1, 2 having count(*) > 1;
--
-- Tem que voltar vazio — e agora o banco garante que volte.

-- ============================================================
-- O LEDGER (regra da 043: a propria migracao registra a propria linha)
-- ============================================================

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('076', '076-uma-conta-do-ml-pertence-a-uma-loja', now(),
        'Indice unico parcial (marketplace, seller_id) where seller_id is not null and ativo: uma conta ATIVA de marketplace pertence a uma loja so. Parcial para nao travar a troca legitima (desconectar de A, conectar em B). ml_credencial_gravar passa a recusar antes, nomeando a loja que ja tem a conta, em vez de deixar vazar a prosa do Postgres.')
on conflict do nothing;
