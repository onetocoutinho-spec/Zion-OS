-- ============================================================
-- Zion OS — STAGING · 04 · CONSULTAS DE VALIDAÇÃO (SOMENTE LEITURA)
--
-- Rode APÓS a 016 + o seed de teste. Confirma o estado do banco.
-- Os testes de acesso de verdade (401/403, isolamento A×B) são via HTTP —
-- ver docs/staging-setup/08-VALIDACAO-ETAPA-1.md. Aqui é o lado do banco.
-- Não altera dados.
-- ============================================================

-- 1) A 016 aplicou o "negar por padrão"? (definições atuais das funções)
select 'eh_equipe' as funcao, pg_get_functiondef('public.eh_equipe()'::regprocedure) as definicao
union all
select 'cliente_do_usuario', pg_get_functiondef('public.cliente_do_usuario()'::regprocedure);
-- Esperado: eh_equipe com coalesce(..., false) e checando ativo;
--           cliente_do_usuario exigindo papel='cliente' AND ativo.

-- 2) Coluna perfis.ativo existe e default?
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema='public' and table_name='perfis' and column_name='ativo';

-- 3) Perfis de teste (sanitizado — sem UUID completo)
select left(id::text, 8) || '…' as user_ref, papel, cliente_id, nome,
       coalesce(to_jsonb(p) ->> 'ativo', 'n/d') as ativo
from public.perfis p
where nome like '[TESTE]%'
order by papel, nome;

-- 4) Empresas e produtos de teste
select left(id::text,8) || '…' as cliente_ref, empresa from public.clientes where empresa like '[TESTE STAGING]%';
select left(cliente_id::text,8) || '…' as cliente_ref, nome, sku from public.produtos where observacoes = 'TESTE STAGING';

-- 5) RLS habilitado nas tabelas sensíveis?
select relname as tabela, relrowsecurity as rls_on
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('produtos','produto_variantes','anuncios_gerados','canais_marketplace',
                  'perfis','fila_otimizacao_produto','tabelas_medidas','auditorias_anuncios')
order by relname;

-- 6) Nenhum usuário de equipe sem perfil? (deve retornar 0)
select count(*) as equipe_potencialmente_sem_perfil
from auth.users u
left join public.perfis p on p.id = u.id
where p.id is null;

-- 7) Canais: contagem apenas (nunca exibir refresh_token)
select count(*) as canais, count(*) filter (where ativo) as canais_ativos
from public.canais_marketplace;
