-- ============================================================
-- Zion OS — Diagnóstico de perfis (SOMENTE LEITURA)
--
-- Rode ANTES da migração 016 no SQL Editor do Supabase (que roda como
-- service_role e enxerga o schema `auth`). NENHUMA linha é alterada.
--
-- Objetivo: garantir que, ao inverter para "sem perfil = sem acesso",
-- nenhum usuário legítimo (equipe ou cliente) fique sem perfil.
--
-- Interprete cada bloco pelo cabeçalho. O que precisa de ação vira insert
-- no template database/checks/fix-missing-profiles-template.sql.
-- ============================================================

-- 1) USUÁRIOS DO AUTH SEM PERFIL  (⚠️ estes perdem acesso após a 016)
--    Decida um a um: são equipe? são cliente? -> cadastre no template.
select u.id as user_id, u.email, u.created_at
from auth.users u
left join public.perfis p on p.id = u.id
where p.id is null
order by u.created_at;

-- 2) PERFIS DE CLIENTE SEM cliente_id  (papel='cliente' porém sem empresa)
--    Sem cliente_id, cliente_do_usuario() devolve NULL -> não vê nada.
select p.id as user_id, p.papel, p.cliente_id, p.nome
from public.perfis p
where p.papel = 'cliente' and p.cliente_id is null;

-- 3) PERFIS COM PAPEL INVÁLIDO  (diferente de 'equipe' / 'cliente')
select p.id as user_id, p.papel, p.cliente_id, p.nome
from public.perfis p
where p.papel is null or p.papel not in ('equipe','cliente');

-- 4) PERFIS "DUPLICADOS" / ANÔMALOS
--    (id é PK, então não há duplicidade por usuário; este bloco detecta
--     mais de um perfil de CLIENTE apontando para a MESMA empresa — pode ser
--     esperado, mas confirme se algum é indevido.)
select p.cliente_id, count(*) as qtd_usuarios_cliente
from public.perfis p
where p.papel = 'cliente' and p.cliente_id is not null
group by p.cliente_id
having count(*) > 1
order by qtd_usuarios_cliente desc;

-- 5) USUÁRIOS DE EQUIPE EXISTENTES  (confirme que a equipe atual está aqui)
select p.id as user_id, coalesce(p.nome,'') as nome,
       -- coluna `ativo` existe só após a 016; use o COALESCE p/ rodar antes/depois
       coalesce(to_jsonb(p) ->> 'ativo', 'n/d (rode após 016)') as ativo
from public.perfis p
where p.papel = 'equipe'
order by nome;

-- 6) CLIENTES (EMPRESAS) SEM NENHUM USUÁRIO CLIENTE VINCULADO
--    Empresa cadastrada mas sem login de cliente. Não bloqueia a 016,
--    mas indica clientes que ainda não conseguem acessar o portal.
select c.id as cliente_id, c.empresa
from public.clientes c
left join public.perfis p
       on p.cliente_id = c.id and p.papel = 'cliente'
where p.id is null
order by c.empresa;

-- 7) REGISTROS POTENCIALMENTE ÓRFÃOS
-- 7a) Perfis cujo cliente_id não existe mais em `clientes`
select p.id as user_id, p.cliente_id, p.papel
from public.perfis p
where p.cliente_id is not null
  and not exists (select 1 from public.clientes c where c.id = p.cliente_id);

-- 7b) Perfis cujo usuário não existe mais em auth.users
select p.id as user_id, p.papel, p.cliente_id
from public.perfis p
where not exists (select 1 from auth.users u where u.id = p.id);

-- ============================================================
-- RESUMO NUMÉRICO (visão rápida)
-- ============================================================
select
  (select count(*) from auth.users)                                        as usuarios_auth,
  (select count(*) from public.perfis)                                     as perfis,
  (select count(*) from auth.users u
     left join public.perfis p on p.id = u.id where p.id is null)          as auth_sem_perfil,
  (select count(*) from public.perfis where papel = 'equipe')             as perfis_equipe,
  (select count(*) from public.perfis where papel = 'cliente')            as perfis_cliente,
  (select count(*) from public.perfis
     where papel = 'cliente' and cliente_id is null)                       as cliente_sem_empresa;
