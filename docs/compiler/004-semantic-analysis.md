# 004 — Semantic Analysis

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [003 — AST](003-ast.md) · [Ontologia · Partes 1–6](../product/system/000-ontologia-normativa.md) · [system/004 — Design Tokens](../product/system/004-design-tokens.md)

---

## Purpose

Transformar a AST num **Semantic Model** — a AST enriquecida com a classificação da Ontologia: para cada Token, a sua **Posição**, **Matéria**, **Espécie**, **Escopo** e **Destinação**. Esta fase **executa** a classificação já definida ([Ontologia · Partes 3–6](../product/system/000-ontologia-normativa.md)); **MUST NOT** definir critério novo de classificação.

## Scope

Esta fase **SHALL** atribuir e verificar a classificação ontológica de cada Token. Ela **MUST NOT** resolver Referências em Valor terminal — isso é [005](005-intermediate-representation.md) — nem gerar artefato.

## Input

- **AST** de [003](003-ast.md).

## Output

- **Semantic Model:** cada nó Declaration anotado com `Posição`, `Matéria`, `Espécie`, `Escopo`, `Destinação`, mais a Source Position herdada. O modelo **SHALL** ser total: todo Token classificado em cada atributo.

## Responsibilities

1. **Posição** — atribuir mecanicamente por [Ontologia · T2](../product/system/000-ontologia-normativa.md): Foundation (Content sem Referência e sem Destinação), Semantic (com Referência, sem Destinação), Component (com Destinação). A atribuição **SHALL** avaliar o Token inteiro ([T2.1](../product/system/000-ontologia-normativa.md), domínio Token): basta um Contexto com Referência para a Posição ser Semantic.
2. **Matéria** — atribuir pela espécie de objeto que o Content determina ([Ontologia · D4](../product/system/000-ontologia-normativa.md)), nunca pelo prefixo do Símbolo; verificar disjunção ([D4.1](../product/system/000-ontologia-normativa.md)) e unicidade ([T9.1](../product/system/000-ontologia-normativa.md)).
3. **Espécie** — atribuir exatamente uma das seis ([Ontologia · Parte 4, Norma 4.0](../product/system/000-ontologia-normativa.md)).
4. **Escopo** — atribuir `universal` ou `domínio Zion` pela [Norma 6.3.1](../product/system/000-ontologia-normativa.md) (remoção hipotética das Declarações da Zion); qualifica o Símbolo, nunca o Valor.
5. **Destinação** — atribuir o Consumidor único de um Component Token ([Ontologia · D3](../product/system/000-ontologia-normativa.md)), ou nenhum.

## Constraints

- Esta fase **MUST NOT** introduzir Matéria, Posição ou Espécie ausente da [Ontologia](../product/system/000-ontologia-normativa.md); uma Matéria nova só é válida se **instanciar D4** com objeto disjunto ([Norma T9.2](../product/system/000-ontologia-normativa.md)).
- A classificação **MUST** ser mecânica e determinística; **MUST NOT** depender de intenção, exemplo ou justificativa.
- Esta fase **MUST NOT** eleger Valor nem resolver Referência.

## Determinism

A classificação **SHALL** ser função pura da AST: mesma AST → mesmo Semantic Model. Toda regra é mecânica ([Ontologia · Partes 3–6](../product/system/000-ontologia-normativa.md)); não há escolha dependente de contexto de execução.

## Diagnostics

Família `semantic` ([001](001-compiler-architecture.md#contrato-partilhado--diagnostic)):

| Código | Condição (Ontologia) |
|---|---|
| `semantic.multiple-materia` | Token com duas Matérias — viola [T9.1](../product/system/000-ontologia-normativa.md) |
| `semantic.materia-collision` | duas Matérias com o mesmo objeto — viola [D4.1](../product/system/000-ontologia-normativa.md) |
| `semantic.multiple-especie` | Content com mais de uma Espécie — viola [Norma 4.0](../product/system/000-ontologia-normativa.md) |
| `semantic.invalid-position` | Content cuja forma não deriva uma Posição única — viola [T2.1](../product/system/000-ontologia-normativa.md) |
| `semantic.scope-by-value` | Escopo atribuído pelo Valor e não pelo Símbolo — viola [6.3.1](../product/system/000-ontologia-normativa.md) |

## Invariants

1. **Exatamente uma Posição e uma Matéria por Token** ([T9.1, T2.1](../product/system/000-ontologia-normativa.md)).
2. **Exatamente uma Espécie por Content** ([Norma 4.0](../product/system/000-ontologia-normativa.md)).
3. **Matéria por objeto, não por prefixo** ([D4](../product/system/000-ontologia-normativa.md)).
4. **Escopo qualifica o Símbolo** ([6.1](../product/system/000-ontologia-normativa.md)).
5. **Sem resolução** — nenhum Valor terminal produzido aqui.

## Acceptance Criteria

- [ ] Todo Token recebe Posição, Matéria, Espécie, Escopo e Destinação.
- [ ] Toda regra de atribuição cita uma norma da [Ontologia · Partes 3–6](../product/system/000-ontologia-normativa.md).
- [ ] Violações produzem Diagnostic `semantic` rastreável.
- [ ] Mesma AST → mesmo Semantic Model.
- [ ] Nenhuma referência quebrada.

## Change Policy

Esta fase **SHALL** mudar apenas se as Partes 3–6 da [Ontologia](../product/system/000-ontologia-normativa.md) mudarem. Nenhum critério de classificação novo **MUST** ser introduzido aqui ([001 · Change Policy](001-compiler-architecture.md#change-policy)).
