-- ============================================================
-- Zion OS — Migração 033: os custos que não são do marketplace
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
--
-- O QUE ESTAVA FALTANDO
--
-- O modelo do Zion cobrava comissão, taxa fixa e frete, chamava isso de "custo
-- da venda" e declarava a margem. A conta que o lojista mantém à mão tem dez
-- linhas, e o Zion conhecia três:
--
--   custo do produto
--   + embalagem 0,50 + etiqueta 0,15 + informativos 0,50
--   + comissão do marketplace (%) + taxa fixa
--   + comissão do gestor 1% + Simples Nacional 12% + comissão do ERP 1%
--
-- As linhas ausentes somam 14 PONTOS PERCENTUAIS e R$ 1,15 por pedido. Numa
-- sandália de R$ 150 isso é R$ 22,15 de lucro que o sistema não descontava: o
-- Zion dizia 20,7% de margem e "Saudável" onde a planilha do lojista mostrava
-- ~6%. Otimismo em precificação não aparece como erro — aparece como margem
-- que some.
--
-- CADA LOJISTA TEM OS SEUS
--
-- A alíquota depende do regime tributário; a comissão interna, de como a
-- operação é montada; a embalagem, do que se compra. Nada disso pode ser
-- constante no código — por isso vive no cliente, como a margem mínima (029).
--
-- DEFAULT ZERO É DELIBERADO
--
-- Quem não preencher calcula exatamente como calculava antes. A migração não
-- muda nenhum número sozinha: ela só abre a possibilidade. Ligar um custo é uma
-- decisão do lojista, tomada na tela, com o efeito visível na hora.
--
-- ACESSO — segue o padrão do portal (005/029): o cliente NÃO lê nem escreve
-- `clientes` direto. Duas funções security definer expõem EXATAMENTE estes
-- campos. Uma política de update na tabela deixaria o lojista alterar plano,
-- status, risco e limite da própria conta.
-- ============================================================

alter table public.clientes
  add column if not exists custo_embalagem              numeric(10,2) not null default 0,
  add column if not exists custo_etiqueta               numeric(10,2) not null default 0,
  add column if not exists custo_informativos           numeric(10,2) not null default 0,
  add column if not exists imposto_percentual           numeric(5,2)  not null default 0,
  add column if not exists comissao_gestor_percentual   numeric(5,2)  not null default 0,
  add column if not exists comissao_sistema_percentual  numeric(5,2)  not null default 0,
  add column if not exists cupom_percentual             numeric(5,2)  not null default 0;

-- Faixas: dinheiro não é negativo, percentual não chega a 100.
--
-- O teto de 100 não é preciosismo. Um imposto de 1200% (dedo escorregando no
-- teclado) zeraria o divisor do preço mínimo e produziria um número absurdo com
-- cara de resposta — o mesmo silêncio que já gravou R$ 30 milhões de custo
-- nesta base. O banco recusa antes de a tela ter chance de errar.
alter table public.clientes
  drop constraint if exists clientes_custos_faixa;
alter table public.clientes
  add constraint clientes_custos_faixa check (
    custo_embalagem >= 0 and custo_etiqueta >= 0 and custo_informativos >= 0
    and imposto_percentual          >= 0 and imposto_percentual          < 100
    and comissao_gestor_percentual  >= 0 and comissao_gestor_percentual  < 100
    and comissao_sistema_percentual >= 0 and comissao_sistema_percentual < 100
    and cupom_percentual            >= 0 and cupom_percentual            < 100
  );

-- ---- Leitura pelo portal ----------------------------------------------------

create or replace function public.portal_custos_do_lojista()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'embalagem',                   coalesce(c.custo_embalagem, 0),
    'etiqueta',                    coalesce(c.custo_etiqueta, 0),
    'informativos',                coalesce(c.custo_informativos, 0),
    'impostoPercentual',           coalesce(c.imposto_percentual, 0),
    'comissaoGestorPercentual',    coalesce(c.comissao_gestor_percentual, 0),
    'comissaoSistemaPercentual',   coalesce(c.comissao_sistema_percentual, 0),
    'cupomPercentual',             coalesce(c.cupom_percentual, 0)
  )
  from public.clientes c
  where c.id = public.cliente_do_usuario();
$$;

-- ---- Escrita pelo portal ----------------------------------------------------

create or replace function public.portal_definir_custos_do_lojista(
  p_embalagem numeric,
  p_etiqueta numeric,
  p_informativos numeric,
  p_imposto numeric,
  p_gestor numeric,
  p_sistema numeric,
  p_cupom numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid := public.cliente_do_usuario();
begin
  if alvo is null then
    raise exception 'sem cliente associado';
  end if;
  update public.clientes
     set custo_embalagem             = greatest(coalesce(p_embalagem, 0), 0),
         custo_etiqueta              = greatest(coalesce(p_etiqueta, 0), 0),
         custo_informativos          = greatest(coalesce(p_informativos, 0), 0),
         imposto_percentual          = greatest(coalesce(p_imposto, 0), 0),
         comissao_gestor_percentual  = greatest(coalesce(p_gestor, 0), 0),
         comissao_sistema_percentual = greatest(coalesce(p_sistema, 0), 0),
         cupom_percentual            = greatest(coalesce(p_cupom, 0), 0)
   where id = alvo;
end;
$$;

grant execute on function public.portal_custos_do_lojista() to authenticated;
grant execute on function public.portal_definir_custos_do_lojista(
  numeric, numeric, numeric, numeric, numeric, numeric, numeric
) to authenticated;

-- ------------------------------------------------------------
-- VERIFICAÇÃO (somente leitura):
--   -- esperado: todos em 0, ou seja, nada mudou de comportamento ainda
--   select count(*) filter (where imposto_percentual = 0) as sem_imposto, count(*) as total
--     from public.clientes;
--
--   select public.portal_custos_do_lojista();   -- do cliente logado
--
--   -- a constraint recusa o absurdo:
--   -- update public.clientes set imposto_percentual = 1200;  →  erro
--
-- REVERTER:
--   drop function if exists public.portal_definir_custos_do_lojista(numeric,numeric,numeric,numeric,numeric,numeric,numeric);
--   drop function if exists public.portal_custos_do_lojista();
--   alter table public.clientes drop constraint if exists clientes_custos_faixa;
--   alter table public.clientes
--     drop column if exists custo_embalagem, drop column if exists custo_etiqueta,
--     drop column if exists custo_informativos, drop column if exists imposto_percentual,
--     drop column if exists comissao_gestor_percentual,
--     drop column if exists comissao_sistema_percentual, drop column if exists cupom_percentual;
--   delete from public.migracoes_aplicadas where numero = '033';
-- ------------------------------------------------------------

-- ★ Auto-registro (convenção ≥024):
insert into public.migracoes_aplicadas (numero, nome, observacao)
values ('033','033-custos-do-lojista','imposto, comissões internas, embalagem, etiqueta, informativos e cupom por cliente — default 0 preserva o cálculo atual')
on conflict (numero) do nothing;
