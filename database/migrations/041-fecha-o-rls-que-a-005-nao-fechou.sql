-- ============================================================
-- Zion OS — Migração 041: fecha o RLS que a 005 §3 alegou fechar e não fechou
--
-- INCREMENTAL. NÃO destrutiva de dados — troca política, não apaga linha.
--
-- ============================================================
-- O QUE ACONTECEU
-- ============================================================
--
-- A migração 005 §3 tinha um laço que, em 24 tabelas, deveria trocar
-- `equipe_autenticada (using true)` por `equipe_total (using eh_equipe())`.
-- O ledger registra 005 como aplicada. O banco discorda:
--
--   equipe_autenticada (using true)   29 tabelas
--   equipe_total (using eh_equipe())   1 tabela  (canais_marketplace, veio da 009)
--
-- Medido em 2026-07-29 (DB-AUDIT-001). O laço da 005 nunca rodou por inteiro, e
-- nada no sistema percebeu — porque uma política PERMISSIVA a mais não quebra
-- tela nenhuma. Ela só abre.
--
-- ============================================================
-- POR QUE `cliente_escopo` NÃO ESTAVA PROTEGENDO NADA
-- ============================================================
--
-- Dez tabelas têm as DUAS políticas. Ambas são PERMISSIVE, e políticas
-- permissivas se combinam com OR:
--
--     true  OR  (cliente_id = cliente_do_usuario())   ==   true
--
-- `cliente_escopo` estava lá, escrita corretamente, e sem efeito algum. Este é o
-- modo de falha que importa entender: a proteção existia, era legível, passava em
-- revisão de código — e era neutralizada por uma linha em outro arquivo.
--
-- Os GRANTs são os padrões do Supabase (`anon` e `authenticated` com SELECT,
-- INSERT, UPDATE, DELETE em tudo). RLS é o único portão. Conferido antes de
-- afirmar impacto: não há uma segunda camada que estivesse segurando.
--
-- ============================================================
-- O QUE FOI MEDIDO — antes, com o usuário cliente real
-- ============================================================
--
-- Simulando `alexaissa@gmail.com` (papel `cliente`, eh_equipe() = false), com um
-- SEGUNDO lojista inserido na mesma transação e rollback ao final:
--
--   vê 74 produtos          (73 dele + 1 do vizinho)
--   vê 2 lojas
--   ESCREVE 1 produto do vizinho
--   ESCREVE as 3 linhas de `decisoes` — a AIL, que o código trata como
--                                        somente-leitura (RFC-AIL-001)
--   ESCREVE os 21 `agentes` e a própria linha de `clientes`
--
-- Depois desta migração, o MESMO teste: 73 produtos, 0 do vizinho, 0 lojas,
-- 0 escritas fora do próprio tenant, 0 escritas na AIL.
--
-- Com um tenant só, o vazamento entre lojas era hipótese. A escrita indevida
-- dentro do próprio tenant não era.
--
-- ============================================================
-- O QUE ESTA MIGRAÇÃO NÃO FAZ
-- ============================================================
--
-- NÃO mexe em `cliente_escopo` nem em `cliente_leitura`. Elas já estão certas —
-- só estavam sendo ignoradas. Depois daqui elas passam a decidir de verdade.
--
-- NÃO mexe nas tabelas do Copilot (035/037/038). Elas nasceram com o desenho
-- certo: SELECT por tenant, zero política de escrita, escrita só por service_role.
--
-- NÃO cria política de escrita em `perfis`. A 005 §4 previa `perfil_equipe_admin`
-- e ela também não existe — mas a gestão de usuários passa por
-- `/api/usuarios` com service_role, então criar a política aqui seria AFROUXAR
-- para resolver problema que ninguém tem. Fica registrado, não corrigido.
--
-- NÃO revoga os GRANTs de `anon`. Sem política, `anon` já não lê nada nestas
-- tabelas; mexer em GRANT é outra decisão, com outro raio de impacto.
--
-- ============================================================
-- QUEM PERDE O QUÊ — conferido tabela por tabela, no código e no banco
-- ============================================================
--
-- O portal do cliente toca, do navegador, exatamente estas tabelas:
--
--   produtos, produto_variantes, anuncios_gerados, auditorias_anuncios,
--   imagens_produto, canais_marketplace, fila_otimizacao_produto,
--   tabelas_medidas          -> todas têm `cliente_escopo`: SOBREVIVEM
--   pendencias, relatorios   -> têm `cliente_leitura` (SELECT), e o portal
--                               SÓ LÊ (`listarPendenciasDoCliente`,
--                               `listarRelatoriosDoCliente`): SOBREVIVEM
--   perfis                   -> `perfil_proprio`: SOBREVIVE
--
-- Todo o resto do portal passa por funções `portal_*` (SECURITY DEFINER, que
-- ignoram RLS) ou por rotas de API com service_role.
--
-- As escritas em `pendencias` e `relatorios` vivem em `/pendencias` e no
-- `RelatorioForm` — telas da EQUIPE. A Capability de pendências é instanciada só
-- em `src/app/pendencias/page.tsx`; o portal do cliente não alcança
-- `src/capabilities/`.
--
-- O cliente PERDE acesso a: agentes, anuncios, anuncio_variantes,
-- categoria_templates, clientes, conhecimentos, decisoes, delegacoes,
-- execucoes_agentes, execucoes_lote, fila_otimizacao, financeiro, ofertas,
-- onboardings, onboarding_items, padroes, precificacao_variantes,
-- produto_atributos, reunioes. Nenhuma delas é lida pelo portal.
--
-- ============================================================
-- A AUTOVERIFICAÇÃO, que é o que a 005 não tinha
-- ============================================================
--
-- A 005 falhou em silêncio. Esta migração termina conferindo o próprio efeito e
-- ABORTA se ele não estiver lá. Migração que alega e não prova foi exatamente o
-- que produziu este bug.
-- ============================================================

