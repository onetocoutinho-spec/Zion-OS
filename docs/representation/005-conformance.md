# 005 — Conformance

**Status:** Proposed
**Owner:** Representation Engineering (Zion)
**Depends On:** [001 — Representation Model](001-representation-model.md) · [002 — Projection Rules](002-projection-rules.md) · [004 — Round-trip](004-round-trip.md)

---

## Purpose

Definir como se **verifica** que uma representação é uma **projeção fiel** do [Modelo (001)](001-representation-model.md): os critérios de conformidade e o veredito. A conformidade é de **especificação**, independente de formato e de implementação.

## Scope

Este documento **SHALL** definir os critérios e o veredito de conformidade de uma representação. Ele **MUST NOT** verificar semântica (Posição/Matéria/Escopo/Completude) — isso é do Compiler ([Validator 007](../compiler/007-validator.md)) — nem definir formato.

## Definitions

- **Projeção fiel** — uma representação que satisfaz Fidelidade ([001](001-representation-model.md#invariants)), as Regras de Projeção ([002](002-projection-rules.md#invariants)) e o Round-trip ([004](004-round-trip.md#invariants)).
- **Veredito** — `conforme` ou `não-conforme`, com a lista de critérios violados.

## Responsibilities

1. **Fidelidade** — verificar que todos os fatos primários estão presentes, nenhum estranho, nenhum derivado ([001 · Diagnostics](001-representation-model.md#diagnostics)).
2. **Projeção** — verificar Totalidade, Injetividade e Reversibilidade ([002 · Diagnostics](002-projection-rules.md#diagnostics)).
3. **Round-trip** — verificar a identidade sobre os fatos primários ([004 · Diagnostics](004-round-trip.md#diagnostics)).
4. **Determinismo** — verificar que os mesmos fatos primários produzem sempre a mesma representação na ordem canônica.
5. **Veredito** — declarar `conforme` **se e somente se** os quatro critérios se cumprem.

## Constraints

- A conformidade **MUST NOT** testar semântica; essa é do [Compiler · Validator 007](../compiler/007-validator.md) e certificada pelo [Compiler · Testing 017](../compiler/017-testing-certification.md).
- A conformidade **MUST NOT** exigir nada além de [001](001-representation-model.md), [002](002-projection-rules.md) e [004](004-round-trip.md).
- A conformidade **MUST NOT** depender de formato nem da estrutura interna do Compiler.

## Diagnostics

Este documento **SHALL** agregar os diagnósticos de [001](001-representation-model.md#diagnostics), [002](002-projection-rules.md#diagnostics) e [004](004-round-trip.md#diagnostics); o seu resultado próprio é o **veredito**. Uma falha **SHALL** citar o critério e o documento violado.

## Determinism

O veredito **SHALL** ser função pura de (representação, fatos primários): a mesma entrada produz sempre o mesmo veredito ([004 · Determinism](004-round-trip.md#determinism)).

## Invariants

1. **`conforme` ⇔** Fidelidade **e** Projeção **e** Round-trip **e** Determinismo.
2. **Sem semântica** — nenhum critério verifica fato derivado.
3. **Sem requisito novo** — todo critério rastreia-se a [001](001-representation-model.md)/[002](002-projection-rules.md)/[004](004-round-trip.md).

## Acceptance Criteria

- [ ] Os quatro critérios são verificáveis e citam o seu documento.
- [ ] O veredito é `conforme` só quando todos passam.
- [ ] Nenhum critério verifica semântica.
- [ ] A certificação da implementação é atribuída ao [Compiler · Testing 017](../compiler/017-testing-certification.md), não a este pilar.
- [ ] Nenhuma referência quebrada.

## Change Policy

Este documento **SHALL** mudar apenas se [001](001-representation-model.md), [002](002-projection-rules.md) ou [004](004-round-trip.md) mudarem. Uma mudança na forma como o Compiler certifica a sua implementação **MUST NOT** obrigar mudança aqui.
