---
tipo: moc
area: integracoes
---

# 🔌 Integrações — Índice

> Toda integração externa implementa o **mesmo contrato**: o [[Connector SDK]]. Todo marketplace implementa o [[Marketplace Adapter]], orquestrado pelo [[Marketplace Engine]].

## Contratos (arquitetura)

- [[Connector SDK]] → [[003-connector-sdk|003]]
- [[Marketplace Adapter]] → [[002-marketplace-adapter|002]]
- [[Marketplace Engine]] → [[005-marketplace-engine|005]]

## Conectores

| Integração | Tipo | Contrato | Doc / Fase |
|-----------|------|----------|------------|
| [[Magazord]] | ERP | `ErpConnector` | [[ERP]] · Fase 1 |
| [[Mercado Livre]] | Marketplace | `MarketplaceConnector` | Fase 2 |
| [[TikTok Shop]] | Marketplace | `MarketplaceConnector` | Fase 5 |
| [[Shopee]] | Marketplace | `MarketplaceConnector` | Fase 6 |

## Princípios

- Segredos só **server-side** (nunca no navegador). Ver [[RLS]] · [[Engineering Rules]].
- `limites()` + retry/backoff por conta; idempotência obrigatória.
- Toda operação gera evento ([[004-event-bus|Event Bus]]) e é reconciliada por webhook.

Ver o mapa em [[Integrações.canvas|Canvas · Integrações]].

---
◀ [[Home]] · [[Glossário]]
