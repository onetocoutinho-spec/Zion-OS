-- 074 — O QUE O MERCADO LIVRE JÁ DIZIA E O ZION JOGAVA FORA
--
-- ===========================================================================
-- O QUE FOI MEDIDO EM 24/08/2026
-- ===========================================================================
--
-- `mapearItem` extrai 38 campos de cada anúncio do ML. `anuncios_gerados`
-- guarda 8. Varrendo `src/` por cada nome, nove deles têm ZERO uso fora do
-- cliente do ML — são lidos, atravessam a importação inteira e morrem quando a
-- requisição termina.
--
-- O mais caro é `listing_type_id`. A comissão que entra no cálculo de margem
-- vem de `canais_marketplace.tipoAnuncio`, uma configuração DA LOJA INTEIRA
-- com padrão "Premium" — enquanto o ML informa o tipo ANÚNCIO POR ANÚNCIO e o
-- Zion descarta. Em Moda a diferença é 14% contra 19%: cinco pontos sobre o
-- número que a lojista usa para decidir por quanto vender. Numa loja com os
-- dois tipos, parte das margens está errada e todas têm a mesma cara.
--
-- ===========================================================================
-- O QUE NÃO ENTRA, E POR QUÊ
-- ===========================================================================
--
-- Guardar campo sem uso é o mesmo defeito ao contrário — ler sem saber por
-- quê. Ficam de fora, de propósito:
--
--   video_id, tags            nenhuma pergunta do Copilot depende deles hoje
--   original_price            preço promocional; `price` e `base_price` já
--                             cobrem o que a precificação usa
--   parent_item_id, family_id a família passou a ser LIDA AO VIVO no ML em
--                             24/08 (`familiaNoAnuncio.ts`) — guardar uma
--                             cópia que envelhece competiria com ela
--   initial_quantity          só serviria junto de uma pergunta sobre
--                             sell-through que ninguém faz ainda
--   catalog_product_id        identifica QUAL produto de catálogo; agir sobre
--                             isso exige um endpoint que o código não chama.
--                             `do_catalogo_ml` (o booleano) basta para dizer
--                             que o anúncio disputa catálogo.
--
-- Quando uma dessas virar pergunta real, a coluna nasce com o uso junto.
--
-- ===========================================================================
-- TODAS ANULÁVEIS, E NENHUMA COM DEFAULT
-- ===========================================================================
--
-- `null` = o ML não disse, ou ninguém perguntou ainda. Um `default 0` em
-- `vendidos_ml` afirmaria "não vendeu nada" sobre 880 anúncios que ninguém
-- mediu; um `default false` em `do_catalogo_ml` afirmaria "não disputa
-- catálogo". É a mesma regra que já vale para `status_marketplace`: vazio ≠
-- negado ≠ desconhecido.

alter table public.anuncios_gerados
  -- `gold_pro` / `gold_special`, CRU como o ML manda. A tradução para
  -- Premium/Clássico é decisão de domínio e mora no código, não na coluna:
  -- gravar já traduzido perderia o valor original quando o ML criar um tipo
  -- novo, e o "não reconheço este tipo" viraria "é clássico".
  add column if not exists tipo_anuncio_ml        text,
  add column if not exists criado_em_ml           timestamptz,
  add column if not exists atualizado_em_ml       timestamptz,
  add column if not exists vendidos_ml            integer,
  add column if not exists saude_ml               numeric,
  add column if not exists do_catalogo_ml         boolean,
  add column if not exists tem_descricao_ml       boolean;

comment on column public.anuncios_gerados.tipo_anuncio_ml is
  'listing_type_id do ML, CRU (`gold_pro` = Premium, `gold_special` = Clássico). Decide a comissão DESTE anúncio; sem ele a precificação usa a configuração da loja inteira. NULL = não lido.';
comment on column public.anuncios_gerados.criado_em_ml is
  'date_created do ML — a idade do anúncio. NULL = não lido.';
comment on column public.anuncios_gerados.atualizado_em_ml is
  'last_updated do ML — quando o anúncio mudou pela última vez, do lado do ML. NULL = não lido.';
comment on column public.anuncios_gerados.vendidos_ml is
  'sold_quantity do ML — quanto ESTE anúncio vendeu na vida. NULL = não lido, nunca zero por omissão.';
comment on column public.anuncios_gerados.saude_ml is
  'health do ML (0..1) — a nota que decide exposição. NULL = não lido.';
comment on column public.anuncios_gerados.do_catalogo_ml is
  'catalog_listing do ML — o anúncio disputa o catálogo (quem perde o buy box fica invisível). NULL = não lido.';
comment on column public.anuncios_gerados.tem_descricao_ml is
  'Se o anúncio TEM descrição no ML. O texto em si é outra rota. NULL = não lido.';

-- Índice só onde há pergunta: "quais anúncios são clássicos?" entra no cálculo
-- de margem de uma loja inteira, e sem ele isso é varredura em 880 linhas por
-- pergunta. Parcial porque a coluna nasce toda nula e assim fica pequeno.
create index if not exists anuncios_gerados_tipo_anuncio_ml_idx
  on public.anuncios_gerados (cliente_id, tipo_anuncio_ml)
  where tipo_anuncio_ml is not null;

-- ============================================================
-- O LEDGER (regra da 043: a propria migracao registra a propria linha)
-- ============================================================

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('074', '074-o-que-o-ml-diz-e-o-zion-descartava', now(),
        'anuncios_gerados ganha sete campos que o ML ja mandava e a importacao descartava: tipo_anuncio_ml, criado_em_ml, atualizado_em_ml, vendidos_ml, saude_ml, do_catalogo_ml, tem_descricao_ml. O mais caro e tipo_anuncio_ml — a comissao saia da configuracao da loja inteira, e o ML informa por anuncio.')
on conflict do nothing;
