---
tipo: indice
area: engenharia
---

# 📦 Plano de Pull Requests (PR-001 → PR-029)

> Índice navegável do **Plano de PRs** definido em [[007-execution-roadmap|007 · Execution Roadmap]]. Este documento **não** é a fonte da verdade — é um mapa. Cada PR é pequeno, revisável, reversível e atrás de feature-flag quando toca runtime. Um PR nunca mistura duas capabilities. Ver [[Definition of Done]] e [[Template PR]].

**Legenda de status:** 🔴 não iniciado · 🟡 em andamento · 🟢 concluído

> [!success] Fundação concluída
> **Fase 0 (PR-001 → PR-007) entregue.** Foco atual: Fase 1 ([[Magazord]]) e Fase 2 ([[Mercado Livre]]) — os Fluxos Operacionais.

## Fase 0 — Foundation

| PR | Título | Depende de | Status |
|----|--------|-----------|--------|
| PR-001 | Foundation — esquema [[Produto Mestre]] + [[Variante]] + Preço | — | 🟢 |
| PR-002 | [[Versionamento]]/Histórico do Produto Mestre | PR-001 | 🟢 |
| PR-003 | [[004-event-bus\|Event Bus]] — outbox + `evento`/`entrega` + relay | — | 🟢 |
| PR-004 | Event Bus — dead-letter + replay + métricas de lag | PR-003 | 🟢 |
| PR-005 | [[Connector SDK]] — contratos + registro + erros/limites | — | 🟢 |
| PR-006 | [[Marketplace Adapter]] — contrato base + fábrica (stub) | PR-005 | 🟢 |
| PR-007 | Observabilidade — AuditLog + logging estruturado | PR-001, PR-003 | 🟢 |

## Fase 1 — Magazord (ERP)

| PR | Título | Depende de | Status |
|----|--------|-----------|--------|
| PR-008 | [[Magazord\|ErpConnector]] — auth + cadastro (`erp_sku`) | PR-005, PR-003, PR-001 | 🔴 |
| PR-009 | ERP — espelho estoque/custo + eventos + reconciliação | PR-008 | 🔴 |

## Fase 2 — Mercado Livre

| PR | Título | Depende de | Status |
|----|--------|-----------|--------|
| PR-010 | [[Marketplace Engine]] — fila `operacao_marketplace` + idempotência | PR-006, PR-003 | 🔴 |
| PR-011 | Adapter [[Mercado Livre\|ML]] — envelopar publish/categoria/size-grid | PR-006, PR-010 | 🔴 |
| PR-012 | ML — ligar **User Products** no publish | PR-011 | 🔴 |
| PR-013 | ML — PUT preço | PR-011 | 🔴 |
| PR-014 | ML — PUT estoque (reflete ERP) | PR-011, PR-009 | 🔴 |
| PR-015 | ML — Webhooks + reconciliação estado/venda | PR-010 | 🔴 |
| PR-016 | ML — publicação assíncrona + fan-out | PR-010, PR-011 | 🔴 |

## Fase 3 — Zion Intake

| PR | Título | Depende de | Status |
|----|--------|-----------|--------|
| PR-017 | [[Origem do Produto\|SupplierConnector]] — ingestão Excel/CSV/XML | PR-005, PR-003 | 🔴 |
| PR-018 | Intake — Pré-Produto + normalização | PR-017 | 🔴 |
| PR-019 | Intake — conciliação ([[SKU Origem]]→[[EAN]]) + fila `sem_sku` | PR-018 | 🔴 |
| PR-020 | Intake — promoção a Produto Mestre + disparo ERP/publicação | PR-019, PR-008, PR-010 | 🔴 |
| PR-021 | [[Origem do Produto]] + [[Catálogo]] + Compra (revenda) | PR-001 | 🔴 |

## Fase 4 — AI Workforce

| PR | Título | Depende de | Status |
|----|--------|-----------|--------|
| PR-022 | [[IA\|AI]] — orquestração esteira A0–A12 (Workflow) | PR-020, PR-003 | 🔴 |
| PR-023 | AI — gateway com fallback Gemini↔Claude | PR-022 | 🔴 |
| PR-024 | AI — ledger de custo/uso | PR-022, PR-007 | 🔴 |
| PR-025 | AI — trava [[IA\|A10]] + Board (aprovar/editar/rejeitar) | PR-022 | 🔴 |

## Fase 5 — TikTok Shop / Fase 6 — Shopee

| PR | Título | Depende de | Status |
|----|--------|-----------|--------|
| PR-026 | Adapter [[TikTok Shop]] + webhooks | PR-010, PR-006 | 🔴 |
| PR-027 | Fan-out ML + TikTok | PR-016, PR-026 | 🔴 |
| PR-028 | Adapter [[Shopee]] + webhooks | PR-010, PR-006 | 🔴 |
| PR-029 | Fan-out ML + TikTok + Shopee | PR-027, PR-028 | 🔴 |

> [!note] Manutenção
> Atualize o **Status** conforme os PRs avançam. A ordem, os títulos e as dependências vêm de [[007-execution-roadmap]] — se mudarem lá, reflita aqui. Ver a timeline em [[Roadmap]].

---
◀ [[Engenharia]] · [[Home]]
