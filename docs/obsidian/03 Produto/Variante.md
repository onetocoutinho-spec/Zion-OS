---
tipo: conceito
area: produto
---

# Variante

> Cada **derivação vendável** do [[Produto Mestre]] (cor, tamanho, voltagem…). É a unidade real de venda e de estoque.

**Fonte da verdade (design):** [[001-product-master|001 · Product Master]] · [[000-business-domain|000]]

## Responsabilidades

Carrega [[SKU Origem|SKU]], [[EAN]], preço de venda e o **espelho** de estoque/custo do [[ERP]].

## Posse

- **Dono:** Zion (preço de venda / identidade) + [[ERP]] (estoque/custo, espelho read-only).
- **Pode alterar:** Equipe/Cliente/Agente [[IA]] (conteúdo/preço); ERP (estoque/custo via evento).
- **Apenas consulta:** [[Mercado Livre|Marketplace]].

## Relacionamentos

Pertence a 1 [[Produto Mestre]]; mapeada em N [[Listing]] Variante (1 por canal).

## Eventos

- **Emite:** `variante.atualizada`.
- **Consome:** `erp.estoque.mudou`, `erp.custo.mudou`.

> [!warning] Tamanhos "sujos" (Zion OS atual)
> Os tamanhos importados do ML vêm inconsistentes ("38 BR", "33 - 34", faixas). A normalização é pré-requisito do SIZE_GRID na publicação — ver [[Mercado Livre]].

Ver também: [[Produto Mestre]] · [[SKU Origem]] · [[EAN]]

---
◀ [[Produto]] · [[Glossário]]
