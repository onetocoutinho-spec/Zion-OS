# 008 — CSS Generator

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [007 — Validator](007-validator.md) · [005 — IR](005-intermediate-representation.md) · [system/004 · §15.5](../product/system/004-design-tokens.md)

---

## Purpose

Materializar a IR validada em **CSS** — um dos alvos que o [system/004](../product/system/004-design-tokens.md) nomeia. O Generator **traduz**; **MUST NOT** decidir Valor, Matéria ou Escopo — tudo isso já está na IR.

## Scope

Este documento **SHALL** definir a projeção IR → CSS. Ele **MUST NOT** reintroduzir classificação nem resolver Referência (já resolvida em [005](005-intermediate-representation.md)).

## Input

- **IR validada** ([007](007-validator.md)), apta (sem `error`).

## Output

- **CSS:** artefato que expressa, por Contexto, o Valor resolvido de cada Token, com o nome do Símbolo transcrito para o dialeto CSS ([system/004 · §15.5](../product/system/004-design-tokens.md), "conforme o idioma do alvo").

## Responsibilities

1. **Projeção de nome** — transcrever cada Símbolo para o dialeto CSS de forma **determinística e bidirecional** ([§15.5](../product/system/004-design-tokens.md)).
2. **Projeção por Contexto** — emitir o Valor resolvido de cada Token sob cada Contexto ([005](005-intermediate-representation.md)).
3. **Tratamento de Incompletude** — um Token Incompleto sob um Contexto **MUST NOT** ser emitido com Valor inventado; **SHALL** ser omitido e acompanhado do Diagnostic `resolution.incomplete` já existente.

## Constraints

- **MUST NOT** emitir Token que a IR não contém ([Ontologia · P3](../product/system/000-ontologia-normativa.md)).
- **MUST NOT** alterar Valor resolvido.
- A transcrição de nome **MUST** ser reversível ([§15.5](../product/system/004-design-tokens.md)).

## Determinism

A geração **SHALL** ser função pura da IR validada: mesma IR → mesmo CSS, byte a byte ([001 · Determinism](001-compiler-architecture.md#determinism)). A ordem de emissão **SHALL** ser total, derivada do Símbolo.

## Diagnostics

Este Generator **MUST NOT** originar Diagnostics de classificação; **SHALL** apenas propagar `resolution.incomplete` para Tokens não emitidos. Erro de projeção irreversível de nome **SHALL** emitir `validation.redundancy` somente se dois Símbolos colidirem no dialeto — condição herdada, não nova.

## Invariants

1. **Cobertura** — todo Token Completo da IR aparece no CSS.
2. **Fidelidade de Valor** — o Valor emitido é exatamente o resolvido.
3. **Nome reversível** ([§15.5](../product/system/004-design-tokens.md)).
4. **Incompleto omitido, nunca falseado.**

## Acceptance Criteria

- [ ] Todo Token Completo é emitido; todo Incompleto é omitido com Diagnostic.
- [ ] A transcrição de nome é reversível para o dialeto CSS.
- [ ] Mesma IR → mesmo CSS.
- [ ] Nenhuma referência quebrada.

## Change Policy

Este documento **SHALL** mudar apenas se o alvo CSS deixar de ser nomeado por [system/004](../product/system/004-design-tokens.md) ou se [§15.5](../product/system/004-design-tokens.md) mudar ([001 · Change Policy](001-compiler-architecture.md#change-policy)).
