# Relatório Posterior — PR-003 · Migration Ledger (024) em Produção

> Terceiro artefato (Plano → Snapshot → **Relatório**). Snapshot: o do PR-002
> (mesmo dia, 18:53 UTC — nada estrutural mudou entre as operações).
> **Aplicação: 19:45:23 UTC · Validação: 19:46:52 UTC** (~90s). Zero downtime.

## Ações executadas
1. Migração 024 aplicada (`Success. No rows returned`): tabela `migracoes_aplicadas`
   + RLS (leitura da equipe) + baseline por evidência (18 registros) + auto-registro
   da própria 024 (primeira migração da nova convenção).
2. Diagnóstico v2 executado — validação completa do Definition of Done.

## Definition of Done — verificado em produção

| Pergunta | Resposta (uma consulta, sem docs, sem memória humana) |
|---|---|
| Última migração aplicada? | `024 — 024-migration-ledger` ✓ |
| Migrações pendentes? | `017, 018, 019, 020, 021` ✓ (exatamente as esperadas) |
| Existe drift? | **NÃO** — 10 sondas: 5 OK + 5 PENDENTE, zero DRIFT ✓ |
| Última alteração estrutural? | `2026-07-22 19:45:23 UTC` ✓ |
| Sentinela de segurança (016) | `OK (016 vigente)` ✓ · 0 usuários sem perfil ✓ |

`total_registradas = 19` (18 baseline + 024) — exatamente o previsto no runbook.

## Problemas encontrados
Nenhum.

## Rollback necessário?
**NÃO.** (Disponível: `drop table migracoes_aplicadas` — impacto zero no app.)

## Resultado final
✅ **O banco possui memória própria.** O drift de migrações — classe de risco que
mordeu o programa duas vezes — agora é detectável por uma colada de SQL. A convenção
"toda migração ≥024 termina registrando-se" está em vigor; migrações anteriores
permanecem documentos históricos intocados.

## Aprendizados do ciclo (Evolution)
- A repriorização por evidência venceu o backlog estático: o PR-003 "verdadeiro" não
  era o próximo item da lista, era a lição operacional do PR-002 institucionalizada.
- O parse-time do Postgres derrubou a v1 do diagnóstico — e o próprio erro antecipou
  o achado (017 ausente). Guardas via `DO $$` antes de referenciar objetos incertos.
- O baseline "exclusivamente por evidência" (com 001b e 017–021 deliberadamente fora)
  provou-se o critério certo: o ledger nasceu já verdadeiro, com zero drift na 1ª rodada.
- Encaminhado: E4-invertido (Producers antes de R-SE-1) é o próximo investimento de evolução.
