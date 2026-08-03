-- ============================================================
-- 052 — as infrações da conta deixam de sumir num F5
-- ============================================================
--
-- O QUE A CONTA REAL RESPONDEU EM 03/08/2026
-- ------------------------------------------
-- A leitura completa de `/moderations/infractions/{userId}` — 53 páginas, todas
-- lidas, nenhuma falhou — devolveu:
--
--     1.060 infrações, em 460 ANÚNCIOS DISTINTOS
--     de uma conta com 781 anúncios  →  59% do catálogo está punido
--
--     560×  Algumas fotos não cumprem os requisitos          400 anúncios
--     344×  A foto de capa não cumpre os requisitos          318 anúncios
--     110×  Título e/ou fotos não correspondem ao produto     25 anúncios
--      18×  Era idêntica a outra das suas opções de venda     18 anúncios
--       7×  A foto de capa tem logotipos e/ou textos           7 anúncios
--       6×  Dados do produto não correspondem ao original      6 anúncios
--       1×  Igual a outro cancelado em CONTA ASSOCIADA por
--           possível falsificação                              1 anúncio
--
-- 904 das 1.060 são FOTO. E tudo isso vivia na memória da aba: sumia num F5.
--
-- Sem gravar, é impossível dizer "ontem eram 460, hoje são 430" — que é a única
-- frase que prova trabalho feito. É o mesmo defeito que a 051 corrigiu para o
-- estado no marketplace, na categoria que ameaça a CONTA e não o anúncio.
--
-- POR QUE TABELA, E NÃO COLUNA
-- ----------------------------
-- A relação é de muitos para um: o mesmo anúncio aparece punido 13 vezes, e
-- MLB4820492395 apareceu cinco vezes numa página só. Coluna em `anuncios_gerados`
-- guardaria a última e apagaria o histórico — e o histórico É o produto aqui,
-- porque reincidência é o que o ML pune com a conta.
--
-- AS TRÊS DECISÕES QUE O DADO REAL IMPÔS
-- --------------------------------------
--  1. `related_item_id` é NULLABLE. Nem todo elemento moderado é um anúncio: um
--     `element_id` voltou como hash (`0183949ead1e473b9f014af32a0b3ed7...`), não
--     como MLB — o ML modera também pergunta e review. NOT NULL aqui perderia
--     exatamente a linha que a gente não entende, que é a que mais importa.
--
--  2. `motivo` e `remedio` entram VERBATIM, inclusive o HTML. O `remedy` chega
--     como `<div><strong>Pausamos o anúncio…</strong></div>`. Guardar limpo
--     seria guardar a NOSSA interpretação; a limpeza é decisão de exibição, e
--     ela já vive em `semHtml`. É a mesma regra da 050: a palavra do ML entra
--     como ele disse.
--
--  3. `idioma` é gravado porque o parâmetro NÃO é respeitado. Pedimos
--     `language=PT` e um motivo voltou em espanhol ("Algunas fotos incumplen
--     los requisitos"). Sem registrar, a tela mistura idiomas e ninguém sabe
--     por quê.
--
-- IDEMPOTÊNCIA
-- ------------
-- `unique (cliente_id, infracao_id)` — reler a conta não duplica. A leitura é
-- append-only por natureza: o ML dá um id por infração e ele não muda.
--
-- `lida_em` é quando NÓS vimos, não quando o ML puniu (`data_criacao`). São
-- datas diferentes e confundi-las inventaria uma linha do tempo que não existe.
-- ============================================================

create table if not exists public.infracoes_marketplace (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  marketplace     text not null default 'Mercado Livre',

  -- A identidade da infração no ML. É ela que torna a releitura idempotente.
  infracao_id     text not null,

  -- Quando o ML puniu (ele devolve YYYY-MM-DD, sem hora).
  data_criacao    date,

  -- O elemento moderado. Pode ser item, pergunta ou review — ITM/QUE/REV.
  element_id      text,
  element_type    text,

  -- O anúncio associado. NULL quando o elemento não é um anúncio: medido.
  related_item_id text,

  site_id         text,
  filter_subgroup text,

  -- A palavra do ML, verbatim. `remedio` chega em HTML.
  motivo          text,
  remedio         text,

  -- O idioma que VEIO, não o que pedimos. Medido: `language=PT` não é honrado.
  idioma          text,

  -- Quando NÓS lemos. Diferente de `data_criacao`, e de propósito.
  lida_em         timestamptz not null default now(),

  constraint infracoes_marketplace_unica unique (cliente_id, infracao_id)
);

-- "Este anúncio tem infração aberta?" é a pergunta da trava de reincidência, e
-- ela roda antes de toda publicação. O índice parcial cobre só as linhas que
-- têm anúncio — as de pergunta e review nunca são consultadas por aqui.
create index if not exists idx_infracoes_cliente_item
  on public.infracoes_marketplace (cliente_id, related_item_id)
  where related_item_id is not null;

-- "O que mudou desde ontem?" — a pergunta que a 051 tornou possível para o
-- estado e que esta torna possível para a punição.
create index if not exists idx_infracoes_cliente_data
  on public.infracoes_marketplace (cliente_id, data_criacao desc);

alter table public.infracoes_marketplace enable row level security;

-- AS MESMAS DUAS POLÍTICAS DAS IRMÃS DO CATÁLOGO, palavra por palavra
-- (`produtos`, `produto_variantes`, `imagens_produto`, `produto_atributos`).
-- Não invento forma nova para uma tabela que faz parte de um conjunto — foi
-- assim que a 005 deixou 29 tabelas com `using (true)` e neutralizou o escopo.
drop policy if exists equipe_total on public.infracoes_marketplace;
create policy equipe_total on public.infracoes_marketplace
  for all to authenticated
  using      (eh_equipe())
  with check (eh_equipe());

drop policy if exists cliente_escopo on public.infracoes_marketplace;
create policy cliente_escopo on public.infracoes_marketplace
  for all to authenticated
  using      (cliente_id = cliente_do_usuario())
  with check (cliente_id = cliente_do_usuario());

-- ============================================================
-- A MIGRAÇÃO CONFERE O PRÓPRIO EFEITO E ABORTA SE NÃO BATER
-- ============================================================
-- O padrão que a 041 instaurou. A 005 ALEGOU trocar 24 políticas, não trocou, e
-- nada percebeu: política permissiva a mais não quebra tela, só abre. Aqui, se
-- o RLS não estiver ligado ou faltar política, a transação inteira volta.
do $$
declare
  rls_ligado boolean;
  politicas  integer;
begin
  select c.relrowsecurity into rls_ligado
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'infracoes_marketplace';

  if not coalesce(rls_ligado, false) then
    raise exception 'RLS NAO ficou ligado em infracoes_marketplace — a tabela estaria aberta';
  end if;

  select count(*) into politicas
    from pg_policies
   where schemaname = 'public'
     and tablename  = 'infracoes_marketplace'
     and policyname in ('equipe_total', 'cliente_escopo');

  if politicas <> 2 then
    raise exception 'esperava 2 politicas em infracoes_marketplace, encontrei %', politicas;
  end if;
end $$;

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('052', '052-as-infracoes-da-conta', now(),
        'Tabela infracoes_marketplace (append-only, unique por cliente+infracao_id) + RLS equipe_total/cliente_escopo. Motivada pela leitura completa de 03/08/2026: 1.060 infracoes em 460 anuncios distintos de 781 (59% da conta), 904 delas de foto. related_item_id NULLABLE porque nem todo elemento moderado e anuncio; motivo/remedio verbatim (remedy vem em HTML); idioma gravado porque language=PT nao e respeitado. A migracao confere o proprio efeito.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   drop table if exists public.infracoes_marketplace;
--
-- Reverter também o tipo `InfracaoRegistro`, o mapeador e o gravador da
-- leitura. A tela volta a depender de rodar o diagnóstico, e o resultado volta
-- a sumir num F5.
-- ============================================================
