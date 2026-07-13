---
tipo: conceito
area: produto
aliases: [Origem, Fornecedor, SupplierConnector]
---

# Origem do Produto

> **De onde o produto vem.** Termo oficial ("Fornecedor" é apenas um dos tipos). Dá identidade à procedência e ancora o [[SKU Origem|SKU de origem]] (chave de conciliação).

**Fonte da verdade (design):** [[000-business-domain|000 · Business Domain]] · ingestão em [[006-capability-000-zion-intake|006 · Zion Intake]]

## Os 5 tipos

| Tipo | Definição |
|------|-----------|
| **Fornecedor** | Revende produtos de terceiros que abastece o Cliente. |
| **Fabricante** | Produz o produto (origem `interna` quando é o próprio Cliente). |
| **Importador** | Traz produtos de fora; particularidades fiscais tratadas no [[ERP]]. |
| **Distribuidor** | Intermediário de grandes volumes. |
| **Marca Própria** | A marca é do próprio Cliente (origem `interna`). |

## Posse

- **Dono dos dados originais:** a Origem (via [[Catálogo]]); a Zion **espelha**.
- Os dados de produto vêm do Catálogo — **não são inventados**.

## Eventos

Emite `origem.registrada`, `origem.atualizada`. A ingestão do catálogo dispara `fornecedor.catalogo.recebido` (via `SupplierConnector`, [[Connector SDK]]).

Ver também: [[Catálogo]] · [[SKU Origem]] · [[Produto Mestre]]

---
◀ [[Produto]] · [[Glossário]]
