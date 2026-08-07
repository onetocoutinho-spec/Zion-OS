-- 054a — as funções novas ficam tão fechadas quanto as que elas espelham
--
-- ============================================================
-- COMO ISTO FOI ACHADO
-- ============================================================
--
-- Rodando o advisor de segurança do Supabase logo depois de aplicar a 054. Ele
-- apontou duas funções `security definer` executáveis por `anon` — as duas que
-- a 054 tinha acabado de criar.
--
-- Medido no `proacl` na mesma hora:
--
--     cliente_do_usuario   postgres | authenticated | service_role
--     eh_equipe            postgres | authenticated | service_role
--     agencia_do_usuario   postgres | authenticated | service_role | anon | PUBLIC
--     lojas_da_agencia     postgres | authenticated | service_role | anon | PUBLIC
--
-- ============================================================
-- O ERRO, E POR QUE ELE PASSOU
-- ============================================================
--
-- A 054 copiou a FORMA das duas funções existentes — `stable security definer`
-- com `search_path` fixo, que é a parte que evita recursão de RLS e sequestro
-- de schema. Mas permissão não está no corpo da função: vem de `grant`/`revoke`
-- aplicados depois, e o padrão do PostgreSQL para função nova é `PUBLIC`.
--
-- Copiar o que se lê no arquivo não copia o que foi feito fora dele.
--
-- ============================================================
-- NÃO HAVIA VAZAMENTO — E MESMO ASSIM FECHA
-- ============================================================
--
-- Sem sessão, `auth.uid()` é nulo: `agencia_do_usuario()` devolve NULL e
-- `lojas_da_agencia()` devolve conjunto vazio. Nenhum dado sai por ali.
--
-- O que havia era superfície: duas funções `security definer` publicadas em
-- `/rest/v1/rpc/` para quem não fez login, sem servir a ninguém. Superfície que
-- não serve a ninguém é superfície a menos que se deveria ter — e o dia em que
-- alguém mudar o corpo dessas funções, o alcance delas já estará certo.

revoke execute on function public.agencia_do_usuario() from public, anon;
revoke execute on function public.lojas_da_agencia()   from public, anon;

-- ============================================================
-- Conferência
-- ============================================================
--
--   select p.proname, array_to_string(p.proacl, ' | ')
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('eh_equipe','cliente_do_usuario',
--                        'agencia_do_usuario','lojas_da_agencia');
--
--   -- as QUATRO precisam ler igual: postgres | authenticated | service_role

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('054a', '054a-alinhar-permissoes-das-funcoes-de-agencia', now(),
        'REVOKE EXECUTE de PUBLIC e anon em agencia_do_usuario() e lojas_da_agencia(). Elas nasceram na 054 com o grant padrao do PostgreSQL (PUBLIC), enquanto cliente_do_usuario() e eh_equipe() so dao authenticated — a 054 copiou a forma das funcoes existentes, nao as permissoes, que vivem fora do corpo. Nao havia vazamento (sem sessao as duas devolvem NULL/vazio), mas eram funcoes security definer expostas em /rest/v1/rpc para anonimo. Achado pelo advisor de seguranca do Supabase minutos depois da 054. As quatro agora leem igual.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   grant execute on function public.agencia_do_usuario() to public, anon;
--   grant execute on function public.lojas_da_agencia()   to public, anon;
--
-- Só faz sentido para reproduzir o estado que o advisor reprovou.
-- ============================================================
