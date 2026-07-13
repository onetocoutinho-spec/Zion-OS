---
tipo: moc
area: erp
aliases: [Magazord ERP]
---

# 🏭 ERP — Índice (Magazord)

> O sistema externo de gestão — **Fonte da Verdade de estoque, custo, fiscal e nota**. A Zion **consome/propaga**, nunca substitui: espelha estoque/custo (read-only) e nunca inventa esses números.

**Fonte da verdade (design):** [[000-business-domain|000]] (entidade ERP) · integração em [[003-connector-sdk|003 · Connector SDK]] · Fase 1 do [[007-execution-roadmap|Roadmap]]

## Fronteira (regra suprema de 000)

| Informação | Dono |
|-----------|------|
| Estoque, custo, fiscal, nota | **ERP (Magazord)** |
| Conteúdo, preço de venda, identidade, estado do anúncio | **Zion** ([[Produto Mestre]]) |
| Estado real do anúncio, pedidos | **[[Marketplace]]** |

## Integração

Via `ErpConnector` ([[Connector SDK]]) → ver [[Magazord]] para o conector, épicos e PRs.

- Cadastro devolve `erp_sku` (persistido na [[Variante]]).
- Espelho de estoque/custo → eventos `erp.estoque.mudou` / `erp.custo.mudou`.
- Nota é do ERP; a Zion referencia (`erp.nota.emitida`).

## Eventos

**Emite:** `erp.produto.propagado`, `erp.estoque.mudou`, `erp.custo.mudou`, `erp.nota.emitida`.
**Consome:** `produto_mestre.criado`/`.atualizado`.

Ver também: [[Magazord]] · [[Produto Mestre]] · [[Variante]] · [[Fluxo Magazord.canvas|Canvas]]

---
◀ [[Home]] · [[Glossário]]
