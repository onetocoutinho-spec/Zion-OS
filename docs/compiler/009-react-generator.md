# 009 — React Generator

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [007 — Validator](007-validator.md) · [005 — IR](005-intermediate-representation.md) · [system/004 · §15.5](../product/system/004-design-tokens.md)

---

## Purpose

Materializar a IR validada em **React** — um dos alvos que o [system/004](../product/system/004-design-tokens.md) nomeia. O Generator **traduz**; **MUST NOT** decidir Valor, Matéria ou Escopo.

## Scope

Este documento **SHALL** definir a projeção IR → React. Ele **MUST NOT** reintroduzir classificação, resolver Referência, nem definir componentes de UI (isso é do [Component Catalog](../product/blueprints/004-component-catalog.md), fora deste pilar).

## Input

- **IR validada** ([007](007-validator.md)), apta (sem `error`).

## Output

- **React:** artefato que expõe, por Contexto, o Valor resolvido de cada Token, com o nome do Símbolo transcrito para o dialeto React/TS ([system/004 · §15.5](../product/system/004-design-tokens.md)).

## Responsibilities

1. **Projeção de nome** — transcrever cada Símbolo para o dialeto do alvo, determinística e reversível ([§15.5](../product/system/004-design-tokens.md)).
2. **Projeção por Contexto** — expor o Valor resolvido de cada Token sob cada Contexto ([005](005-intermediate-representation.md)).
3. **Tratamento de Incompletude** — Token Incompleto **MUST NOT** ser exposto com Valor inventado; **SHALL** ser omitido com `resolution.incomplete`.

## Constraints

- **MUST NOT** emitir Token ausente da IR ([P3](../product/system/000-ontologia-normativa.md)); **MUST NOT** alterar Valor; **MUST NOT** definir comportamento de componente.

## Determinism

Função pura da IR validada: mesma IR → mesmo artefato React, byte a byte ([001](001-compiler-architecture.md#determinism)); ordem total derivada do Símbolo.

## Diagnostics

**MUST NOT** originar Diagnostics de classificação; **SHALL** propagar `resolution.incomplete` para Tokens omitidos e `validation.redundancy` apenas em colisão de nome no dialeto (herdada).

## Invariants

1. **Cobertura** de todo Token Completo. 2. **Fidelidade de Valor.** 3. **Nome reversível** ([§15.5](../product/system/004-design-tokens.md)). 4. **Incompleto omitido, nunca falseado.**

## Acceptance Criteria

- [ ] Todo Token Completo exposto; todo Incompleto omitido com Diagnostic.
- [ ] Transcrição reversível para o dialeto React/TS.
- [ ] Mesma IR → mesmo artefato.
- [ ] Nenhuma referência quebrada.

## Change Policy

**SHALL** mudar apenas se o alvo React deixar de ser nomeado por [system/004](../product/system/004-design-tokens.md) ou se [§15.5](../product/system/004-design-tokens.md) mudar ([001 · Change Policy](001-compiler-architecture.md#change-policy)).
