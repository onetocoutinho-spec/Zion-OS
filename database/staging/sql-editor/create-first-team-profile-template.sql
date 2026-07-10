-- ============================================================
-- Zion OS — STAGING (SQL EDITOR) · Criar o PRIMEIRO perfil de EQUIPE
--
-- ⚠️ RODE SOMENTE no projeto zion-os-staging. NUNCA em produção.
-- ⚠️ TEMPLATE: substitua TODAS as ocorrências de <STAGING_TEAM_USER_UUID>
--    pelo UUID do usuário criado no Supabase Auth (Authentication → Users →
--    Add user → copie o User UID). SEM substituir, o script ABORTA.
--
-- Cria o perfil de EQUIPE conforme o schema REAL de `perfis` que existe ANTES
-- da migração 016 (id, cliente_id, papel, nome) — SEM a coluna `ativo` (ela só
-- é criada pela 016). É idempotente (on conflict por id).
--
-- Por que isto é necessário: a 016 passa a NEGAR acesso a quem não tem perfil.
-- A equipe precisa ter perfil ANTES da 016, senão perde acesso.
-- ============================================================

-- [guardrail de staging] aborta se o banco não estiver marcado como staging.
do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='environment_metadata')
     or not exists (select 1 from public.environment_metadata where environment='staging') then
    raise exception 'GUARDRAIL: ambiente nao confirmado como staging. Rode 01-base-schema.sql no zion-os-staging antes.';
  end if;
end $$;

-- [guardrail de placeholder] aborta enquanto o UUID não for substituído.
-- Quando ainda há '<' no valor, é porque o placeholder não foi trocado.
do $$
begin
  if position('<' in '<STAGING_TEAM_USER_UUID>') > 0 then
    raise exception 'Substitua TODAS as ocorrencias de <STAGING_TEAM_USER_UUID> pelo UUID real (Auth) antes de rodar.';
  end if;
end $$;

-- Cria/atualiza o perfil de EQUIPE (sem `ativo` — coluna nasce na 016).
insert into public.perfis (id, cliente_id, papel, nome)
values ('<STAGING_TEAM_USER_UUID>'::uuid, null, 'equipe', 'Equipe (staging)')
on conflict (id) do update
  set papel = 'equipe', cliente_id = null, nome = excluded.nome;

-- Conferência (opcional): deve listar o perfil de equipe recém-criado.
-- select left(id::text,8) || '…' as user_ref, papel, cliente_id, nome
-- from public.perfis where papel = 'equipe';
