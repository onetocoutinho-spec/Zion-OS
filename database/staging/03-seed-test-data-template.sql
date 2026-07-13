-- ============================================================
-- Zion OS — STAGING · 03 · DADOS DE TESTE (TEMPLATE — placeholders)
--
-- ⚠️ NÃO execute como está. Substitua os <PLACEHOLDERS> pelos UUIDs reais dos
-- usuários que você criar no Supabase Auth (painel Authentication → Add user,
-- ou Admin API). NUNCA insira linhas em auth.users por SQL — crie os usuários
-- pelo Auth e use aqui apenas os UUIDs.
--
-- Cria: Empresa A + Cliente A + Produto A · Empresa B + Cliente B + Produto B ·
--       perfil de equipe · perfil inativo · (o usuário "sem perfil" é só um
--       auth.user SEM linha em perfis — não cadastre aqui).
--
-- Ordem: rode DEPOIS de 01-bootstrap (001–015) e da criação dos usuários no
-- Auth. A coluna perfis.ativo só existe após a 016 — por isso os perfis são
-- inseridos SEM `ativo`; o usuário inativo vira ativo=false num UPDATE após a 016.
-- ============================================================

-- GUARDRAIL: só roda em banco marcado como staging.
do $$
begin
  if not exists (select 1 from public.environment_metadata where environment='staging') then
    raise exception 'GUARDRAIL: ambiente NAO e staging. Abortando seed de teste.';
  end if;
end $$;

-- IDs FIXOS das empresas de teste (fáceis de limpar depois; prefixo a0..teste).
--   Empresa A: a0000000-0000-4000-8000-0000000000a1
--   Empresa B: a0000000-0000-4000-8000-0000000000b1

-- 1) Empresas de teste (marcador no nome para limpeza)
insert into public.clientes (id, empresa, segmento, status)
values
  ('a0000000-0000-4000-8000-0000000000a1', '[TESTE STAGING] Empresa A', 'Calçados', 'Ativo'),
  ('a0000000-0000-4000-8000-0000000000b1', '[TESTE STAGING] Empresa B', 'Calçados', 'Ativo')
on conflict (id) do nothing;

-- 2) Produtos de teste (um por empresa)
insert into public.produtos (cliente_id, nome, marca, sku, observacoes)
values
  ('a0000000-0000-4000-8000-0000000000a1', '[TESTE STAGING] Produto A', 'MarcaTeste', 'STG-A-001', 'TESTE STAGING'),
  ('a0000000-0000-4000-8000-0000000000b1', '[TESTE STAGING] Produto B', 'MarcaTeste', 'STG-B-001', 'TESTE STAGING')
on conflict do nothing;

-- 3) Perfis (SEM `ativo` — a coluna só existe após a 016).
--    Substitua os UUIDs pelos usuários criados no Auth.
insert into public.perfis (id, cliente_id, papel, nome) values
  ('<TEAM_USER_UUID>',     null,                                   'equipe',  '[TESTE] Equipe')
on conflict (id) do update set papel='equipe', cliente_id=null, nome=excluded.nome;

insert into public.perfis (id, cliente_id, papel, nome) values
  ('<USER_A_UUID>', 'a0000000-0000-4000-8000-0000000000a1', 'cliente', '[TESTE] Cliente A')
on conflict (id) do update set papel='cliente', cliente_id=excluded.cliente_id, nome=excluded.nome;

insert into public.perfis (id, cliente_id, papel, nome) values
  ('<USER_B_UUID>', 'a0000000-0000-4000-8000-0000000000b1', 'cliente', '[TESTE] Cliente B')
on conflict (id) do update set papel='cliente', cliente_id=excluded.cliente_id, nome=excluded.nome;

insert into public.perfis (id, cliente_id, papel, nome) values
  ('<INACTIVE_USER_UUID>', 'a0000000-0000-4000-8000-0000000000a1', 'cliente', '[TESTE] Cliente Inativo')
on conflict (id) do update set papel='cliente', cliente_id=excluded.cliente_id, nome=excluded.nome;

-- O usuário "SEM PERFIL": crie no Auth e NÃO insira em perfis. Ele deve receber
-- 403 / tela "Acesso não liberado" após a 016.

-- 4) APÓS APLICAR A 016 (02-apply-security-016.sql), marque o inativo:
--   update public.perfis set ativo = false where id = '<INACTIVE_USER_UUID>';
