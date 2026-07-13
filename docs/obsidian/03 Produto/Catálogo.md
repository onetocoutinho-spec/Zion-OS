---
tipo: conceito
area: produto
aliases: [Catalogo, lote, fonte_ingestao]
---

# Catálogo

> O **lote recebido** de uma [[Origem do Produto|Origem]] (Excel, CSV, PDF, XML, API, Drive, Site B2B). **Não é** o [[Produto Mestre]] — é o insumo bruto que o [[Zion Intake|Intake]] processa.

**Fonte da verdade (design):** [[000-business-domain|000]] · [[006-capability-000-zion-intake|006 · Zion Intake]]

## Responsabilidades

- Registrar imutavelmente **o que chegou** (formato, referência, quantidade) para rastreio e reprocessamento.
- Ser processado pelo Intake → Pré-Produto → conciliação → [[Produto Mestre]].

## Regras

- O conteúdo bruto é **imutável** (ninguém edita); apenas o status muda (pela Plataforma/Intake).
- Reingerir o mesmo catálogo **não duplica** pré-produto nem Mestre (idempotência por `sku_origem` + `fonte_ingestao`).

## Eventos

Emite `catalogo.registrado`, `catalogo.processado`. Consome `fornecedor.catalogo.recebido`.

Ver também: [[Origem do Produto]] · [[Zion Intake]] · [[Workflow]]

---
◀ [[Produto]] · [[Glossário]]
