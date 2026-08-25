# 003 — Format Mapping

**Status:** Proposed
**Owner:** Representation Engineering (Zion)
**Depends On:** [001 — Representation Model](001-representation-model.md) · [002 — Projection Rules](002-projection-rules.md)

---

## Purpose

Definir como uma projeção ([002](002-projection-rules.md)) **se liga** a uma forma externa concreta, **delegando** a materialização do formato, para baixo, aos **Generators do Compiler**. Este pilar **não é autoridade sobre formato algum**; ele apenas fixa a ligação e exige que os invariantes do Modelo sejam preservados em qualquer formato.

## Scope

Este documento **SHALL** definir a relação entre a projeção e um formato, e a delegação da materialização. Ele **MUST NOT** definir a sintaxe de nenhum formato — nem de Markdown, JSON, YAML ou XML.

## Definitions

- **Ligação de formato** — a correspondência entre os elementos de projeção ([002](002-projection-rules.md)) e as construções de uma forma externa.
- **Generator (implementação)** — o componente do Compiler que **materializa** um formato: [011 Documentation](../compiler/011-documentation-generator.md), [012 JSON](../compiler/012-json-generator.md), e os demais [008–013](../compiler/008-css-generator.md).
- **Formato ilustrativo** — uma forma externa **sem** Generator (ex.: YAML, XML), apresentada **apenas como exemplo** de projeção.

## Responsibilities

1. **Delegação** — para um formato que possua Generator ([011](../compiler/011-documentation-generator.md), [012](../compiler/012-json-generator.md)), a materialização canônica **é** a saída desse Generator; este pilar **SHALL** delegar e **MUST NOT** redefini-la.
2. **Formato ilustrativo** — para um formato sem Generator, a ligação **SHALL** ser apresentada **apenas como exemplo não-normativo**; nenhum formato é definido aqui como norma ([decisão 5](README.md)).
3. **Preservação de invariantes** — qualquer ligação, com ou sem Generator, **SHALL** preservar Totalidade, Injetividade, Reversibilidade e Ordem canônica ([002 · Invariants](002-projection-rules.md#invariants)).

> **Exemplo não-normativo (formato sem Generator).** Os mesmos fatos primários `(Símbolo, Contexto→Conteúdo)` podem ser ilustrados numa forma chave-valor aninhada. A ilustração serve só para mostrar que a projeção é possível e reversível; ela **não** define YAML nem XML e **não** é norma.

## Constraints

- Este pilar **MUST NOT** definir a sintaxe, a gramática ou a serialização de nenhum formato.
- Uma ligação **MUST NOT** contradizer o Generator correspondente do Compiler ([008–013](../compiler/008-css-generator.md)).
- Uma ligação **MUST NOT** introduzir fato derivado nem semântica ([001](001-representation-model.md)).

## Diagnostics

| Código | Condição |
|---|---|
| `mapping.format-defined-normatively` | tentativa de definir um formato como norma neste pilar |
| `mapping.generator-contradiction` | ligação que contradiz um [Generator do Compiler](../compiler/008-css-generator.md) |
| `mapping.invariant-broken` | ligação que quebra um invariante de [002](002-projection-rules.md#invariants) |

## Determinism

Dada uma projeção e um Generator, a materialização **SHALL** ser determinística — garantia herdada do próprio Generator ([Compiler 001 · Determinism](../compiler/001-compiler-architecture.md#determinism)) e da ordem canônica de [002](002-projection-rules.md).

## Invariants

1. **Nenhum formato é definido aqui** — a autoridade do formato é do Generator (implementação).
2. **Sem contradição** com os Generators do Compiler.
3. **Invariantes de projeção preservados** em qualquer formato.
4. **Formatos sem Generator são apenas ilustração.**

## Acceptance Criteria

- [ ] Nenhum formato é definido normativamente.
- [ ] Formatos com Generator delegam a materialização a ele.
- [ ] Formatos sem Generator aparecem só como exemplo.
- [ ] Nenhuma ligação contradiz um Generator.
- [ ] Nenhuma referência quebrada.

## Change Policy

Este documento **SHALL** mudar apenas se o [Modelo (001)](001-representation-model.md) ou as [Regras (002)](002-projection-rules.md) mudarem. Uma mudança num Generator do Compiler **MUST NOT** obrigar mudança aqui além da delegação; este pilar não segue a estrutura interna do Compiler.
