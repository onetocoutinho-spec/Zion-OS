# CR-001 — Knowledge Institutionalization · Relatório

> 2026-07-22 · branch `eng/cr-001-knowledge-institutionalization` (base:
> `eng/pr-006-learning-loop` — **merge do PR-006 primeiro**).
> Missão: transformar em memória permanente todo o conhecimento aceito entre
> PR-007 e AR-001, que até então vivia apenas em conversa.

## O que foi institucionalizado (6 commits)

| Commit | Conteúdo | Documento canônico |
|---|---|---|
| 1 | **ADR-001 — Suggestion Memory** (a lacuna mais grave: decisão arquitetural aceita sem arquivo) | `docs/zion-os/engineering/ADR-001-suggestion-memory.md` |
| 2 | PR-007 + PR-008 (confiança e outcome) + SEEDS S-16…S-25 + tipologia/vereditos no Signal Map | `executions/pr007…` · `pr008…` · SEEDS · AIL_SIGNAL_MAP |
| 3 | PR-009 (o ciclo da ADR) | `executions/pr009-evolution-report.md` |
| 4 | PR-010 (delegação, níveis 0–5, Lei da Abstenção) + S-26…S-32 | `executions/pr010…` · SEEDS |
| 5 | PR-011 (autoridade) + S-33…S-36 + backlog (pré-requisitos E4 + dívida `autor`) | `executions/pr011…` · SEEDS · BACKLOG |
| 6 | AR-001 + GLOSSARY + EVOLUTION Capítulos II/III | `AR-001-…` · `GLOSSARY.md` · `EVOLUTION.md` |

## Knowledge Integrity — achados e correções

- **Conhecimento dependente de memória de pessoas:** eliminado — os 5 ciclos
  agora têm arquivo canônico único cada.
- **Deriva de numeração corrigida:** em conversa, "S-32" fora usado ora para
  Rollback Decision ora para a lacuna de assinatura; canonizado: assinatura =
  S-30 (Delegation Audit) + S-35/S-36; Rollback Decision = S-32.
- **Duplicidade conhecida e registrada (não resolvida):** `autor` em dois
  modelos (Journal × fundação E5.1) — resolução pertence ao ciclo E5.1.
- **Órfãos:** nenhum — cada descoberta tem documento; o glossário aponta as
  duas raízes de docs e seus escopos.

## Backlog — separação dos grupos (Parte 8)

**Conhecimento** vive em SEEDS/reports/AR-001 (nunca no backlog).
**Implementação** vive nos EPICs (E3.1.1, E4.1, E4.2 + nova E4.2.3 `autor`).
**Pesquisa futura** vive como pré-requisito declarado ou seed congelada (decay,
Knowledge Source, persistir vendas) — nenhum item de backlog "mistura" os três.

## Critério de sucesso

**Após esta consolidação, o conhecimento PR-007→AR-001 está preservado
permanentemente?** Sim — condicionado a dois merges: `eng/pr-006-learning-loop`
(base) e esta branch. Após os merges, **nenhum conhecimento aceito depende mais
desta conversa**: um engenheiro novo encontra a AIL nas RFCs+ADR, o programa em
`docs/engineering/`, a narrativa no EVOLUTION, as ambiguidades no GLOSSARY.

## Reflection

**Quando uma descoberta deixa de ser ideia e vira arquitetura oficial?** A
evidência deste programa responde com precisão operacional: quando ela
sobrevive a três portas — **evidência** (nasceu de código/documento citável, não
de opinião), **aprovação** (o mantenedor a aceitou), e **commit** (existe em
arquivo canônico único, versionado). O ADR-001 provou que as duas primeiras sem
a terceira são um estado frágil: por cinco ciclos, a decisão mais importante do
Capítulo II existiu apenas como conversa. *Discover Once, Document Forever.*
