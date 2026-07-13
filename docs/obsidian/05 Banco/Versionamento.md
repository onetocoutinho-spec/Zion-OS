---
tipo: nota
area: banco
aliases: [Histórico, Versão, AuditLog]
---

# Versionamento

> Histórico de alterações relevantes: **old → new**, autor/agente, timestamp, com **undo**. Toda alteração de [[Produto Mestre]] gera uma **Versão**; toda escrita relevante gera **evento** + **entrada de histórico** ([[004-event-bus|Event Bus]]).

**Fonte da verdade (design):** [[001-product-master|001]] (versionamento) · [[004-event-bus|004]] (auditoria) · [[010-database-compliance|010]]

## Regras

- Diff por campo, com autor humano ou Agente [[IA]].
- `AuditLog` registra old→new; **nenhum log/payload contém segredo**.
- Correlação por `evento_id`; reprocessar o mesmo evento (idempotência) não duplica efeito.
- Versões preservam o estado anterior → rollback nunca é destrutivo.

## PR

[[PRs|PR-002]] (Versionamento/Histórico) · [[PRs|PR-007]] (Observabilidade/AuditLog).

Ver também: [[Modelo de Dados — Produto Mestre]] · [[Workflow]] · [[Definition of Done]]

---
◀ [[Banco]] · [[Glossário]]
