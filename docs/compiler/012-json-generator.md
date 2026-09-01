# 012 — JSON Generator

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [007 — Validator](007-validator.md) · [005 — IR](005-intermediate-representation.md) · [system/004 · §15.5](../product/system/004-design-tokens.md)

---

## Purpose

Materializar a IR validada em **JSON** — a forma de intercâmbio neutra dos Tokens, um dos alvos que o [system/004](../product/system/004-design-tokens.md) nomeia. O Generator **traduz**; **MUST NOT** decidir Valor, Matéria ou Escopo.

## Scope

Este documento **SHALL** definir a projeção IR → JSON. Ele **MUST NOT** reintroduzir classificação nem resolver Referência.

## Input

- **IR validada** ([007](007-validator.md)).

## Output

- **JSON:** representação estruturada de cada Token com Símbolo, Matéria, Posição, Espécie, Escopo, Completude, Destinação e Conteúdo resolvido por Contexto.

## Responsibilities

1. **Projeção estrutural** — refletir exatamente os atributos da IR.
2. **Projeção de nome** — transcrever o Símbolo, determinística e reversível ([§15.5](../product/system/004-design-tokens.md)).
3. **Tratamento de Incompletude** — representar a Incompletude explicitamente (campo marcado), **MUST NOT** emitir Valor inventado; propagar `resolution.incomplete`.

## Constraints

- **MUST NOT** emitir Token ausente da IR; **MUST NOT** alterar Valor; **MUST** produzir JSON com ordenação de chaves total e estável.

## Determinism

Função pura da IR validada: mesma IR → mesmo JSON, byte a byte, com chaves ordenadas ([001](001-compiler-architecture.md#determinism)).

## Diagnostics

**SHALL** propagar `resolution.incomplete`; **MUST NOT** originar Diagnostics de classificação.

## Invariants

1. **Fidelidade estrutural** — todos os atributos da IR presentes. 2. **Fidelidade de Valor.** 3. **Chaves ordenadas e estáveis.** 4. **Incompleto marcado, nunca falseado.**

## Acceptance Criteria

- [ ] Cada campo corresponde a um atributo da IR.
- [ ] Incompleto é marcado, com Diagnostic.
- [ ] Mesma IR → mesmo JSON (chaves ordenadas).
- [ ] Nenhuma referência quebrada.

## Change Policy

**SHALL** mudar apenas se o alvo JSON deixar de ser nomeado por [system/004](../product/system/004-design-tokens.md) ([001 · Change Policy](001-compiler-architecture.md#change-policy)).
