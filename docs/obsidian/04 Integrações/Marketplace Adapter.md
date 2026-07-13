---
tipo: conceito
area: integracoes
aliases: [Adapter]
---

# Marketplace Adapter

> O **contrato de adaptador de marketplace**: traduz [[Produto Mestre]] ↔ payload do canal (publicar, atualizar, pausar, reconciliar). O Mercado Livre é a referência; TikTok e Shopee implementam **o mesmo** contrato.

**Fonte da verdade (design):** [[002-marketplace-adapter|002 · Marketplace Adapter]] (base do [[003-connector-sdk|Connector SDK]])

## Regra de ouro

Toda regra específica de canal fica **no Adapter**. O [[Marketplace Engine]] permanece livre de regra de ML/TikTok/Shopee — por isso um novo canal é **reuso puro** (só um novo Adapter).

## Implementações

| Canal | Adapter | Fase |
|-------|---------|------|
| [[Mercado Livre]] | clássico + **User Products** (SIZE_GRID) | 2 |
| [[TikTok Shop]] | categorias/atributos/variações TikTok | 5 |
| [[Shopee]] | payload Shopee | 6 |

Ver também: [[Marketplace Engine]] · [[Listing]] · [[Connector SDK]]

---
◀ [[Integrações]] · [[Glossário]]
