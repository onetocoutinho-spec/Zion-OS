-- ============================================================
-- Zion OS — Migração 024: Migration Ledger (PR-003)
--
-- INCREMENTAL, IDEMPOTENTE e REVERSÍVEL. Rode UMA vez no SQL Editor.
--
-- O BANCO PASSA A SABER O QUE RECEBEU: esta tabela é a MEMÓRIA OPERACIONAL
-- do banco (princípio da Zion: todo componente importante possui memória
-- própria — a AIL tem a sua; agora o banco também).
--
-- ★ NOVA CONVENÇÃO DO PROGRAMA (vale de 024 em diante):
--   toda migração DEVE terminar com o próprio INSERT em migracoes_aplicadas.
--   Migrações anteriores são DOCUMENTOS HISTÓRICOS — não são alteradas
--   retroativamente; o estado delas entra pelo baseline abaixo, registrado
--   EXCLUSIVAMENTE por evidência (diagnóstico de 2026-07-22 + operação
--   comprovada do sistema), nunca por suposição.
-- ============================================================

create table if not exists public.migracoes_aplicadas (
  numero text primary key,                      -- '001', '015', '024'…
  nome text not null,                           -- nome do arquivo (sem .sql)
  aplicada_em timestamptz not null default now(),
  observacao text
);

alter table public.migracoes_aplicadas enable row level security;

-- Leitura para a equipe autenticada; escrita só via SQL Editor (service_role
-- bypassa RLS). Nenhum código do app escreve aqui.
drop policy if exists "equipe_le" on public.migracoes_aplicadas;
create policy "equipe_le" on public.migracoes_aplicadas
  for select to authenticated using (public.eh_equipe());

-- ------------------------------------------------------------
-- BASELINE POR EVIDÊNCIA (2026-07-22) — idempotente (on conflict do nothing).
--
-- 001–014: aplicação INFERIDA por evidência funcional (o sistema opera sobre
--   esses objetos em produção; o diagnóstico provou a 015, que as pressupõe).
--   Data real de aplicação desconhecida → aplicada_em = data do registro.
-- 001b (seed de demonstração): NÃO registrada — aplicação em produção não
--   comprovada; o seed de demo foi removido de produção (documento histórico).
-- 015, 022, 023: comprovadas pelo diagnóstico (objetos presentes).
-- 016: comprovada e DATADA — §1 em 2026-07-17 (hotfix), §2–4 em 2026-07-22
--   (operação PR-002, com snapshot e relatório em docs/engineering/executions/).
-- 017–021: NÃO aplicadas (comprovado pelo diagnóstico) → SEM linha no ledger.
-- ------------------------------------------------------------
insert into public.migracoes_aplicadas (numero, nome, observacao) values
  ('001','001-modelagem-produtos-marketplace','baseline 2026-07-22: inferida por evidência funcional; data real desconhecida'),
  ('002','002-auditoria-em-massa','baseline 2026-07-22: inferida por evidência funcional'),
  ('003','003-modelo-marketplace-real','baseline 2026-07-22: inferida por evidência funcional'),
  ('004','004-anuncios-gerados','baseline 2026-07-22: inferida por evidência funcional'),
  ('005','005-portal-cliente','baseline 2026-07-22: inferida por evidência funcional'),
  ('006','006-self-service-cliente','baseline 2026-07-22: inferida por evidência funcional'),
  ('007','007-self-service-fase2','baseline 2026-07-22: inferida por evidência funcional'),
  ('008','008-portal-cliente-leituras','baseline 2026-07-22: inferida por evidência funcional'),
  ('009','009-marketplace-ml','baseline 2026-07-22: inferida por evidência funcional'),
  ('010','010-imagens-storage','baseline 2026-07-22: inferida por evidência funcional'),
  ('011','011-canal-cliente-conecta','baseline 2026-07-22: inferida por evidência funcional'),
  ('012','012-fila-otimizacao-produto','baseline 2026-07-22: inferida por evidência funcional'),
  ('013','013-tabela-medidas-produto','baseline 2026-07-22: inferida por evidência funcional'),
  ('014','014-tabelas-medidas-cliente','baseline 2026-07-22: inferida por evidência funcional'),
  ('015','015-kit-componentes','baseline 2026-07-22: comprovada pelo diagnóstico (produtos.componentes presente)'),
  ('016','016-fix-multitenancy-security','§1 em 2026-07-17 (hotfix perfis.ativo); §2–4 em 2026-07-22 — operação PR-002 (snapshot+relatório em docs/engineering/executions/)'),
  ('022','022-decision-journal','aplicada 2026-07-22 (release R-DJ-3; comprovada pelo diagnóstico)'),
  ('023','023-pattern-detector','aplicada 2026-07-22 (release R-PD-1; comprovada pelo diagnóstico)')
on conflict (numero) do nothing;

-- ------------------------------------------------------------
-- VERIFICAÇÃO (somente leitura):
--   select count(*) as registradas from public.migracoes_aplicadas;   -- esperado: 19 (18 baseline + a 024)
--   select numero, nome, aplicada_em from public.migracoes_aplicadas
--    order by numero desc limit 5;
--
-- REVERTER (zero impacto no app — nenhum código lê esta tabela):
--   drop table if exists public.migracoes_aplicadas;
-- ------------------------------------------------------------

-- ★ Auto-registro (a convenção em ação — primeira migração a se registrar):
insert into public.migracoes_aplicadas (numero, nome, observacao)
values ('024','024-migration-ledger','cria o ledger; baseline por evidência do diagnóstico 2026-07-22')
on conflict (numero) do nothing;
