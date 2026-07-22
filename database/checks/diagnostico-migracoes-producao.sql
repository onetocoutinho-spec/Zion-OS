-- ============================================================
-- Zion OS — Diagnóstico de PRODUÇÃO v2 (SOMENTE LEITURA) · PR-003
--
-- DETECTOR PERMANENTE DE DRIFT: compara o Migration Ledger (memória
-- operacional do banco — migração 024) com o ESTADO REAL dos objetos.
-- Rode no SQL Editor de produção. NENHUMA linha é alterada.
--
-- Responde, numa colada só (Definition of Done do PR-003):
--   · qual a última migração aplicada?          (seção 5)
--   · existem migrações pendentes?              (seção 5)
--   · existe drift?                             (seção 6)
--   · última alteração estrutural do banco?     (seção 5)
-- Também mantém o snapshot operacional (seções 0–3) usado nos runbooks.
--
-- Histórico: v1 (sem ledger) está no histórico git deste arquivo — foi a
-- base do baseline por evidência registrado na 024.
-- ============================================================

-- Guarda: este diagnóstico v2 EXIGE o ledger. Sem ele, falha com instrução.
do $$
begin
  if to_regclass('public.migracoes_aplicadas') is null then
    raise exception 'Migration Ledger ausente. Rode database/migrations/024-migration-ledger.sql antes deste diagnóstico (v2).';
  end if;
end $$;

