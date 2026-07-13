---
tipo: moc
area: ia
aliases: [Workforce, AI Workforce, Agentes IA]
---

# 🤖 IA — Workforce A0–A12

> A **força de trabalho de enriquecimento**: transforma dado bruto em anúncio completo, com trava de qualidade **A10** e regra-mãe **"nunca inventar dado"** (falta → "⚠️ informação necessária"). Orquestrada como [[Workflow]] dentro do [[Zion Intake|Intake]].

**Fonte da verdade (design):** [[006-capability-000-zion-intake|006 · Zion Intake]] · Fase 4 do [[007-execution-roadmap|Roadmap]]
**Fonte da verdade (prompts reais):** `src/lib/agentes/catalogo.ts` (fonte única no Zion OS).

## Estrutura da esteira

Estrutura de organização (o papel detalhado de cada agente é definido nos prompts reais — não duplicado aqui):

| Agente | Nota |
|--------|------|
| A0 | [[A0]] |
| A1 | [[A1]] |
| A2 | [[A2]] |
| A3 | [[A3]] |
| A4 | [[A4]] |
| A5 | [[A5]] |
| A6 | [[A6]] |
| A7 | [[A7]] |
| A8 | [[A8]] |
| A9 | [[A9]] |
| A10 | [[A10]] — trava de qualidade / Board |
| A11 | [[A11]] |
| A12 | [[A12]] |

## Capabilities (Fase 4)

- **CAP-AI** — esteira A0–A12 + gateway (fallback Gemini↔Claude) + ledger de custo/uso + qualidade (A10).
- **CAP-STUDIO** — Estúdio IA (imagens) — já existente; integrado ao enriquecimento.

## Regras-mãe

- **Nunca inventar dado** (nem [[EAN]], nem medida, nem atributo).
- Nada é promovido/publicado sem aprovação (**A10** + Board).
- Custo/modelo de cada execução ficam registrados (ledger) e auditáveis ([[Versionamento]]).

## PRs

[[PRs|PR-022..PR-025]] (orquestração, gateway, ledger, trava A10).

Ver também: [[Zion Intake]] · [[Workflow]] · [[Produto Mestre]]

---
◀ [[Home]] · [[Glossário]]
