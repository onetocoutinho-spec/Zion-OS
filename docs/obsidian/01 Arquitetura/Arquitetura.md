---
tipo: moc
area: arquitetura
---

# 🧭 Arquitetura — Índice (000–010)

> Índice **navegável** da fundação de arquitetura da Zion Platform. Cada linha aponta para o **documento-fonte** em `docs/architecture/` — nada é duplicado aqui. Em divergência de nomenclatura, **[[000-business-domain|000]] prevalece**; em divergência de escopo técnico, prevalece o documento da capability.

Fluxo de negócio: `Origem → Zion Intake → Produto Mestre → ERP → Marketplace`.

## Documentos-fonte

| # | Documento | O que define | Conceitos relacionados |
|---|-----------|--------------|------------------------|
| 000 | [[000-business-domain\|Business Domain]] | Constituição / linguagem oficial / Fonte da Verdade por informação | [[Glossário]] · [[Produto Mestre]] · [[Origem do Produto]] |
| 001 | [[001-product-master\|Product Master]] | Modelo canônico (SKU, variações, imagens, SEO, categoria, status, versão) | [[Produto Mestre]] · [[Variante]] · [[Versionamento]] |
| 002 | [[002-marketplace-adapter\|Marketplace Adapter]] | Contrato de adaptador de marketplace (ML como referência) | [[Marketplace Adapter]] · [[Mercado Livre]] |
| 003 | [[003-connector-sdk\|Connector SDK]] | Interface padrão de qualquer integração | [[Connector SDK]] · [[Magazord]] |
| 004 | [[004-event-bus\|Event Bus]] | Backbone de eventos assíncronos, idempotentes, auditáveis | [[Workflow]] · [[Versionamento]] |
| 005 | [[005-marketplace-engine\|Marketplace Engine]] | Runtime que orquestra adapters (fila, retry, rate-limit, fan-out) | [[Marketplace Engine]] · [[Marketplace Adapter]] |
| 006 | [[006-capability-000-zion-intake\|Capability 000 — Zion Intake]] | Operação ponta a ponta: catálogo → produto mestre → publicação | [[Catálogo]] · [[Origem do Produto]] · [[IA]] |
| 007 | [[007-execution-roadmap\|Execution Roadmap]] | Plano oficial: fases → capabilities → épicos → PRs | [[Roadmap]] · [[PRs]] |
| 008 | [[008-architecture-compliance\|Architecture Compliance]] | Conformidade da arquitetura | [[Definition of Done]] |
| 009 | [[009-pr001-implementation-plan\|PR-001 Implementation Plan]] | Plano de implementação do PR-001 (Foundation) | [[PRs]] · [[Modelo de Dados — Produto Mestre]] |
| 010 | [[010-database-compliance\|Database Compliance]] | Conformidade de banco | [[Banco]] · [[RLS]] · [[Migrations]] |

## Camadas (leitura sugerida)

`003 Connector SDK` é a base → `002 Adapter` e `ErpConnector`/`SupplierConnector` o especializam. `001 Product Master` é o dado central. `004 Event Bus` conecta os fluxos. `005 Engine` orquestra os adapters sobre o Produto Mestre. `006 Zion Intake` compõe tudo na operação real.

Ver o mapa visual em [[Arquitetura Geral.canvas|Canvas · Arquitetura Geral]].

## Princípios fundadores (de 000)

- **SKU do fornecedor = chave principal de conciliação.** [[EAN]] é complementar.
- **Zion é a Fonte da Verdade da operação de marketplace.**
- **ERP (Magazord) é a Fonte da Verdade de estoque, custo, fiscal e nota.**
- **Tudo é assíncrono, idempotente e auditável** (via [[004-event-bus|Event Bus]]).
- **Toda integração externa implementa o mesmo contrato** ([[Connector SDK]]).

---
◀ [[Home]]