select * from (

-- ── Seção 0: ambiente ────────────────────────────────────────
select '0-ambiente' as secao, 'timestamp' as item, now()::text as valor
union all select '0-ambiente', 'database', current_database()
union all select '0-ambiente', 'postgres', version()

-- ── Seção 1: segurança (invariante do PR-002) ────────────────
union all
select '1-seguranca', 'eh_equipe_deny_by_default',
  case when pg_get_functiondef('public.eh_equipe()'::regprocedure) ilike '%false%'
       then 'OK (016 vigente)' else 'REGRESSAO! permissiva novamente' end

-- ── Seção 2: usuários e perfis ───────────────────────────────
union all select '2-perfis', 'auth_users_total', count(*)::text from auth.users
union all select '2-perfis', 'perfis_total', count(*)::text from public.perfis
union all select '2-perfis', 'usuarios_SEM_perfil (CRITICO se >0)',
  count(*)::text from auth.users u
  where not exists (select 1 from public.perfis p where p.id = u.id)

-- ── Seção 3: entidades de topo ───────────────────────────────
union all select '3-entidades', 'clientes', count(*)::text from public.clientes

-- ── Seção 5: LEDGER — a memória operacional do banco (DoD) ───
union all select '5-ledger', 'ultima_migracao_aplicada',
  (select numero || ' — ' || nome from public.migracoes_aplicadas
    order by numero desc limit 1)
union all select '5-ledger', 'total_registradas',
  (select count(*)::text from public.migracoes_aplicadas)
union all select '5-ledger', 'ultima_alteracao_estrutural',
  (select max(aplicada_em)::text from public.migracoes_aplicadas)
union all select '5-ledger', 'migracoes_pendentes_conhecidas',
  coalesce((select string_agg(k.numero, ', ' order by k.numero)
    from (values ('001'),('002'),('003'),('004'),('005'),('006'),('007'),('008'),
                 ('009'),('010'),('011'),('012'),('013'),('014'),('015'),('016'),
                 ('017'),('018'),('019'),('020'),('021'),('022'),('023'),('024')
         ) as k(numero)
    where not exists (select 1 from public.migracoes_aplicadas m where m.numero = k.numero)),
    '(nenhuma)')

-- ── Seção 6: DRIFT — ledger × objetos reais (sondas 015–024) ─
-- OK = objeto existe E registrado · DRIFT = discordância · PENDENTE = nem um nem outro
union all select '6-drift', '015 produtos.componentes',
  case when exists (select 1 from information_schema.columns
         where table_schema='public' and table_name='produtos' and column_name='componentes')
       then case when exists (select 1 from public.migracoes_aplicadas where numero='015')
                 then 'OK' else 'DRIFT: aplicada SEM registro' end
       else case when exists (select 1 from public.migracoes_aplicadas where numero='015')
                 then 'DRIFT: registrada mas objeto AUSENTE' else 'PENDENTE' end end
union all select '6-drift', '016 deny-by-default',
  case when pg_get_functiondef('public.eh_equipe()'::regprocedure) ilike '%false%'
       then case when exists (select 1 from public.migracoes_aplicadas where numero='016')
                 then 'OK' else 'DRIFT: aplicada SEM registro' end
       else case when exists (select 1 from public.migracoes_aplicadas where numero='016')
                 then 'DRIFT: registrada mas objeto AUSENTE' else 'PENDENTE' end end
union all select '6-drift', '017 organizacoes',
  case when to_regclass('public.organizacoes') is not null
       then case when exists (select 1 from public.migracoes_aplicadas where numero='017')
                 then 'OK' else 'DRIFT: aplicada SEM registro' end
       else case when exists (select 1 from public.migracoes_aplicadas where numero='017')
                 then 'DRIFT: registrada mas objeto AUSENTE' else 'PENDENTE' end end
union all select '6-drift', '018 origem_produto',
  case when to_regclass('public.origem_produto') is not null
       then case when exists (select 1 from public.migracoes_aplicadas where numero='018')
                 then 'OK' else 'DRIFT: aplicada SEM registro' end
       else case when exists (select 1 from public.migracoes_aplicadas where numero='018')
                 then 'DRIFT: registrada mas objeto AUSENTE' else 'PENDENTE' end end
union all select '6-drift', '019 catalogo',
  case when to_regclass('public.catalogo') is not null
       then case when exists (select 1 from public.migracoes_aplicadas where numero='019')
                 then 'OK' else 'DRIFT: aplicada SEM registro' end
       else case when exists (select 1 from public.migracoes_aplicadas where numero='019')
                 then 'DRIFT: registrada mas objeto AUSENTE' else 'PENDENTE' end end
union all select '6-drift', '020 produto_mestre',
  case when to_regclass('public.produto_mestre') is not null
       then case when exists (select 1 from public.migracoes_aplicadas where numero='020')
                 then 'OK' else 'DRIFT: aplicada SEM registro' end
       else case when exists (select 1 from public.migracoes_aplicadas where numero='020')
                 then 'DRIFT: registrada mas objeto AUSENTE' else 'PENDENTE' end end
union all select '6-drift', '021 produto_mestre_versao',
  case when to_regclass('public.produto_mestre_versao') is not null
       then case when exists (select 1 from public.migracoes_aplicadas where numero='021')
                 then 'OK' else 'DRIFT: aplicada SEM registro' end
       else case when exists (select 1 from public.migracoes_aplicadas where numero='021')
                 then 'DRIFT: registrada mas objeto AUSENTE' else 'PENDENTE' end end
union all select '6-drift', '022 decisoes',
  case when to_regclass('public.decisoes') is not null
       then case when exists (select 1 from public.migracoes_aplicadas where numero='022')
                 then 'OK' else 'DRIFT: aplicada SEM registro' end
       else case when exists (select 1 from public.migracoes_aplicadas where numero='022')
                 then 'DRIFT: registrada mas objeto AUSENTE' else 'PENDENTE' end end
union all select '6-drift', '023 padroes',
  case when to_regclass('public.padroes') is not null
       then case when exists (select 1 from public.migracoes_aplicadas where numero='023')
                 then 'OK' else 'DRIFT: aplicada SEM registro' end
       else case when exists (select 1 from public.migracoes_aplicadas where numero='023')
                 then 'DRIFT: registrada mas objeto AUSENTE' else 'PENDENTE' end end
union all select '6-drift', '024 migracoes_aplicadas',
  case when exists (select 1 from public.migracoes_aplicadas where numero='024')
       then 'OK' else 'DRIFT: ledger existe mas 024 nao se registrou' end

) diagnostico
order by secao, item;
