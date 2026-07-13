---
tipo: conceito
area: integracoes
---

# Shopee

> Terceiro canal de reuso (Fase 6). **Idêntico em forma à [[TikTok Shop|Fase 5]]** — só muda o [[Marketplace Adapter|Adapter]]. Completa o fan-out multicanal (ML + TikTok + Shopee) sem retrabalho de núcleo/[[Zion Intake|Intake]]/[[IA]].

**Fonte da verdade (design):** [[002-marketplace-adapter|002]] · Fase 6 do [[007-execution-roadmap|Roadmap]]

## Escopo

- OAuth/credenciais server-side.
- Adapter: Produto Mestre ↔ payload Shopee.
- Webhooks → reconciliação de estado/venda.
- Fan-out [[Mercado Livre|ML]] + [[TikTok Shop|TikTok]] + Shopee com rate-limit por conta.

## Dependências

Fase 2 (Engine/Adapter base) · Fase 1 ([[ERP]]) · Fase 0 (contratos). PRs [[PRs|PR-028, PR-029]].

Ver também: [[Mercado Livre]] · [[TikTok Shop]] · [[Marketplace Adapter]]

---
◀ [[Integrações]] · [[Glossário]]
