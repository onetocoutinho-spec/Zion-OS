# 010 — TypeScript Generator

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [007 — Validator](007-validator.md) · [005 — IR](005-intermediate-representation.md) · [system/004 · §15.5](../product/system/004-design-tokens.md)

---

## Purpose

Materializar a IR validada em **TypeScript** — tipos e valores fortemente tipados dos Tokens, um dos alvos que o [system/004](../product/system/004-design-tokens.md) nomeia. O Generator **traduz**; **MUST NOT** decidir Valor, Matéria ou Escopo.

## Scope

Este documento **SHALL** definir a projeção IR → TypeScript. Ele **MUST NOT** reintroduzir classificação nem resolver Referência.

## Input

- **IR validada** ([007](007-validator.md)), apta (sem `error`).

## Output

- **TypeScript:** tipos que refletem a Matéria e a Espécie de cada Token e valores que refletem o Conteúdo resolvido por Contexto, com nomes transcritos ([§15.5](../product/system/004-design-tokens.md)).

## Responsibilities

1. **Projeção de tipo** — refletir Matéria/Espécie/Escopo da IR na forma de tipos; **MUST NOT** inventar tipo sem correspondência na IR.
2. **Projeção de valor** — emitir o Valor resolvido por Contexto ([005](005-intermediate-representation.md)).
3. **Projeção de nome** — transcrever cada Símbolo, determinística e reversível ([§15.5](../product/system/004-design-tokens.md)).
4. **Tratamento de Incompletude** — Token Incompleto **SHALL** ser tipado como tal (ausência de Valor) e nunca receber Valor inventado; propagar `resolution.incomplete`.

## Constraints

- **MUST NOT** emitir Token ausente da IR; **MUST NOT** alterar Valor; o tipo **MUST** derivar da classificação da IR, nunca de suposição.

## Determinism

Função pura da IR validada: mesma IR → mesmo TypeScript, byte a byte ([001](001-compiler-architecture.md#determinism)); ordem total derivada do Símbolo.

## Diagnostics

**SHALL** propagar `resolution.incomplete`; **MUST NOT** originar Diagnostics de classificação.

## Invariants

1. **Forte tipagem** — todo Token tem tipo derivado da sua Matéria/Espécie. 2. **Fidelidade de Valor.** 3. **Nome reversível.** 4. **Incompleto tipado como sem Valor, nunca falseado.**

## Acceptance Criteria

- [ ] Cada tipo deriva da classificação da IR.
- [ ] Incompleto é tipado sem Valor, com Diagnostic.
- [ ] Mesma IR → mesmo TypeScript.
- [ ] Nenhuma referência quebrada.

## Change Policy

**SHALL** mudar apenas se o alvo TypeScript deixar de ser nomeado por [system/004](../product/system/004-design-tokens.md) ou se [§15.5](../product/system/004-design-tokens.md) mudar ([001 · Change Policy](001-compiler-architecture.md#change-policy)).
