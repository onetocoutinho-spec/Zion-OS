---
tipo: conceito
area: integracoes
aliases: [TikTok]
---

# TikTok Shop

> Segundo canal — **reuso puro** (Fase 5). Novo [[Marketplace Adapter|Adapter]] sobre o **mesmo** [[Marketplace Engine|Engine]]/[[004-event-bus|Event Bus]]/[[Produto Mestre]]. Retrabalho de [[Zion Intake|Intake]]/[[IA]] = zero.

**Fonte da verdade (design):** [[002-marketplace-adapter|002]] · Fase 5 do [[007-execution-roadmap|Roadmap]]

## Escopo

- OAuth/credenciais server-side.
- Adapter: Produto Mestre ↔ payload TikTok (categorias/atributos/variações).
- Webhooks → `marketplace.listing.estado` / `venda.recebida`.
- Fan-out [[Mercado Livre|ML]] + TikTok com rate-limit por conta.

## Dependências

Fase 2 (Engine + Adapter base validados no ML) · Fase 1 (estoque real do [[ERP]]) · Fase 0 (contratos). PRs [[PRs|PR-026, PR-027]].

Ver também: [[Mercado Livre]] · [[Shopee]] · [[Marketplace Adapter]]

---
◀ [[Integrações]] · [[Glossário]]
