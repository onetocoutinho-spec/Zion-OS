-- ============================================================
-- Zion OS — Template de correção ASSISTIDA de perfis
--
-- ⚠️ NÃO EXECUTE ESTE ARQUIVO COMO ESTÁ. Ele contém PLACEHOLDERS.
-- Preencha os valores reais (obtidos no check-users-without-profile.sql) e
-- rode APENAS as linhas que você revisou, UMA A UMA, em staging primeiro.
--
-- Regra de ouro: NÃO adivinhe quem é equipe e quem é cliente. Confirme com
-- a Zion antes de cadastrar cada usuário. Um erro aqui = acesso indevido.
--
-- Ordem recomendada:
--   1) Cadastrar TODOS os perfis de EQUIPE (senão a equipe perde acesso na 016).
--   2) Cadastrar/normalizar os perfis de CLIENTE (cada um com seu cliente_id).
--   3) Rodar novamente o check para confirmar que não sobrou ninguém.
--   4) SÓ ENTÃO aplicar a migração 016.
-- ============================================================

-- ------------------------------------------------------------
-- Como obter os IDs:
--   Usuários (auth):   select id, email from auth.users order by created_at;
--   Empresas:          select id, empresa from public.clientes order by empresa;
-- ------------------------------------------------------------

-- (A) PERFIL DE EQUIPE  (papel='equipe', SEM cliente_id)
-- Repita um insert por membro da equipe. Idempotente: se o perfil já existe,
-- o ON CONFLICT apenas garante papel='equipe' e ativo=true (não duplica).
--
-- insert into public.perfis (id, cliente_id, papel, nome, ativo)
-- values ('<USER_UID_DA_EQUIPE>', null, 'equipe', '<Nome da pessoa>', true)
-- on conflict (id) do update
--   set papel = 'equipe', ativo = true, nome = excluded.nome;

-- (B) PERFIL DE CLIENTE  (papel='cliente', COM cliente_id da empresa)
-- Um insert por usuário-cliente. cliente_id = id da empresa em public.clientes.
--
-- insert into public.perfis (id, cliente_id, papel, nome, ativo)
-- values ('<USER_UID_DO_CLIENTE>', '<CLIENTE_ID_DA_EMPRESA>', 'cliente', '<Nome do cliente>', true)
-- on conflict (id) do update
--   set papel = 'cliente', cliente_id = excluded.cliente_id, ativo = true, nome = excluded.nome;

-- (C) DESATIVAR um usuário (bloquear acesso sem apagar o perfil)
--   update public.perfis set ativo = false where id = '<USER_UID>';

-- (D) CORRIGIR papel inválido (bloco 3 do check) — escolha o papel certo:
--   update public.perfis set papel = 'equipe' where id = '<USER_UID>';
--   -- ou
--   update public.perfis set papel = 'cliente', cliente_id = '<CLIENTE_ID>' where id = '<USER_UID>';

-- ------------------------------------------------------------
-- Conferência final (deve retornar 0 linhas antes de aplicar a 016):
--   select u.id, u.email
--   from auth.users u
--   left join public.perfis p on p.id = u.id
--   where p.id is null;
-- ------------------------------------------------------------
--
-- OBS: a coluna `ativo` só existe DEPOIS da migração 016. Se precisar cadastrar
-- perfis ANTES da 016, remova `ativo` dos inserts acima (o default assumido é
-- ativo); a 016 adiciona a coluna com default true, mantendo todos ativos.
-- ============================================================
