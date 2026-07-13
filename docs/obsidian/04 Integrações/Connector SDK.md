---
tipo: conceito
area: integracoes
aliases: [SDK, Connector, SupplierConnector, ErpConnector, MarketplaceConnector]
---

# Connector SDK

> A **interface padrão de qualquer integração** — fornecedor, ERP, marketplace, futuras. Um novo conector nasce apenas satisfazendo a interface, **sem tocar no núcleo**.

**Fonte da verdade (design):** [[003-connector-sdk|003 · Connector SDK]]

## Especializações

- `SupplierConnector` — ingestão de catálogo ([[Origem do Produto]] → [[Catálogo]]). Fase 3 / [[Zion Intake]].
- `ErpConnector` — [[Magazord]]: cadastro, leitura de estoque/custo, eventos ERP. Fase 1.
- `MarketplaceConnector` / [[Marketplace Adapter]] — [[Mercado Livre]], [[TikTok Shop]], [[Shopee]]. Fases 2/5/6.

## Contrato

Inclui `limites()` (rate-limit por conta), erros **sanitizados** (sem segredo) e registro de conectores. Base do [[Marketplace Adapter]] e do [[Marketplace Engine]].

Ver também: [[Marketplace Adapter]] · [[Marketplace Engine]] · [[Integrações]]

---
◀ [[Integrações]] · [[Glossário]]
