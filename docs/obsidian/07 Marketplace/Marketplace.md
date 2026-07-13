---
tipo: moc
area: marketplace
---

# 🛒 Marketplace — Índice

> O domínio de venda: onde o [[Produto Mestre]] vira [[Listing|anúncio]] e é vendido. Termo oficial **Marketplace** ("Canal" é sinônimo informal). Fonte da Verdade do **estado real do anúncio** e dos **pedidos** é do próprio Marketplace.

**Fonte da verdade (design):** [[002-marketplace-adapter|002 · Adapter]] · [[005-marketplace-engine|005 · Engine]] · [[000-business-domain|000]]

## Peças

- [[Marketplace Engine]] — runtime que orquestra os adapters (fila, retry, rate-limit, fan-out, reconciliação)
- [[Marketplace Adapter]] — contrato por canal (regra específica fica aqui)
- [[Conta Marketplace]] — a loja conectada de um Cliente (OAuth, server-side)
- [[Listing]] — o anúncio publicado

## Canais

- [[Mercado Livre]] (Fase 2) · [[TikTok Shop]] (Fase 5) · [[Shopee]] (Fase 6)

## Fluxo

`[[Produto Mestre]] → [[Marketplace Engine|Engine]] (fila+idempotência) → [[Marketplace Adapter|Adapter]] → canal → webhook → reconciliação`

Ver o mapa em [[Integrações.canvas|Canvas · Integrações]].

---
◀ [[Home]] · [[Glossário]]
