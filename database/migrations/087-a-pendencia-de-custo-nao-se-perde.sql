-- ============================================================
-- Zion OS — Migração 087: a pendência de custo não se perde
--
-- INCREMENTAL e NÃO DESTRUTIVA. Cria UMA tabela. Nenhuma existente muda.
--
-- ============================================================
-- O DEFEITO QUE ISTO CONSERTA
-- ============================================================
--
-- `importarCustos` (033/046) já sabe RECUSAR gravar quando duas ou mais linhas
-- da planilha reivindicam o mesmo produto com custos diferentes — chutar um
-- seria gravar custo errado em silêncio, e isso está certo. O que estava
-- errado era parar aí: os candidatos em disputa (`AmbiguidadeCusto`) só
-- existiam dentro do resultado daquela chamada, mostrados uma vez pela caixa
-- `ResolverAmbiguos` durante a importação. Se ninguém decidia ali, a disputa
-- desaparecia — o produto ficava sem custo e NADA registrava que havia dois
-- números concorrendo por ele. Perda de dado, não feature.
--
-- Esta tabela dá um endereço permanente à disputa: ela sobrevive à sessão de
-- importação e fica visível em qualquer tela que precise varrer o catálogo
-- procurando conflito (a tela de Custos da loja, a primeira consumidora).
--
-- ============================================================
-- POR QUE TABELA PRÓPRIA, E NÃO `procedencia_de_campo` (038)
-- ============================================================
--
-- `procedencia_de_campo` é append-only e responde "de onde veio o valor que
-- ESTÁ gravado" — uma linha por fato já decidido. Uma disputa ainda ABERTA não
-- é um fato: é duas ou mais afirmações concorrentes, nenhuma delas escolhida.
-- Misturar os dois conceitos numa tabela só faria "a origem do valor atual"
-- carregar candidatos que nunca foram escritos em lugar nenhum.
--
-- As duas se encontram na resolução: quando a pendência é resolvida, o valor
-- escolhido vira uma linha nova em `procedencia_de_campo` (via
-- `registrarProcedencia`, na rota de servidor) — a pendência registra a
-- DISPUTA e a decisão; a procedência registra o FATO que resultou dela.
--
-- ============================================================
-- CANDIDATOS: DOIS OU MAIS, NUNCA UM SÓ
-- ============================================================
--
-- `candidatos` é `jsonb`, um array de `{valor, origem}` — a MESMA forma que
-- `AmbiguidadeCusto.candidatos` já usa em `importacaoCustos.ts`, para a
-- gravação ser uma cópia direta, sem tradução. O CHECK exige pelo menos DOIS
-- elementos: o caso real que motivou isto tem três fontes discordando do
-- mesmo SKU, e nada aqui assume que disputa é sempre binária.
--
-- ============================================================
-- RESOLUÇÃO: A LINHA NÃO SOME, VIRA HISTÓRICO
-- ============================================================
--
-- Resolver não apaga a linha — marca `resolvido_em`/`resolvido_por` e grava
-- `valor_escolhido` e `descartados` (os candidatos que perderam, congelados no
-- momento da decisão). "Quais foram descartados" fica registrado aqui, e não
-- só derivável por subtração: um fato decidido merece ficar escrito por
-- extenso, não recalculado toda vez que alguém perguntar.
--
-- O CHECK `custo_pendencias_resolucao_coerente` fecha a porta do meio-termo:
-- ou a pendência está totalmente aberta (as quatro colunas de resolução nulas)
-- ou totalmente resolvida (`resolvido_em` e `valor_escolhido` presentes).
-- Sem isso seria possível gravar `resolvido_em` sem valor, ou valor sem data —
-- os dois são o mesmo evento e precisam nascer juntos.
--
-- Só pode haver UMA pendência ABERTA por produto por vez (índice único
-- parcial, `where resolvido_em is null`) — uma segunda importação com nova
-- disputa sobre o mesmo produto ATUALIZA a pendência aberta existente (feito
-- na aplicação, não aqui), em vez de abrir uma segunda.
--
-- ============================================================
-- ACESSO — sem policy de escrita para `authenticated`, de propósito
-- ============================================================
--
-- Diferente de `procedencia_de_campo` (que também aceita leitura direta do
-- lojista mas não tem escrita de cliente), aqui NENHUMA escrita passa pelo
-- navegador: nem a criação (a importação manda os candidatos para uma rota de
-- servidor, que grava com `service_role`) nem a resolução (que precisa gravar
-- `resolvido_por` com o id verdadeiro do usuário da SESSÃO DO SERVIDOR, não um
-- valor que o corpo da requisição poderia forjar, e precisa gravar a
-- procedência na MESMA operação). RLS ligado sem nenhuma policy de
-- insert/update/delete nega as três por padrão — a leitura é a única porta
-- aberta ao tenant.
-- ============================================================

