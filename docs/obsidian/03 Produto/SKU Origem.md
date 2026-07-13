---
tipo: conceito
area: produto
aliases: [sku_origem, SKU de origem, SKU]
---

# SKU Origem

> O **código único** da unidade vendável na fonte. `sku_origem` é a **chave 1ª de conciliação** Origem ↔ Zion ↔ ERP ↔ Marketplace. O [[EAN]] é **complementar** — desempata, nunca substitui.

**Fonte da verdade (design):** [[000-business-domain|000 · Business Domain]] (entidade SKU) · [[001-product-master|001]]

## Os três papéis do SKU

| Papel | Campo | Dono |
|-------|-------|------|
| SKU de origem | `sku_origem` | [[Origem do Produto]] |
| SKU Zion | `sku_zion` | Zion (identidade interna da [[Variante]]) |
| SKU do ERP | `erp_sku` | [[Magazord\|ERP]] |

## Conciliação

O motor de [[Zion Intake|Intake]] concilia por `sku_origem`; quando o SKU falha, o [[EAN]] desempata; sem chave válida, o item cai na fila `sem_sku` e **não** vira [[Produto Mestre]]. Ver [[006-capability-000-zion-intake|006 · Zion Intake]].

Ver também: [[EAN]] · [[Variante]] · [[Produto Mestre]]

---
◀ [[Produto]] · [[Glossário]]
