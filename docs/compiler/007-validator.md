# 007 — Validator

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [005 — Intermediate Representation](005-intermediate-representation.md) · [Ontologia · Parte 7](../product/system/000-ontologia-normativa.md) · [system/004 — Parte C](../product/system/004-design-tokens.md)

---

## Purpose

Confrontar a IR com as **invariantes da Ontologia** ([Parte 7](../product/system/000-ontologia-normativa.md)) e com a taxonomia de **incompatibilidades** ([system/004 · Parte C](../product/system/004-design-tokens.md)), produzindo a **IR validada** e os Diagnostics correspondentes. O Validator **executa** as verificações já definidas; **MUST NOT** inventar critério de validação.

## Scope

Este documento **SHALL** definir as verificações sobre a IR. Ele **MUST NOT** transformar a IR (não altera Conteúdo, Matéria, Posição); apenas a aprova ou a acompanha de Diagnostics.

## Input

- **IR** de [005](005-intermediate-representation.md).

## Output

- **IR validada:** a mesma IR, marcada como apta (sem `error`) ou inapta (com `error`) à geração, acompanhada dos Diagnostics `validation` e `incompatibility`.

## Responsibilities

1. **Invariantes da Ontologia** — verificar, sobre a IR, as verificações da [Parte 7](../product/system/000-ontologia-normativa.md): ausência de ciclos, ausência de dependências para frente, alcançabilidade, ausência de ambiguidade e de redundância, e unicidade (uma Posição, uma Matéria, uma Espécie por Token).
2. **Incompatibilidades** — reconhecer as espécies de incompatibilidade catalogadas ([system/004 · Parte C](../product/system/004-design-tokens.md)) quando a IR as exibir, e reportá-las como Diagnostic `incompatibility` — **nunca** resolvê-las por invenção.
3. **Aptidão para geração** — marcar a IR apta se e somente se não houver `error`.

## Constraints

- O Validator **MUST NOT** corrigir a IR; a documentação vence, e uma violação é sempre Diagnostic, não correção ([001 · Constraints](001-compiler-architecture.md#constraints)).
- O Validator **MUST NOT** introduzir invariante ausente da [Parte 7](../product/system/000-ontologia-normativa.md) ou incompatibilidade ausente da [Parte C](../product/system/004-design-tokens.md).
- Incompletude ([5.5.1](../product/system/000-ontologia-normativa.md)) **MUST NOT**, por si só, ser `error`; a sua consequência é contratual em cada Generator.

## Determinism

A validação **SHALL** ser função pura da IR: mesma IR → mesmo veredito e mesmos Diagnostics ([001 · Determinism](001-compiler-architecture.md#determinism)).

## Diagnostics

Famílias `validation` e `incompatibility` ([001](001-compiler-architecture.md#contrato-partilhado--diagnostic)):

| Código | Origem congelada |
|---|---|
| `validation.cycle` | [Ontologia · Parte 7.1](../product/system/000-ontologia-normativa.md) |
| `validation.forward-dependency` | [Ontologia · Parte 7.2](../product/system/000-ontologia-normativa.md) |
| `validation.unreachable` | [Ontologia · Parte 7.3](../product/system/000-ontologia-normativa.md) |
| `validation.ambiguity` | [Ontologia · Parte 7.4](../product/system/000-ontologia-normativa.md) |
| `validation.redundancy` | [Ontologia · Parte 7.5](../product/system/000-ontologia-normativa.md) |
| `validation.multiplicity` | [Ontologia · Parte 7.7–7.9](../product/system/000-ontologia-normativa.md) (múltiplos predicados/efeitos/sujeitos) |
| `incompatibility.*` | uma espécie de [system/004 · Parte C](../product/system/004-design-tokens.md) |

## Invariants

1. **A IR não é alterada** — o Validator só a acompanha de Diagnostics.
2. **Toda verificação rastreia-se à [Parte 7](../product/system/000-ontologia-normativa.md) ou à [Parte C](../product/system/004-design-tokens.md).**
3. **Apta ⇔ sem `error`.**
4. **Incompletude não é `error` por si só.**

## Acceptance Criteria

- [ ] Cada verificação cita uma cláusula da [Parte 7](../product/system/000-ontologia-normativa.md) ou uma espécie da [Parte C](../product/system/004-design-tokens.md).
- [ ] O Validator nunca modifica a IR.
- [ ] IR com `error` é marcada inapta; sem `error`, apta.
- [ ] Mesma IR → mesmo veredito.
- [ ] Nenhuma referência quebrada.

## Change Policy

Este documento **SHALL** mudar apenas se a [Parte 7 da Ontologia](../product/system/000-ontologia-normativa.md) ou a [Parte C do system/004](../product/system/004-design-tokens.md) mudarem ([001 · Change Policy](001-compiler-architecture.md#change-policy)).