do $$
declare
  t text;
  trocadas int := 0;
begin
  foreach t in array array[
    -- as 24 da lista original da 005 que ainda existem
    'clientes','onboardings','onboarding_items','produtos','anuncios','agentes',
    'tarefas','relatorios','financeiro','execucoes_agentes','reunioes','pendencias',
    'produto_variantes','produto_atributos','categoria_templates','anuncio_variantes',
    'precificacao_variantes','imagens_produto','importacoes_anuncios','auditorias_anuncios',
    'problemas_anuncio','fila_otimizacao','execucoes_lote','anuncios_gerados',
    -- as cinco criadas DEPOIS da 005, que herdaram o mesmo `using (true)`
    -- por copiar o padrão dela: 022, 023, 025, 027, 028
    'decisoes','padroes','ofertas','conhecimentos','delegacoes'
  ]
  loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "equipe_autenticada" on public.%I', t);
      execute format('drop policy if exists "equipe_total" on public.%I', t);
      execute format(
        'create policy "equipe_total" on public.%I for all to authenticated
           using (public.eh_equipe()) with check (public.eh_equipe())', t);
      trocadas := trocadas + 1;
    end if;
  end loop;

  raise notice 'politicas trocadas: %', trocadas;
end $$;

-- ---------- a prova ----------

do $$
declare
  sobraram int;
  sem_equipe int;
begin
  select count(*) into sobraram
    from pg_policies
   where schemaname = 'public' and policyname = 'equipe_autenticada';

  if sobraram > 0 then
    raise exception
      'MIGRACAO 041 INCOMPLETA: % tabela(s) ainda com equipe_autenticada (using true). Nada foi commitado.',
      sobraram;
  end if;

  -- Toda tabela que tinha a política aberta precisa ter ganhado a fechada. Uma
  -- tabela com RLS ligado e SEM política nenhuma nega tudo — seguro, mas seria
  -- uma tela quebrada em vez de um vazamento, e o certo é saber qual dos dois.
  select count(*) into sem_equipe
    from unnest(array[
      'clientes','onboardings','onboarding_items','produtos','anuncios','agentes',
      'tarefas','relatorios','financeiro','execucoes_agentes','reunioes','pendencias',
      'produto_variantes','produto_atributos','categoria_templates','anuncio_variantes',
      'precificacao_variantes','imagens_produto','importacoes_anuncios','auditorias_anuncios',
      'problemas_anuncio','fila_otimizacao','execucoes_lote','anuncios_gerados',
      'decisoes','padroes','ofertas','conhecimentos','delegacoes'
    ]) as t(nome)
   where to_regclass('public.'||nome) is not null
     and not exists (
       select 1 from pg_policies
        where schemaname='public' and tablename = nome and policyname = 'equipe_total'
     );

  if sem_equipe > 0 then
    raise exception
      'MIGRACAO 041 INCOMPLETA: % tabela(s) ficaram sem equipe_total. Nada foi commitado.',
      sem_equipe;
  end if;

  raise notice '041 conferida: nenhuma equipe_autenticada restante, equipe_total em todas.';
end $$;

-- ============================================================
-- Conferência manual
-- ============================================================
-- select policyname, count(*) from pg_policies
--  where schemaname='public' group by policyname order by 2 desc;
-- Esperado: equipe_autenticada AUSENTE; equipe_total em 30 (as 29 + canais_marketplace).
--
-- O teste que vale mais que a contagem — simular o cliente e conferir que ele
-- NÃO escreve na AIL (rode dentro de begin/rollback):
--
--   begin;
--   select set_config('request.jwt.claims',
--     '{"sub":"<uid do perfil cliente>","role":"authenticated"}', true);
--   set local role authenticated;
--   with d as (update public.decisoes set contexto = contexto returning 1)
--   select (select count(*) from public.produtos) as le_produtos,
--          (select count(*) from d)               as escreve_na_ail;
--   reset role;
--   rollback;
--
-- Esperado: le_produtos = os do tenant dele; escreve_na_ail = 0.
