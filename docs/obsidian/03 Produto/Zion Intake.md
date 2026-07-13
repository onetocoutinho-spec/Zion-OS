---
tipo: conceito
area: produto
aliases: [Intake, Capability 000, CAP-INTAKE]
---

# Zion Intake

> A **esteira industrial** (Capability 000): do **catálogo do fornecedor** ao **[[Produto Mestre]]** pronto para operar. Ingere → cria Pré-Produto → normaliza → **concilia por [[SKU Origem]]** (EAN complementar) → **promove** a Produto Mestre, disparando [[ERP]] e publicação.

**Fonte da verdade (design):** [[006-capability-000-zion-intake|006 · Capability 000 — Zion Intake]] · Fase 3 do [[007-execution-roadmap|Roadmap]]

## Etapas ([[Workflow]])

1. **Ingestão** (`SupplierConnector`, v1: Excel/CSV/XML) → [[Catálogo]] + `fornecedor.catalogo.recebido`.
2. **Pré-Produto** (staging) + normalização (SKU/EAN/tamanhos/marca).
3. **Conciliação** por `sku_origem` → [[EAN]] desempata → fila `sem_sku` para revisão.
4. **Promoção** Pré-Produto → [[Produto Mestre]] (idempotente) + dispara ERP + publicação.

## Regras

- Produto **sem SKU válido não vira Mestre** (cai em `sem_sku`).
- Reingerir o mesmo catálogo **não duplica** (idempotência por `sku_origem` + `fonte_ingestao`).
- Enriquecimento pela [[IA|Workforce A0–A12]] (Fase 4); sem ela, usa o enriquecimento legado como ponte.

## PRs

[[PRs|PR-017..PR-021]].

Ver também: [[Catálogo]] · [[Origem do Produto]] · [[IA]] · [[Produto Mestre]]

---
◀ [[Produto]] · [[Glossário]]
