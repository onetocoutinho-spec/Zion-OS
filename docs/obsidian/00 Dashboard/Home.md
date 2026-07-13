---
tipo: dashboard
titulo: Zion Platform — Home
atualizado: 2026-07-13
---

# 🏛️ Zion Platform — Centro de Conhecimento

> **Plataforma de Operações para Comércio Digital.** Orquestra três mundos: **Origem do Produto → ERP (Magazord) → Marketplaces (ML · TikTok · Shopee)**. A Zion é a **Fonte da Verdade da operação de marketplace** (conteúdo, preço de venda, identidade e estado do anúncio). Ver [[000-business-domain|000 · Business Domain]].

---

## 🚦 Estado atual do projeto

| Dimensão | Situação |
|----------|----------|
| **Etapa** | Arquitetura consolidada (000–010) — fonte da verdade de design. Implementação da fundação (Fase 0) ainda **não iniciada** como PRs canônicos. |
| **Operação viva hoje** | Zion OS (Next.js 16 + Supabase) operando o cliente **Chinelaria Leilane Neves**: OAuth ML, esteira A0–A12, fila `fila_otimizacao_produto` + Vercel Cron, RLS por papel, Estúdio IA. |
| **Próxima peça crítica** | Ligar **User Products** no publish do ML para publicar 1 calçado real (categoria MLB273770 rejeita o payload clássico). Ver [[Mercado Livre]]. |
| **Segurança** | Fase 1 (R1/R3/R6) na branch `fix/multitenancy-security` — **não** mergeada/aplicada em prod. Ver [[RLS]]. |
| **Deploy** | `https://www.zioncompany.online` (Cloudflare → Vercel). |

## 🧭 Arquitetura (000–010)

Fundação de design da plataforma. Índice completo em **[[Arquitetura]]**.

- [[000-business-domain|000 · Business Domain]] — linguagem oficial, Fonte da Verdade
- [[001-product-master|001 · Product Master]] — modelo canônico
- [[003-connector-sdk|003 · Connector SDK]] · [[002-marketplace-adapter|002 · Marketplace Adapter]]
- [[004-event-bus|004 · Event Bus]] · [[005-marketplace-engine|005 · Marketplace Engine]]
- [[006-capability-000-zion-intake|006 · Zion Intake]] · [[007-execution-roadmap|007 · Execution Roadmap]]

## 🗺️ Roadmap & PRs

Timeline completa em **[[Roadmap]]**. Plano de PRs em **[[PRs]]**.

**Sequência oficial:** `Fase 0 Foundation → Fase 1 Magazord → Fase 2 Mercado Livre → Fase 3 Zion Intake → Fase 4 AI Workforce → Fase 5 TikTok → Fase 6 Shopee`.

| PRs concluídos | Próximos PRs |
|----------------|--------------|
| _Nenhum PR canônico do roadmap fechado ainda_ (a operação atual precede o plano PR-001…029). | **PR-001** Foundation — Produto Mestre · **PR-003** Event Bus · **PR-005** Connector SDK → ver [[PRs]] |

## 🗄️ Banco

Índice em **[[Banco]]**. Migrações vivas do Zion OS: `008`→`016`. Compliance de banco em [[010-database-compliance|010 · Database Compliance]].

- [[Schema]] · [[Migrations]] · [[RLS]] · [[Versionamento]] · [[Modelo de Dados — Produto Mestre]]

## 🔌 Integrações

Índice em **[[Integrações]]**.

- [[Magazord]] (ERP) · [[Mercado Livre]] · [[TikTok Shop]] · [[Shopee]]
- Contratos: [[Connector SDK]] · [[Marketplace Adapter]] · [[Marketplace Engine]]

## 🤖 IA — Workforce A0–A12

Índice em **[[IA]]**. A esteira de enriquecimento transforma dado bruto em anúncio completo, com trava de qualidade **A10** e regra-mãe "nunca inventar dado".

## 📚 Glossário

Linguagem oficial do domínio em **[[Glossário]]** (canônico: [[000-business-domain]]).

## 🎨 Canvas (mapas visuais)

- [[Arquitetura Geral.canvas|Arquitetura Geral]] · [[Fluxo Produto Mestre.canvas|Fluxo do Produto Mestre]]
- [[Fluxo Magazord.canvas|Fluxo Magazord]] · [[Fluxo Marketplace.canvas|Fluxo Marketplace]] · [[Roadmap.canvas|Roadmap]]

---

## 🔗 Links rápidos

| Navegação | Engenharia | Referência |
|-----------|-----------|------------|
| [[Arquitetura]] | [[PRs]] | [[Glossário]] |
| [[Produto]] | [[Engineering Rules]] | [[Roadmap]] |
| [[Integrações]] | [[Definition of Done]] | [[ADR]] |
| [[Banco]] | [[Fluxo de Code Review]] | [[Canvas]] |
| [[IA]] | [[Fluxo de Desenvolvimento]] | [[README]] |

## 🕑 Documentos-fonte de referência (fora da arquitetura)

- [[zion-os-audit/README|Auditoria do Zion OS]] — estado atual, riscos, modelo de dados sugerido
- [[implementation-phase-1-security/README|Implementação — Segurança Fase 1]]
- [[staging-setup/README|Setup de Staging]] · [[staging-stabilization/01-diagnostico-completo|Estabilização de Staging]]
- [[agency-panel-separation/README|Separação Painel Agência × Cliente]]
