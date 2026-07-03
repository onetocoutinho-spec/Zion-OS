-- ============================================================
-- Zion OS v1.3 — Realtime
--
-- Adiciona as tabelas à publication do Supabase Realtime para
-- que as telas abertas atualizem automaticamente quando outra
-- pessoa da equipe criar/editar/excluir registros.
--
-- Rode UMA vez no SQL Editor, depois do supabase-schema.sql.
-- (Se rodar duas vezes, o Postgres acusa que a tabela já está
-- na publication — é inofensivo.)
-- ============================================================

alter publication supabase_realtime add table
  public.clientes,
  public.onboardings,
  public.onboarding_items,
  public.produtos,
  public.anuncios,
  public.agentes,
  public.tarefas,
  public.relatorios,
  public.financeiro,
  public.execucoes_agentes,
  public.reunioes,
  public.pendencias;
