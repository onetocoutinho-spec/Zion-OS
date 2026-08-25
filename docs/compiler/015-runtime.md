# 015 — Runtime

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [005 — IR](005-intermediate-representation.md) · [Ontologia · 5.1 Resolução](../product/system/000-ontologia-normativa.md)

---

## Purpose

Definir o **Runtime** que resolve um Token sob um Contexto no momento do consumo — a aplicação viva da **Resolução** ([Ontologia · 5.1](../product/system/000-ontologia-normativa.md)) sobre a IR. O Runtime **executa** a Resolução já definida; **MUST NOT** classificar nem gerar.

## Scope

Este documento **SHALL** definir o contrato de resolução em tempo de consumo. Ele **MUST NOT** repetir a classificação ([004](004-semantic-analysis.md)) nem materializar alvos ([008–013](008-css-generator.md)).

## Input

- **IR** ([005](005-intermediate-representation.md)) e um pedido `(Símbolo, Contexto)`.

## Output

- O **Conteúdo resolvido** do Token sob o Contexto, ou a marca de **Incompletude** ([5.5.1](../product/system/000-ontologia-normativa.md)) quando a Cadeia não encerra em Valor.

## Responsibilities

1. **Resolução sob demanda** — para `(Símbolo, Contexto)`, retornar o Valor resolvido segundo [5.1](../product/system/000-ontologia-normativa.md), aplicando Precedência ([5.4](../product/system/000-ontologia-normativa.md)).
2. **Contexto vigente** — receber o Contexto como parâmetro do pedido; o Runtime **MUST NOT** eleger Contexto por conta própria (a eleição de Contexto é externa e ainda não especificada — ver *Constraints*).
3. **Incompletude** — retornar a marca de Incompletude, nunca um Valor inventado.

## Constraints

- O Runtime **MUST NOT** resolver contra uma Cadeia com ciclo ([5.3.1](../product/system/000-ontologia-normativa.md)); tal IR não deveria chegar apta ([007](007-validator.md)).
- O Runtime **MUST NOT** eleger, persistir ou trocar Contexto — a *Eleição de Contexto* é uma incompatibilidade registrada ([system/004 · Parte C](../product/system/004-design-tokens.md)) e pertence a quem chama, não ao Runtime.
- O Runtime **MUST NOT** materializar alvo nem alterar a IR.

## Determinism

A resolução **SHALL** ser função pura de (IR, Símbolo, Contexto): mesmo pedido → mesmo resultado ([001 · Determinism](001-compiler-architecture.md#determinism)).

## Diagnostics

O Runtime **SHALL** sinalizar `resolution.incomplete` ao retornar Incompletude e `resolution.dangling-reference` para Símbolo não presente na IR; **MUST NOT** originar Diagnostics de classificação.

## Invariants

1. **Resolução conforme 5.1** ([Ontologia](../product/system/000-ontologia-normativa.md)).
2. **Contexto é parâmetro, nunca decidido pelo Runtime.**
3. **Incompleto retornado como estado, nunca falseado.**
4. **Sem efeito colateral** sobre a IR.

## Acceptance Criteria

- [ ] `(Símbolo, Contexto)` retorna o Valor resolvido de [5.1](../product/system/000-ontologia-normativa.md).
- [ ] Incompletude é retornada como marca, com Diagnostic.
- [ ] O Runtime nunca elege Contexto.
- [ ] Mesmo pedido → mesmo resultado.
- [ ] Nenhuma referência quebrada.

## Change Policy

**SHALL** mudar apenas se [5.1–5.5 da Ontologia](../product/system/000-ontologia-normativa.md) mudarem ([001 · Change Policy](001-compiler-architecture.md#change-policy)).
