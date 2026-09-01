# 005 — Intermediate Representation

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [004 — Semantic Analysis](004-semantic-analysis.md) · [Ontologia · 5.1–5.5](../product/system/000-ontologia-normativa.md)

---

## Purpose

Transformar o Semantic Model na **IR** — o resultado da **Resolução** de cada Token sob cada Contexto. A IR é a mecanização de [Ontologia · 5.1 Resolução](../product/system/000-ontologia-normativa.md): substituir toda Referência pelo Conteúdo do Símbolo designado, até o Conteúdo terminal. A IR é a fronteira única entre o núcleo e todos os Generators (008–013).

## Scope

Esta fase **SHALL** produzir, para cada par Token × Contexto, o seu Conteúdo resolvido e a sua Completude. Ela **MUST NOT** aplicar invariantes de rejeição — isso é [007](007-validator.md) — nem emitir artefato de plataforma.

## Input

- **Semantic Model** de [004](004-semantic-analysis.md).

## Output

- **IR:** para cada Token × Contexto — o Conteúdo resolvido (Valor terminal, ou marca de Incompletude), a **Cadeia de Resolução** percorrida ([5.2](../product/system/000-ontologia-normativa.md)), as **Dependências** ([5.3](../product/system/000-ontologia-normativa.md)) e a **Completude** ([5.5](../product/system/000-ontologia-normativa.md)). A IR **SHALL** preservar Símbolo, Matéria, Posição, Escopo e Destinação do Semantic Model.

## Responsibilities

1. **Resolução** — para cada Token × Contexto, substituir Referência pelo Conteúdo do Símbolo designado ([5.1](../product/system/000-ontologia-normativa.md)), aplicando **Precedência** quando um Símbolo tem mais de um Conteúdo por Contexto ([5.4](../product/system/000-ontologia-normativa.md)).
2. **Cadeia de Resolução** — registrar a sequência de Tokens percorridos ([5.2](../product/system/000-ontologia-normativa.md)); a Cadeia é relativa ao par Token × Contexto ([Norma 5.2.1](../product/system/000-ontologia-normativa.md)).
3. **Completude** — marcar Completo se a Cadeia encerra em Valor, Incompleto caso contrário ([5.5, Norma 5.5.1](../product/system/000-ontologia-normativa.md)). Um Token Incompleto **SHALL** permanecer na IR — não é erro aqui.
4. **Dependências** — registrar a relação de Dependência entre Tokens ([5.3](../product/system/000-ontologia-normativa.md)).

## Constraints

- A Resolução **MUST** seguir 5.1 exatamente; **MUST NOT** inventar Valor para uma Cadeia que não encerra em Valor.
- A IR **MUST NOT** conter ciclo de Dependência ([Norma 5.3.1](../product/system/000-ontologia-normativa.md)) — um ciclo detectado é reportado (ver *Diagnostics*) e o Token afetado marcado Incompleto, nunca resolvido por suposição.
- A IR **MUST** ser relativa a Contexto: nenhum Conteúdo resolvido sem o seu Contexto.

## Determinism

A Resolução **SHALL** ser função pura do Semantic Model: mesmo modelo → mesma IR. A Precedência ([5.4](../product/system/000-ontologia-normativa.md)) **SHALL** eleger exatamente um Conteúdo por Contexto, tornando a Resolução total e determinística.

## Diagnostics

Família `resolution` ([001](001-compiler-architecture.md#contrato-partilhado--diagnostic)):

| Código | Condição (Ontologia) |
|---|---|
| `resolution.cycle` | ciclo de Dependência — viola [Norma 5.3.1](../product/system/000-ontologia-normativa.md) |
| `resolution.dangling-reference` | Referência a Símbolo não declarado ([P3](../product/system/000-ontologia-normativa.md)) |
| `resolution.incomplete` | Cadeia que não encerra em Valor sob um Contexto ([5.5.1](../product/system/000-ontologia-normativa.md)) — severidade `warning` |

## Invariants

1. **Resolução total por Contexto** — todo Token × Contexto tem um resultado (Valor ou Incompleto).
2. **Sem ciclos** ([5.3.1](../product/system/000-ontologia-normativa.md)).
3. **Incompleto existe** ([5.5.1](../product/system/000-ontologia-normativa.md)) — não é removido nem falseado.
4. **Cadeia relativa** ([5.2.1](../product/system/000-ontologia-normativa.md)) — não há cadeia única global.
5. **Preservação** — Símbolo, Matéria, Posição, Escopo e Destinação inalterados face a [004](004-semantic-analysis.md).

## Acceptance Criteria

- [ ] Cada Token × Contexto tem Conteúdo resolvido e Completude.
- [ ] Ciclos e Referências pendentes produzem Diagnostic `resolution`.
- [ ] Tokens Incompletos permanecem na IR, marcados, nunca falseados.
- [ ] Mesmo Semantic Model → mesma IR.
- [ ] Nenhuma referência quebrada.

## Change Policy

Esta fase **SHALL** mudar apenas se 5.1–5.5 da [Ontologia](../product/system/000-ontologia-normativa.md) mudarem ([001 · Change Policy](001-compiler-architecture.md#change-policy)).
