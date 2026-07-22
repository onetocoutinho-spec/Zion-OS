-- ============================================================
-- Zion OS — Diagnóstico de PRODUÇÃO (SOMENTE LEITURA) · PR-002
--
-- Rode no SQL Editor do Supabase de PRODUÇÃO (service_role — enxerga `auth`).
-- NENHUMA linha é alterada. Produz UMA grade (secao, item, valor) que é o
-- Snapshot Operacional (Fase 0) — cole o resultado em
-- docs/engineering/executions/<data>-pr002-security-snapshot.md.
--
-- Cobre: ambiente/versão · definição ATUAL de eh_equipe() (permissiva ou
-- deny-by-default?) · contagens de usuários/perfis/órfãos/inativos ·
-- organizações/clientes · estado de aplicação das migrações 015–023.
-- ============================================================

select * from (

-- ── Seção 0: ambiente ────────────────────────────────────────
select '0-ambiente' as secao, 'timestamp' as item, now()::text as valor
union all select '0-ambiente', 'database', current_database()
union all select '0-ambiente', 'postgres', version()

-- ── Seção 1: eh_equipe atual ─────────────────────────────────
union all
select '1-eh_equipe', 'deny_by_default_aplicado',
  case when pg_get_functiondef('public.eh_equipe()'::regprocedure) ilike '%false%'
       then 'SIM (016 §2 aplicada)' else 'NAO (permissiva da 005 — sem perfil = equipe)' end
union all
select '1-eh_equipe', 'definicao_completa',
  pg_get_functiondef('public.eh_equipe()'::regprocedure)

-- ── Seção 2: usuários e perfis ───────────────────────────────
union all select '2-perfis', 'auth_users_total', count(*)::text from auth.users
union all select '2-perfis', 'perfis_total', count(*)::text from public.perfis
union all select '2-perfis', 'perfis_equipe',
  count(*)::text from public.perfis where papel = 'equipe'
union all select '2-perfis', 'perfis_cliente',
  count(*)::text from public.perfis where papel = 'cliente'
union all select '2-perfis', 'perfis_inativos',
  coalesce((select count(*)::text from public.perfis where ativo = false), 'coluna ativo ausente')
union all select '2-perfis', 'usuarios_SEM_perfil (CRITICO se >0)',
  count(*)::text from auth.users u
  where not exists (select 1 from public.perfis p where p.id = u.id)
union all select '2-perfis', 'emails_sem_perfil',
  coalesce((select string_agg(u.email, ', ' order by u.email)
    from auth.users u
    where not exists (select 1 from public.perfis p where p.id = u.id)), '(nenhum)')

-- ── Seção 3: entidades de topo ───────────────────────────────
union all select '3-entidades', 'clientes', count(*)::text from public.clientes
union all select '3-entidades', 'organizacoes',
  case when to_regclass('public.organizacoes') is null then 'tabela ausente (017 nao aplicada)'
       else (select count(*)::text from public.organizacoes) end

-- ── Seção 4: migrações 015–023 aplicadas? ────────────────────
union all select '4-migracoes', '015 kit-componentes (produtos.componentes)',
  case when exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='produtos' and column_name='componentes')
    then 'APLICADA' else 'PENDENTE' end
union all select '4-migracoes', '016 §1 (perfis.ativo)',
  case when exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='perfis' and column_name='ativo')
    then 'APLICADA' else 'PENDENTE' end
union all select '4-migracoes', '016 §2-4 (deny-by-default)',
  case when pg_get_functiondef('public.eh_equipe()'::regprocedure) ilike '%false%'
       then 'APLICADA' else 'PENDENTE' end
union all select '4-migracoes', '017 organizacoes',
  case when to_regclass('public.organizacoes') is not null then 'APLICADA' else 'PENDENTE' end
union all select '4-migracoes', '018 origem_produto',
  case when to_regclass('public.origem_produto') is not null then 'APLICADA' else 'PENDENTE' end
union all select '4-migracoes', '019 catalogo',
  case when to_regclass('public.catalogo') is not null then 'APLICADA' else 'PENDENTE' end
union all select '4-migracoes', '020 produto_mestre',
  case when to_regclass('public.produto_mestre') is not null then 'APLICADA' else 'PENDENTE' end
union all select '4-migracoes', '021 produto_mestre_versao',
  case when to_regclass('public.produto_mestre_versao') is not null then 'APLICADA' else 'PENDENTE' end
union all select '4-migracoes', '022 decisoes (AIL Journal)',
  case when to_regclass('public.decisoes') is not null then 'APLICADA' else 'PENDENTE' end
union all select '4-migracoes', '023 padroes (AIL Detector)',
  case when to_regclass('public.padroes') is not null then 'APLICADA' else 'PENDENTE' end

) diagnostico
order by secao, item;
