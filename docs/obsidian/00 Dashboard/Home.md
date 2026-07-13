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
| **Fase atual** | ✅ **Fundação concluída** (Fase 0). |
| **Próxima fase** | 🔜 **Fluxos Operacionais** — Fase 1 Magazord + Fase 2 Mercado Livre. |
| **Fundação (Fase 0)** | ✅ **PR-001 a PR-007** entregues: Produto Mestre · Versionamento · Event Bus · dead-letter/replay · Connector SDK · Marketplace Adapter · Observabilidade. Ver [[Roadmap]] · [[PRs]]. |
| **Arquitetura** | Consolidada (000–010) — fonte da verdade de design. |
| **Operação viva** | Zion OS (Next.js 16 + Supabase) operando **Chinelaria Leilane Neves**: OAuth ML, esteira A0–A12, fila `fila_otimizacao_produto` + Vercel Cron, RLS por papel, Estúdio IA. |
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
| ✅ **PR-001 → PR-007** — Fase 0 Foundation completa | 🔜 **PR-008 / PR-009** Magazord · **PR-010 → PR-016** Mercado Livre → ver [[PRs]] |

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

- [[Arquitetura Geral.canvas|Arquitetura Geral]] · [[Produto Mestre.canvas|Produto Mestre]] · [[Integrações.canvas|Integrações]]
- [[Banco.canvas|Banco]] · [[Roadmap.canvas|Roadmap]]

---

## 🔗 Links rápidos

| Navegação | Engenharia | Referência |
|-----------|-----------|------------|
| [[Arquitetura]] | [[PRs]] | [[Glossário]] |
| [[Produto]] | [[Engineering Rules]] | [[Roadmap]] |
| [[Integrações]] | [[Definition of Done]] | [[ADR]] |
| [[Banco]] | [[Fluxo de Code Review]] | [[Canvas]] |
| [[IA]] | [[Fluxo de Desenvolvimento]] | [[obsidian/README\|README]] |

## 🕑 Documentos-fonte de referência (fora da arquitetura)

- [[zion-os-audit/README|Auditoria do Zion OS]] — estado atual, riscos, modelo de dados sugerido
- [[implementation-phase-1-security/README|Implementação — Segurança Fase 1]]
- [[staging-setup/README|Setup de Staging]] · [[staging-stabilization/01-diagnostico-completo|Estabilização de Staging]]
- [[agency-panel-separation/README|Separação Painel Agência × Cliente]]
