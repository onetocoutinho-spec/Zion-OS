-- ============================================================
-- Zion OS — STAGING (SQL EDITOR) · 07 · Migração de segurança 016 (ISOLADA)
-- ============================================================
-- ⚠️ RODE SOMENTE no projeto Supabase **zion-os-staging**. NUNCA em produção.
--    Confirme o nome do projeto no topo do painel do Supabase ANTES de rodar.
-- Deny-by-default + perfis.ativo. Rode SO apos os perfis existirem.
-- Consolidado a partir dos arquivos REAIS do repositório (sem \ir, sem seed,
-- sem 001b, sem dados de demonstração). A lógica das migrações é preservada.
-- ============================================================

-- [guardrail de staging] aborta se o banco não estiver marcado como staging
-- (o marcador é criado por 01-base-schema.sql). Não é destrutivo.
do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='environment_metadata')
     or not exists (select 1 from public.environment_metadata where environment='staging') then
    raise exception 'GUARDRAIL: ambiente nao confirmado como staging. Rode 01-base-schema.sql no zion-os-staging antes deste arquivo.';
  end if;
end $$;

-- ------------------------------------------------------------
-- Fonte: database/migrations/016-fix-multitenancy-security.sql
-- ------------------------------------------------------------
-- ============================================================
-- Zion OS — Migração 016: Correção de segurança multiempresa (R1)
--
-- INCREMENTAL, IDEMPOTENTE e REVERSÍVEL. NÃO destrói dados.
-- Rode UMA vez no SQL Editor, DEPOIS da 015.
--
-- O QUE MUDA (e por quê):
--   Hoje eh_equipe() usa coalesce(..., TRUE): "usuário sem perfil = equipe"
--   (acesso total). Qualquer autenticado sem linha em `perfis` enxerga TODOS
--   os clientes. Esta migração inverte para NEGAR POR PADRÃO:
--     * sem perfil            -> sem acesso
--     * perfil inativo        -> sem acesso
--     * papel='equipe' ativo  -> acesso de equipe
--     * papel='cliente' ativo -> acesso só à própria empresa
--
-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ ⚠️  PRÉ-REQUISITO OBRIGATÓRIO — LEIA ANTES DE RODAR                      │
-- │                                                                          │
-- │ Como o comportamento antigo era "sem perfil = equipe", os usuários da   │
-- │ EQUIPE atual podem NÃO ter linha em `perfis`. Se você rodar esta        │
-- │ migração ANTES de cadastrar os perfis, a equipe perde acesso.           │
-- │                                                                          │
-- │ ORDEM CORRETA (ver docs/implementation-phase-1-security):               │
-- │  1) Rode  database/checks/check-users-without-profile.sql  (diagnóstico)│
-- │  2) Cadastre TODOS os perfis (equipe e clientes) usando                  │
-- │     database/checks/fix-missing-profiles-template.sql                    │
-- │  3) Confirme que não há usuário-equipe sem perfil                        │
-- │  4) SÓ ENTÃO rode esta migração 016                                      │
-- │                                                                          │
-- │ NÃO rode em produção automaticamente. Valide primeiro em staging.        │
-- └────────────────────────────────────────────────────────────────────────┘
-- ============================================================

-- ------------------------------------------------------------
-- 1) Coluna `ativo` em perfis (aditiva). Default TRUE: os perfis
--    já cadastrados continuam ativos — não quebra ninguém.
-- ------------------------------------------------------------
alter table public.perfis
  add column if not exists ativo boolean not null default true;

-- ------------------------------------------------------------
-- 2) eh_equipe(): NEGA POR PADRÃO.
--    Só é equipe quem tem perfil papel='equipe' E ativo=true.
--    coalesce(..., FALSE) garante que a AUSÊNCIA de perfil = sem acesso.
--    (SECURITY DEFINER + search_path fixo mantidos, como no original.)
-- ------------------------------------------------------------
create or replace function public.eh_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.papel = 'equipe' and coalesce(p.ativo, true)
       from public.perfis p
      where p.id = auth.uid()),
    false  -- sem perfil = SEM ACESSO (antes era true = equipe)
  );
$$;

-- ------------------------------------------------------------
-- 3) cliente_do_usuario(): só devolve o cliente de um perfil
--    papel='cliente' E ativo. Perfil inativo -> NULL -> sem dados
--    (as políticas comparam cliente_id = NULL, que nunca casa).
-- ------------------------------------------------------------
create or replace function public.cliente_do_usuario()
returns uuid language sql stable security definer set search_path = public as $$
  select p.cliente_id from public.perfis p
  where p.id = auth.uid()
    and p.papel = 'cliente'
    and coalesce(p.ativo, true);
$$;

-- ------------------------------------------------------------
-- 4) Revisão das políticas RLS que dependem dessas funções.
--    NENHUMA política precisa ser reescrita: todas já referenciam
--    eh_equipe() / cliente_do_usuario() (migrações 005, 006, 009, 012, 014),
--    então herdam automaticamente o novo comportamento "negar por padrão".
--    Aqui apenas RE-ASSEGURAMOS que o RLS está LIGADO nas tabelas sensíveis
--    (idempotente; se já estava on, não faz nada).
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'clientes','onboardings','onboarding_items','produtos','anuncios','agentes',
    'tarefas','relatorios','financeiro','execucoes_agentes','reunioes','pendencias',
    'produto_variantes','produto_atributos','categoria_templates','anuncio_variantes',
    'precificacao_variantes','imagens_produto','importacoes_anuncios','auditorias_anuncios',
    'problemas_anuncio','fila_otimizacao','execucoes_lote','anuncios_gerados',
    'perfis','canais_marketplace','fila_otimizacao_produto','tabelas_medidas'
  ]
  loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- VERIFICAÇÃO (rode manualmente após aplicar; não altera dados):
--   -- deve retornar as definições novas:
--   select pg_get_functiondef('public.eh_equipe()'::regprocedure);
--   select pg_get_functiondef('public.cliente_do_usuario()'::regprocedure);
--   -- deve existir a coluna ativo:
--   select column_name from information_schema.columns
--     where table_schema='public' and table_name='perfis' and column_name='ativo';
--
-- REVERTER (volta ao comportamento anterior "sem perfil = equipe"):
--   create or replace function public.eh_equipe()
--   returns boolean language sql stable security definer set search_path = public as $$
--     select coalesce(
--       (select p.papel = 'equipe' from public.perfis p where p.id = auth.uid()),
--       true
--     );
--   $$;
--   create or replace function public.cliente_do_usuario()
--   returns uuid language sql stable security definer set search_path = public as $$
--     select p.cliente_id from public.perfis p
--     where p.id = auth.uid() and p.papel = 'cliente';
--   $$;
--   -- A coluna perfis.ativo pode PERMANECER (é inofensiva). Se quiser remover:
--   --   alter table public.perfis drop column if exists ativo;
-- ============================================================
