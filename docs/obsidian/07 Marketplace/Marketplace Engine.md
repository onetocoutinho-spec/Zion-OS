---
tipo: conceito
area: marketplace
aliases: [Engine]
---

# Marketplace Engine

> O **runtime** que orquestra os [[Marketplace Adapter|Adapters]] sobre o [[Produto Mestre]]: fila `operacao_marketplace`, idempotência, retry/backoff, rate-limit, fan-out multicanal e reconciliação. **Generaliza** o worker atual (`fila_otimizacao_produto` + Vercel Cron).

**Fonte da verdade (design):** [[005-marketplace-engine|005 · Marketplace Engine]] · Fase 2 do [[007-execution-roadmap|Roadmap]]

## Garantias

- Publicar **500 anúncios sem a aba aberta**, sem duplicar (`unique(idempotency_key)` + checagem de `marketplace_item_id`).
- 429 → backoff; item preso volta à fila; erro permanente → dead-letter replayável.
- **O Engine não contém regra específica de canal** — fica no [[Marketplace Adapter|Adapter]].

## PR

[[PRs|PR-010]] (fila + idempotência) · [[PRs|PR-016]] (assíncrono + fan-out).

Ver também: [[Marketplace Adapter]] · [[Listing]] · [[Workflow]] · [[004-event-bus|Event Bus]]

---
◀ [[Marketplace]] · [[Glossário]]
