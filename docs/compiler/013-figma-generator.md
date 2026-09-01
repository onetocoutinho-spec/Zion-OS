# 013 — Figma Generator

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [007 — Validator](007-validator.md) · [005 — IR](005-intermediate-representation.md) · [system/004 · §15.5](../product/system/004-design-tokens.md)

---

## Purpose

Materializar a IR validada em **Figma Variables** — um dos alvos que o [system/004](../product/system/004-design-tokens.md) nomeia. É o alvo cuja grafia usa a face `/` do Símbolo ([§15.5](../product/system/004-design-tokens.md)). O Generator **traduz**; **MUST NOT** decidir Valor, Matéria ou Escopo.

## Scope

Este documento **SHALL** definir a projeção IR → Figma Variables. Ele **MUST NOT** reintroduzir classificação nem resolver Referência.

## Input

- **IR validada** ([007](007-validator.md)).

## Output

- **Figma Variables:** cada Token como variável, com nome na face `/` ([§15.5](../product/system/004-design-tokens.md)) e um modo por Contexto ([system/004 · §5.6](../product/system/004-design-tokens.md)) portando o Valor resolvido.

## Responsibilities

1. **Projeção de nome** — transcrever o Símbolo para a face `/`, determinística e reversível ([§15.5](../product/system/004-design-tokens.md)); `a.b.c` ⇄ `a/b/c` é o **mesmo** Símbolo.
2. **Projeção de modo** — mapear cada Contexto para um modo Figma ([§5.6](../product/system/004-design-tokens.md)).
3. **Tratamento de Incompletude** — Token Incompleto sob um Contexto **MUST NOT** receber Valor inventado no modo; **SHALL** ser omitido com `resolution.incomplete`.

## Constraints

- **MUST NOT** emitir Token ausente da IR; **MUST NOT** alterar Valor.
- A face `/` **MUST** ser reversível para a face `.` ([§15.5](../product/system/004-design-tokens.md)); a transcrição é 1:1, nunca renomeação.

## Determinism

Função pura da IR validada: mesma IR → mesmas Variables, byte a byte ([001](001-compiler-architecture.md#determinism)); ordem total derivada do Símbolo.

## Diagnostics

**SHALL** propagar `resolution.incomplete`; **MUST NOT** originar Diagnostics de classificação.

## Invariants

1. **Cobertura** de todo Token Completo. 2. **Nome na face `/`, reversível** ([§15.5](../product/system/004-design-tokens.md)). 3. **Um modo por Contexto** ([§5.6](../product/system/004-design-tokens.md)). 4. **Incompleto omitido, nunca falseado.**

## Acceptance Criteria

- [ ] Cada Símbolo aparece na face `/`, reversível para `.`.
- [ ] Cada Contexto é um modo; Incompleto omitido com Diagnostic.
- [ ] Mesma IR → mesmas Variables.
- [ ] Nenhuma referência quebrada.

## Change Policy

**SHALL** mudar apenas se o alvo Figma deixar de ser nomeado por [system/004](../product/system/004-design-tokens.md) ou se [§15.5](../product/system/004-design-tokens.md)/[§5.6](../product/system/004-design-tokens.md) mudarem ([001 · Change Policy](001-compiler-architecture.md#change-policy)).
