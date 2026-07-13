-- ============================================================
-- Zion OS — STAGING · 00 · PREFLIGHT (SOMENTE LEITURA)
--
-- Rode ANTES de qualquer coisa, no SQL Editor do projeto de STAGING.
-- NÃO altera dados. Serve para (a) confirmar que você está no banco certo e
-- (b) checar o guardrail de ambiente.
--
-- ⚠️ Se qualquer bloco indicar dado comercial real / conexão de marketplace
-- real / que este é o banco de PRODUÇÃO, PARE. Não rode os demais scripts.
-- ============================================================

-- 1) Identificação do banco (confira que NÃO é produção)
select current_database()              as banco,
       current_user                    as usuario,
       inet_server_addr()              as host_ip,
       version()                       as versao;

-- 2) Guardrail de ambiente: existe a marca 'staging'?
--    (a tabela environment_metadata é criada no bootstrap — 01-bootstrap-schema.sql)
select case
         when exists (
           select 1 from information_schema.tables
            where table_schema = 'public' and table_name = 'environment_metadata'
         ) and exists (
           select 1 from public.environment_metadata where environment = 'staging'
         )
         then 'OK — ambiente marcado como STAGING'
         else '⚠️ SEM marca de staging (environment_metadata). NÃO rode scripts de escrita.'
       end as guardrail;

-- 3) A migração 016 já foi aplicada aqui? (coluna perfis.ativo existe?)
select case
         when exists (
           select 1 from information_schema.columns
            where table_schema='public' and table_name='perfis' and column_name='ativo'
         ) then 'perfis.ativo EXISTE (016 provavelmente já aplicada)'
         else 'perfis.ativo NÃO existe (016 ainda não aplicada)'
       end as status_016;

-- 4) Contagens (sanitizadas — só números)
select
  (select count(*) from auth.users)                             as usuarios_auth,
  (select count(*) from public.perfis)                          as perfis,
  (select count(*) from public.perfis where papel='equipe')     as perfis_equipe,
  (select count(*) from public.perfis where papel='cliente')    as perfis_cliente,
  (select count(*) from public.clientes)                        as clientes,
  (select count(*) from public.produtos)                        as produtos;

-- 5) Canais de marketplace: NÃO exibir tokens — só a contagem + alerta
select count(*) as canais_marketplace,
       case when count(*) > 0
            then '⚠️ Há canais conectados. Em staging isso deve ser só conta de TESTE. Confirme antes de prosseguir.'
            else 'Nenhum canal conectado (esperado em staging novo).'
       end as alerta_canais
from public.canais_marketplace;

-- 6) Sinal de SEED DE DEMONSTRAÇÃO (7 clientes fictícios: id c1000000-...)
--    Não deve existir nem em staging "limpo" nem em produção.
select count(*) as clientes_demo_seed
from public.clientes
where id::text like 'c1000000-%';

-- 7) Migrações aplicadas — heurística por presença de objetos-chave
select
  to_regclass('public.produto_variantes')      is not null as m001_ok,
  to_regclass('public.auditorias_anuncios')     is not null as m002_ok,
  to_regclass('public.anuncios_gerados')        is not null as m004_ok,
  to_regprocedure('public.eh_equipe()')         is not null as m005_ok,
  to_regclass('public.canais_marketplace')      is not null as m009_ok,
  to_regclass('public.fila_otimizacao_produto') is not null as m012_ok,
  to_regclass('public.tabelas_medidas')         is not null as m014_ok;
