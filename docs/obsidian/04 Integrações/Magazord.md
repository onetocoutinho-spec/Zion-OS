---
tipo: conceito
area: integracoes
aliases: [ErpConnector Magazord]
---

# Magazord

> O **ERP** integrado via `ErpConnector` ([[Connector SDK]]). **Fonte da Verdade de estoque, custo, fiscal e nota.** A Zion cadastra o produto e **espelha** (read-only) estoque/custo de volta ao [[Produto Mestre]] — nunca inventa esses números.

**Fonte da verdade (design):** [[003-connector-sdk|003]] · domínio em [[ERP]] · Fase 1 do [[007-execution-roadmap|Roadmap]]

## O que o ErpConnector faz (Fase 1)

- Autenticação/credenciais **server-side**.
- Cadastro/atualização de produto a partir de `produto_mestre.criado`/`.atualizado` → recebe `erp_sku` (persistido na [[Variante]]).
- **Espelho** de estoque/custo → eventos `erp.estoque.mudou` / `erp.custo.mudou`.
- Reconciliação periódica ERP↔Zion + tratamento de divergência.
- Nota é **do ERP**; a Zion apenas referencia (`erp.nota.emitida`).

## PRs

[[PRs|PR-008]] (auth + cadastro) · [[PRs|PR-009]] (espelho estoque/custo + reconciliação).

Ver também: [[ERP]] · [[Produto Mestre]] · [[Integrações.canvas|Canvas · Integrações]]

---
◀ [[Integrações]] · [[Glossário]]
