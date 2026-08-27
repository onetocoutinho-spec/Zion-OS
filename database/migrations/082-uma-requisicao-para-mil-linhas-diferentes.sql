-- 082 — Gravar mil linhas com valores DIFERENTES numa requisição só.
--
-- ===========================================================================
-- O QUE TRAVA HOJE
-- ===========================================================================
--
-- `atualizarVarios` agrupa por payload IDENTICO: propagar um custo para 40
-- variacoes e UMA requisicao, porque as 40 tem o mesmo corpo. Mas importacao de
-- custo/preco/estoque tem um valor por LINHA — cada produto com o seu numero —
-- e ai o agrupamento vira identidade: N linhas, N requisicoes.
--
-- Medido em 27/08/2026: a importacao de custos casou 159 variacoes e 75
-- produtos, gravou as variacoes e PAROU antes dos produtos. A tela travou e a
-- base ficou meia gravada — variacao com custo, produto sem. O proprio
-- `atualizarVarios` ja documentava o sintoma: 790 requisicoes sequenciais
-- deixaram a lojista minutos olhando a tela numa gravacao anterior.
--
-- Com o casamento por prefixo marcado, seriam ~946 linhas. Centenas de
-- requisicoes.
--
-- ===========================================================================
-- POR QUE NAO E UPSERT
-- ===========================================================================
--
-- Ja foi, e nao podia funcionar. O upsert vira `insert ... on conflict do
-- update`, e o Postgres valida NOT NULL na linha PROPOSTA antes de descobrir
-- que o id existe. Um payload `{id, custo}` numa tabela onde `cliente_id` e
-- obrigatorio morre com "null value violates not-null constraint" mesmo sendo
-- um update inofensivo. Efeito medido na epoca: 1.806 produtos, 1 gravado.
--
-- Um UPDATE ... FROM jsonb nao tem esse problema: so mexe em coluna declarada,
-- e linha que nao existe simplesmente nao e tocada.
--
-- ===========================================================================
-- SECURITY INVOKER — E ISSO NAO E DETALHE
-- ===========================================================================
--
-- As duas funcoes rodam com os direitos de QUEM CHAMA, entao a RLS continua
-- valendo: a loja so alcanca as proprias linhas, a agencia so as lojas dela.
--
-- `security definer` aqui seria um buraco do tamanho do produto — passaria por
-- cima do escopo de cliente e deixaria qualquer sessao autenticada gravar em
-- qualquer loja. A ausencia da palavra e a decisao.
--
-- ===========================================================================
-- NULL SIGNIFICA "NAO MEXE"
-- ===========================================================================
--
-- Cada coluna usa `coalesce(do_json, a_atual)`. Chave ausente no objeto vira
-- NULL no cast e o `coalesce` devolve o valor que ja estava — que e exatamente
-- a semantica de atualizacao PARCIAL que o app usa.
--
-- Consequencia assumida: por aqui nao da para gravar NULL de proposito. Nenhum
-- caminho de importacao faz isso; quem precisar continua usando o update campo
-- a campo.

create or replace function public.atualizar_produtos_em_lote(p_dados jsonb)
returns integer
language sql
security invoker
set search_path = public
as $$
  with alterados as (
    update public.produtos p set
      custo            = coalesce((r->>'custo')::numeric,          p.custo),
      preco_venda      = coalesce((r->>'preco_venda')::numeric,    p.preco_venda),
      estoque          = coalesce((r->>'estoque')::integer,        p.estoque),
      margem           = coalesce((r->>'margem')::numeric,         p.margem),
      preco_minimo     = coalesce((r->>'preco_minimo')::numeric,   p.preco_minimo),
      confianca_custo  = coalesce( r->>'confianca_custo',          p.confianca_custo),
      categoria_ml     = coalesce( r->>'categoria_ml',             p.categoria_ml),
      vendedor_paga_frete = coalesce((r->>'vendedor_paga_frete')::boolean, p.vendedor_paga_frete),
      updated_at       = now()
      from jsonb_array_elements(p_dados) as r
     where p.id = (r->>'id')::uuid
    returning 1
  )
  select count(*)::integer from alterados;
$$;

create or replace function public.atualizar_variantes_em_lote(p_dados jsonb)
returns integer
language sql
security invoker
set search_path = public
as $$
  with alterados as (
    update public.produto_variantes v set
      custo       = coalesce((r->>'custo')::numeric,       v.custo),
      preco_base  = coalesce((r->>'preco_base')::numeric,  v.preco_base),
      estoque     = coalesce((r->>'estoque')::integer,     v.estoque),
      peso        = coalesce((r->>'peso')::numeric,        v.peso),
      altura      = coalesce((r->>'altura')::numeric,      v.altura),
      largura     = coalesce((r->>'largura')::numeric,     v.largura),
      comprimento = coalesce((r->>'comprimento')::numeric, v.comprimento),
      ean         = coalesce( r->>'ean',                   v.ean),
      cor         = coalesce( r->>'cor',                   v.cor),
      tamanho     = coalesce( r->>'tamanho',               v.tamanho),
      updated_at  = now()
      from jsonb_array_elements(p_dados) as r
     where v.id = (r->>'id')::uuid
    returning 1
  )
  select count(*)::integer from alterados;
$$;

-- `authenticated` e so; `anon` nao grava nada em lugar nenhum deste produto.
revoke all on function public.atualizar_produtos_em_lote(jsonb) from public, anon;
revoke all on function public.atualizar_variantes_em_lote(jsonb) from public, anon;
grant execute on function public.atualizar_produtos_em_lote(jsonb) to authenticated, service_role;
grant execute on function public.atualizar_variantes_em_lote(jsonb) to authenticated, service_role;

comment on function public.atualizar_produtos_em_lote(jsonb) is
  'Atualiza N produtos com valores DIFERENTES numa requisicao. security invoker: a RLS continua valendo. NULL/ausente = nao mexe na coluna.';
comment on function public.atualizar_variantes_em_lote(jsonb) is
  'Idem para produto_variantes.';

-- ★ Auto-registro (convencao declarada na 024).
insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('082', '082-uma-requisicao-para-mil-linhas-diferentes', now(),
        'Duas funcoes de update em lote por jsonb, para gravacoes com um valor por linha (custo/preco/estoque). Antes eram N requisicoes: a importacao de 27/08/2026 gravou 159 variacoes, travou e deixou os 75 produtos sem nada. security invoker de proposito — a RLS precisa continuar valendo. NULL/ausente significa "nao mexe", que e a semantica parcial que o app ja usa.')
on conflict (numero) do nothing;
