-- ============================================================
-- Zion OS — STAGING · 05 · LIMPEZA DOS DADOS DE TESTE
--
-- Remove SOMENTE os dados de teste criados pelo 03-seed (marcados com
-- "[TESTE STAGING]"/"[TESTE]"). Só roda em banco marcado como staging.
--
-- ⚠️ NÃO remove usuários do Auth (auth.users) — apague-os pelo painel
-- Authentication se quiser. Aqui só limpamos o schema public.
-- ============================================================

-- GUARDRAIL: só roda em staging.
do $$
begin
  if not exists (select 1 from public.environment_metadata where environment='staging') then
    raise exception 'GUARDRAIL: ambiente NAO e staging. Abortando limpeza.';
  end if;
end $$;

-- 1) Perfis de teste (não apaga o usuário do Auth, só o vínculo/perfil)
delete from public.perfis where nome like '[TESTE]%';

-- 2) Empresas de teste — cascata apaga produtos/variações/anúncios/canais/perfis
--    ligados (todas as FKs para clientes são on delete cascade).
delete from public.clientes where empresa like '[TESTE STAGING]%';

-- 3) Conferência (devem retornar 0)
select
  (select count(*) from public.clientes where empresa like '[TESTE STAGING]%') as clientes_teste,
  (select count(*) from public.produtos where observacoes = 'TESTE STAGING')    as produtos_teste,
  (select count(*) from public.perfis   where nome like '[TESTE]%')             as perfis_teste;

-- OBS: para zerar TAMBÉM o marcador de ambiente (raro), rode manualmente:
--   -- delete from public.environment_metadata where environment='staging';
