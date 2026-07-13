---
tipo: conceito
area: produto
aliases: [Anúncio, Listing Variante]
---

# Listing

> O **anúncio publicado** de um [[Produto Mestre]] em um canal, por [[Conta Marketplace]]. O **estado real** do listing é da Fonte da Verdade do [[Mercado Livre|Marketplace]]; a Zion publica/atualiza via [[Marketplace Adapter]].

**Fonte da verdade (design):** [[000-business-domain|000]] · [[002-marketplace-adapter|002 · Marketplace Adapter]] · [[005-marketplace-engine|005 · Marketplace Engine]]

## Ciclo de vida

`solicitar publicação → [[Marketplace Engine|Engine]] (fila + idempotência) → [[Marketplace Adapter|Adapter]] → Marketplace → webhook reconcilia estado/venda`

## Regras

- Publicação **assíncrona** e idempotente (`unique(idempotency_key)` + checagem de `marketplace_item_id`) — evita anúncio duplicado.
- Preço e estoque propagam do Produto Mestre / [[ERP]] via PUT.
- 1 [[Variante]] ↔ N Listing Variante (1 por canal).

## Eventos

- **Emite (via Adapter):** `marketplace.listing.estado`, `venda.recebida`, `pergunta.recebida`.
- **Consome:** `listing.publicar.solicitado`, `listing.atualizar.solicitado`.

Ver também: [[Mercado Livre]] · [[Marketplace Engine]] · [[Marketplace Adapter]] · [[Fluxo Marketplace.canvas|Canvas]]

---
◀ [[Produto]] · [[Glossário]]
