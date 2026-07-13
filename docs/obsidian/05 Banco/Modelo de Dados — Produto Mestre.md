---
tipo: nota
area: banco
aliases: [Produto Mestre no banco]
---

# Modelo de Dados — Produto Mestre

> Como o conceito [[Produto Mestre]] é persistido. Desenho canônico em [[001-product-master|001 · Product Master]] e [[009-pr001-implementation-plan|009 · Plano PR-001]].

## Entidades persistidas

- **Produto Mestre** — conteúdo, preço de venda, identidade, status, categoria.
- **[[Variante]]** — `sku_zion`, `sku_origem`, `erp_sku`, [[EAN]], espelho de estoque/custo.
- **Imagens** (`capa|secundaria|detalhe|medidas|humanizada`), **Atributos** (ficha técnica), **Preço por canal**.
- **[[Versionamento|Versão]]** — histórico (diff, autor, agente, timestamp, undo).

## Chaves de conciliação

`sku_origem` (1ª) → [[EAN]] (desempate) → `erp_sku` (Magazord) → `marketplace_item_id` (por canal). Ver [[SKU Origem]].

## PRs de fundação

[[PRs|PR-001]] (esquema) · [[PRs|PR-002]] (versionamento). Multiempresa por [[RLS]].

Ver também: [[Produto Mestre]] · [[Schema]] · [[Versionamento]]

---
◀ [[Banco]] · [[Glossário]]
