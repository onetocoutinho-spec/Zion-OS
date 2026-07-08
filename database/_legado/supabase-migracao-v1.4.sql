-- ============================================================
-- Zion OS v1.4 — Migração para bancos criados na v1.2/v1.3
--
-- Adiciona a coluna "tipo" ao histórico de execuções de agentes
-- ('Simulada' ou 'IA'). Rode UMA vez no SQL Editor do Supabase.
--
-- Instalações novas não precisam disto: o supabase-schema.sql
-- atualizado já cria a coluna.
-- ============================================================

alter table public.execucoes_agentes
  add column if not exists tipo text not null default 'Simulada';
