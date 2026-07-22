# AR-001 — Constitution Consolidation

> **Architecture Review 001** · 2026-07-22 · Papel: Principal Software Architect
> Revisão de coerência de toda a arquitetura descoberta (PR-001 → PR-011).
> Veredito: **arquitetura consistente; um conflito em 22 ciclos, resolvido por
> ADR-001; evolução possível sem mudança estrutural.**

## O padrão arquitetural único

Toda a Zion converge para um único padrão, aplicado N vezes:

> **fatos imutáveis (append-only) → projeção pura → estado derivado**

Presente em: Detector (`decisoes → padroes`), ADR-001 (`ofertas × decisoes →
outcomes`), Migration Ledger (migrações → drift), diagnóstico v2. A Zion não tem
várias arquiteturas; tem uma.

## Os 12 invariantes extraídos (com fonte)

1. **Fatos nunca se apagam** — 022; suporte monotônico (004 §6.2); "esquecer não é apagar".
2. **Todo conhecimento é projeção recomputável de fatos** — 004 §7.3; ADR-001.
3. **Identidade nasce no domínio** — R-INF-001 (PK sem default: "falha alto").
4. **A AIL é aditiva e removível** — 005 §10 (validado em R-DJ-2).
5. **Captura jamais altera comportamento** — fire-and-forget nos 6 producers.
6. **Tenant é fronteira inviolável** — `empresa` em tudo; RLS deny-by-default (016).
7. **Dois gatilhos para autonomia** — 002 §7 (invariante) + trava humana (prática).
8. **Toda autoridade é emprestada, escopada e revogável** — PR-011.
9. **Contradição bloqueia graduação sem apagar história** — em_disputa (004 §4.4).
10. **Mudança conceitual exige ADR** — Freeze v1; exercido em ADR-001.
11. **Só decisões humanas ensinam** — vereditos ficam no domínio (PR-006/008).
12. **A evidência vence o plano** — exercido em PR-001, PR-006, E3.1.2.

## Proposta de estrutura — Zion Constitution

```
Preâmbulo — as 4 entidades (Decision, Pattern, Suggestion, Knowledge) + 002 §14
Art. I    MEMORY          fatos append-only                        (inv. 1, 6)
Art. II   LEARNING        conhecimento = projeção recomputável     (inv. 2, 9)
Art. III  CONFIDENCE      derivada, jamais atribuída               (004 §4.3, ADR-001)
Art. IV   EXPLAINABILITY  sem explicação derivável, não existe     (002 §8)
Art. V    GOVERNANCE      ADR para conceitos; evidência vence      (inv. 10, 12)
Art. VI   DELEGATION      Lei da Abstenção; níveis 0–5; 2 gatilhos (PR-010, inv. 7)
Art. VII  AUTHORITY       emprestada/escopada/revogável            (PR-011, inv. 8)
Art. VIII ACCOUNTABILITY  quem age, assina  ← ÚNICA LACUNA ABERTA  (S-30/S-35/S-36)
Art. IX   REVERSIBILITY   a inteligência é aditiva e removível     (005 §10)
Art. X    ISOLATION       o tenant é inviolável                    (inv. 6)
```

## Maturity Assessment

| Domínio | Nível |
|---|---|
| Quality Gate / Segurança RLS / Governança de migrações | **Institucionalizado** |
| Signal Capture / Learning Loops | **Consolidado** |
| Decision Journal + Pattern Detector | **Validado** (produção; base estatística mínima) |
| Confidence >Consistente · Outcomes · Delegation · Authority | **Descoberto** |
| Suggestion Engine | **Experimental (não iniciado; pré-requisitos declarados em E4)** |

## Revisões

**RFCs:** cadeia 001→005 limpa; um conflito (002×005) resolvido por ADR-001; duas
incompletudes **deliberadas** (decay 004 §6.4; memória da oferta → ADR-001);
nenhuma obsoleta (o §12 da 002 está datado — RFCs são documentos históricos, não
se editam). **ADRs:** ADR-001 válido, confirmado indiretamente por PR-010/011.
**Seeds:** 36, zero sem evidência; classificação no SEEDS.md.

## Lacunas registradas (nunca escondidas)

1. **Institucionalização** — resolvida por CR-001 (este lote de commits).
2. **Accountability** — o único artigo constitucional aberto: Decisions anônimas
   (S-36) + execuções do sistema sem assinatura (S-30); planta pronta dormindo
   (S-35).
3. **Medição** — vendas evaporam (S-24); confirmações descartadas (S-17).
4. **Tempo** — nenhuma regra lê `decidido_em` (decay deferido — honesto).
5. **Duas raízes de documentação** — `docs/engineering/` (programa) ×
   `docs/zion-os/engineering/` (RFCs/ADRs). Registrada; unificação é decisão
   futura de baixa urgência (o glossário aponta qual é qual).

## Veredito final

> A Zion **conceitualmente** já é um sistema operacional coerente para decisões
> organizacionais: memória, aprendizado, confiança, delegação e autoridade
> formam um todo sem contradições, regido por um padrão único e doze
> invariantes. A institucionalização (CR-001) fecha a distância entre o
> protótipo coerente e a constituição vigente.
