# Runbook — Migração 024 · Migration Ledger (PR-003)

> Regra dos 3 artefatos: **Plano** (RFC PR-003 aprovada) · **Snapshot** · **Relatório**.
> Operação de risco quase nulo: tabela nova, nenhum código do app a lê.

## Fase 0 — Snapshot
O estado pré-024 já está capturado com evidência do MESMO dia:
[snapshot do PR-002](../executions/2026-07-22-pr002-security-snapshot.md) (18:53 UTC) —
válido como snapshot desta operação (nada estrutural mudou entre as duas). Registrar no
relatório apenas o horário de início.

## Fase 1 — Aplicar
Rodar `database/migrations/024-migration-ledger.sql` inteira (idempotente).
Cria o ledger + baseline **por evidência** (001–016, 022, 023; a 001b e as 017–021
ficam deliberadamente fora — histórico não comprovado e pendências reais) + auto-registro
da própria 024 (primeira da convenção).

## Fase 2 — Validar (Definition of Done)
Rodar `database/checks/diagnostico-migracoes-producao.sql` (v2). Esperado:
- `5-ledger · ultima_migracao_aplicada` = `024 — 024-migration-ledger`
- `5-ledger · total_registradas` = `19`
- `5-ledger · migracoes_pendentes_conhecidas` = `017, 018, 019, 020, 021`
- `6-drift` = **todas OK ou PENDENTE — nenhuma linha DRIFT**
- `1-seguranca` = `OK (016 vigente)`

## Fase 3 — Relatório
`docs/engineering/executions/<data>-pr003-ledger-report.md` (ações, DoD, horários).

## Rollback (zero impacto no app)
```sql
drop table if exists public.migracoes_aplicadas;
```

## Convenção permanente (a partir da 024)
Toda nova migração TERMINA com seu próprio `insert into migracoes_aplicadas (...)`.
Migrações existentes são **documentos históricos** — nunca alteradas retroativamente.
