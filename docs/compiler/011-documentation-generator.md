# 011 — Documentation Generator

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [007 — Validator](007-validator.md) · [005 — IR](005-intermediate-representation.md) · [system/004 · §15.5](../product/system/004-design-tokens.md)

---

## Purpose

Materializar a IR validada em **Documentation** — a apresentação legível dos Tokens, um dos alvos que o [system/004](../product/system/004-design-tokens.md) nomeia. O Generator **traduz**; **MUST NOT** acrescentar significado ausente da IR.

## Scope

Este documento **SHALL** definir a projeção IR → Documentation. Ele **MUST NOT** reintroduzir classificação, resolver Referência, nem redigir prosa normativa nova — a autoridade é a IR e as suas fontes.

## Input

- **IR validada** ([007](007-validator.md)).

## Output

- **Documentation:** artefato legível que apresenta, por Token, o seu Símbolo (grafia de documentação, `.` — [§15.5](../product/system/004-design-tokens.md)), Matéria, Posição, Espécie, Escopo, Completude e Conteúdo resolvido por Contexto.

## Responsibilities

1. **Apresentação fiel** — expor exatamente os atributos da IR, sem interpretação.
2. **Grafia de documentação** — usar a face `.` do Símbolo ([§15.5](../product/system/004-design-tokens.md)).
3. **Tratamento de Incompletude** — marcar o Token Incompleto **como** Incompleto ([5.5.1](../product/system/000-ontologia-normativa.md)); a Incompletude é um estado a exibir, nunca um vazio a preencher.

## Constraints

- **MUST NOT** adicionar Token, atributo ou prosa que a IR e as suas fontes não sustentem ([P3](../product/system/000-ontologia-normativa.md)).
- **MUST NOT** contradizer [system/004](../product/system/004-design-tokens.md).

## Determinism

Função pura da IR validada: mesma IR → mesma Documentation, byte a byte ([001](001-compiler-architecture.md#determinism)); ordem total derivada do Símbolo.

## Diagnostics

**SHALL** propagar `resolution.incomplete` como marca de exibição; **MUST NOT** originar Diagnostics de classificação.

## Invariants

1. **Fidelidade** — nada exibido além do que a IR contém. 2. **Grafia `.`** ([§15.5](../product/system/004-design-tokens.md)). 3. **Incompleto exibido como estado.** 4. **Sem prosa normativa nova.**

## Acceptance Criteria

- [ ] Cada atributo exibido existe na IR.
- [ ] Incompleto é exibido como estado, nunca preenchido.
- [ ] Mesma IR → mesma Documentation.
- [ ] Nenhuma referência quebrada.

## Change Policy

**SHALL** mudar apenas se o alvo Documentation deixar de ser nomeado por [system/004](../product/system/004-design-tokens.md) ([001 · Change Policy](001-compiler-architecture.md#change-policy)).