create table if not exists public.custo_pendencias (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,

  -- [{"valor": 36.19, "origem": "linha 12: Chinelo X (planilha ERP)"}, ...]
  -- Mínimo dois: ver o cabeçalho.
  candidatos jsonb not null,

  criado_em timestamptz not null default now(),

  -- As quatro colunas abaixo nascem juntas, na resolução — nunca uma sem as
  -- outras. Ver o CHECK de coerência.
  resolvido_em timestamptz,
  resolvido_por uuid references auth.users(id) on delete set null,
  valor_escolhido numeric(12,2),
  -- Os candidatos que NÃO venceram, congelados no momento da escolha.
  descartados jsonb,

  constraint custo_pendencias_candidatos_forma check (
    jsonb_typeof(candidatos) = 'array' and jsonb_array_length(candidatos) >= 2
  ),
  constraint custo_pendencias_resolucao_coerente check (
    (resolvido_em is null and resolvido_por is null and valor_escolhido is null and descartados is null)
    or
    (resolvido_em is not null and valor_escolhido is not null)
  )
);

-- Uma pendência aberta por produto. A segunda disputa sobre o mesmo produto
-- ATUALIZA esta linha (aplicação), não cria uma segunda.
create unique index if not exists custo_pendencias_aberta_por_produto
  on public.custo_pendencias (produto_id)
  where resolvido_em is null;

-- Para a tela varrer "quais pendências desta loja estão abertas hoje".
create index if not exists custo_pendencias_cliente_idx
  on public.custo_pendencias (cliente_id, resolvido_em);

comment on table public.custo_pendencias is
  'Disputas de custo com 2+ fontes discordando, geradas hoje pela importação de planilha. Resolvida != apagada: vira historico com valor_escolhido e descartados. Sem policy de escrita para authenticated — criacao e resolucao passam por rota de servidor (service_role).';

-- ============================================================
-- RLS — leitura do próprio tenant; escrita só service_role
-- ============================================================

alter table public.custo_pendencias enable row level security;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'cliente_do_usuario') then
    execute $p$
      create policy custo_pendencias_leitura on public.custo_pendencias
        for select using (cliente_id = public.cliente_do_usuario());
    $p$;
  else
    raise notice 'cliente_do_usuario() ausente: RLS ligado sem politicas (nega tudo).';
  end if;
exception when duplicate_object then
  raise notice 'politica de custo_pendencias ja existia; nada a fazer';
end $$;

-- ============================================================
-- A PROVA
-- ============================================================

do $$
declare
  v_anon boolean;
  v_auth_insert boolean;
begin
  select has_table_privilege('anon', 'public.custo_pendencias', 'select') into v_anon;
  if v_anon then
    raise exception 'MIGRACAO 087: anon consegue ler custo_pendencias.';
  end if;

  -- RLS ligado + zero policy de insert para authenticated = escrita negada.
  select exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'custo_pendencias' and cmd = 'INSERT'
  ) into v_auth_insert;
  if v_auth_insert then
    raise exception 'MIGRACAO 087: existe policy de INSERT — o desenho exige escrita so por service_role.';
  end if;

  raise notice '087 conferida: RLS ligado, so leitura por tenant, nenhuma policy de escrita.';
end $$;

-- ------------------------------------------------------------
-- VERIFICAÇÃO (somente leitura):
--   select column_name, data_type from information_schema.columns
--    where table_schema='public' and table_name='custo_pendencias'
--    order by ordinal_position;
--
--   -- esperado ZERO linhas logo após aplicar:
--   select count(*) from public.custo_pendencias;
--
--   -- a constraint recusa disputa de um lado só:
--   -- insert into custo_pendencias (cliente_id, produto_id, candidatos)
--   --   values ('<id>', '<id>', '[{"valor":10,"origem":"x"}]');  →  erro
--
-- REVERTER:
--   drop table if exists public.custo_pendencias;
--   delete from public.migracoes_aplicadas where numero = '087';
-- ------------------------------------------------------------

-- ★ Auto-registro (convenção ≥024):
insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('087', '087-a-pendencia-de-custo-nao-se-perde', now(),
        'Tabela custo_pendencias: disputas de custo (2+ fontes) sobrevivem a sessao de importacao. Resolvida vira historico (valor_escolhido + descartados), nunca e apagada. RLS: leitura por tenant, escrita so service_role.')
on conflict (numero) do nothing;
