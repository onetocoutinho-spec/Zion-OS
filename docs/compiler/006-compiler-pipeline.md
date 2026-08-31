# 006 — Compiler Pipeline

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [001](001-compiler-architecture.md) · [002](002-lexical-analysis.md) · [003](003-ast.md) · [004](004-semantic-analysis.md) · [005](005-intermediate-representation.md) · [007](007-validator.md)

---

## Purpose

Definir a **orquestração** determinística das fases: como a Source atravessa Lexer → Parser → Semantic → IR → Validator, e como os Diagnostics se propagam. Esta orquestração **MUST NOT** conter lógica de fase; ela apenas as compõe na ordem do DAG ([001 · Invariants](001-compiler-architecture.md#invariants)).

## Scope

Este documento **SHALL** definir a ordem das passagens, a política de propagação de erro e a fronteira com os Generators (008–013). Ele **MUST NOT** redefinir o comportamento de nenhuma fase.

## Input

- **Source** abstrata ([001 · Constraints](001-compiler-architecture.md#constraints)).

## Output

- **IR validada** ([007](007-validator.md)) + o conjunto ordenado de **Diagnostics** de todas as fases. A partir daqui, os Generators consomem a IR validada.

## Responsibilities

1. **Ordem de passagem** — executar as fases estritamente na ordem `002 → 003 → 004 → 005 → 007`.
2. **Propagação de Diagnostics** — acumular os Diagnostics de todas as fases numa coleção única e ordenada por Source Position.
3. **Política de barreira** — uma fase com Diagnostic de severidade `error` **SHALL** impedir a entrada dos Generators; Diagnostics `warning` (ex.: Incompletude) **MUST NOT** bloquear, mas **SHALL** ser propagados aos Generators para tratamento contratual.
4. **Fronteira de geração** — expor a IR validada aos Generators sem transformação adicional.

## Constraints

- A orquestração **MUST NOT** reordenar, saltar ou paralelizar fases de modo que altere o resultado; qualquer paralelismo **SHALL** ser observacionalmente idêntico à ordem serial.
- Nenhuma fase posterior **MUST** iniciar antes de a anterior concluir para um dado Token ([001 · Invariants — DAG](001-compiler-architecture.md#invariants)).
- O pipeline **MUST NOT** conter conhecimento de plataforma-alvo — isso é dos Generators.

## Determinism

O pipeline **SHALL** ser função pura da Source: mesma Source → mesma IR validada e mesma coleção de Diagnostics, na mesma ordem ([001 · Determinism](001-compiler-architecture.md#determinism)).

## Diagnostics

O pipeline **MUST NOT** originar Diagnostics próprios; ele **SHALL** apenas coletar e ordenar os das fases 002, 003, 004, 005 e 007. A ordenação **SHALL** ser por Source Position, então por código.

## Invariants

1. **Ordem do DAG respeitada** ([001 · Invariants](001-compiler-architecture.md#invariants)).
2. **Coleção de Diagnostics total e ordenada.**
3. **Barreira por `error`** — Generators só correm sobre IR sem `error`.
4. **Sem lógica de fase** — o pipeline compõe, não computa.

## Acceptance Criteria

- [ ] A ordem 002→003→004→005→007 é executada e verificável.
- [ ] Diagnostics de todas as fases aparecem, ordenados por Source Position.
- [ ] `error` bloqueia Generators; `warning` não.
- [ ] Mesma Source → mesma saída e mesmos Diagnostics.
- [ ] Nenhuma referência quebrada.

## Change Policy

Este documento **SHALL** mudar apenas se o grafo de fases de [001](001-compiler-architecture.md) mudar ([001 · Change Policy](001-compiler-architecture.md#change-policy)).
