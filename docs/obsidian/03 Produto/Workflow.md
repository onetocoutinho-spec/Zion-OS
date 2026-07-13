---
tipo: conceito
area: produto
aliases: [Fluxo de trabalho, esteira]
---

# Workflow

> Orquestração de **etapas** sobre o [[Produto Mestre]] (ex.: a esteira de enriquecimento [[IA|A0–A12]], a promoção Pré-Produto → Mestre, a publicação). Cada passo é assíncrono, idempotente e auditável via [[004-event-bus|Event Bus]].

**Fonte da verdade (design):** [[000-business-domain|000]] (entidade Workflow) · orquestração de IA em [[006-capability-000-zion-intake|006 · Zion Intake]]

## Exemplos de Workflow

- **Enriquecimento IA:** esteira [[IA|A0–A12]] → trava A10 → Board. Ver [[IA]].
- **Promoção:** [[Catálogo]] → Pré-Produto → conciliação por [[SKU Origem]] → [[Produto Mestre]] → dispara [[ERP]] + publicação.
- **Publicação:** [[Marketplace Engine]] orquestra os [[Marketplace Adapter|Adapters]].

## Hoje no Zion OS

A fila `fila_otimizacao_produto` + worker Vercel Cron é o Workflow de enriquecimento vivo — **padrão a generalizar** para o [[Marketplace Engine]] (ver [[007-execution-roadmap|Roadmap Fase 2]]).

Ver também: [[Zion Intake]] · [[IA]] · [[Marketplace Engine]]

---
◀ [[Produto]] · [[Glossário]]
