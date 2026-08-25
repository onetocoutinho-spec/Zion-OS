# 001 — Representation Model

**Status:** Proposed
**Owner:** Representation Engineering (Zion)
**Depends On:** [Ontologia · P1, P2, P3, P4, D1, D2, D3, P6](../product/system/000-ontologia-normativa.md)

---

## Purpose

Definir o **Modelo de Representação**: a superfície de **fatos primários** da Ontologia que qualquer representação externa deve carregar, e apenas ela. O Modelo é derivado **diretamente da Ontologia** e é **independente de formato** e **independente de implementação**. Ele **MUST NOT** carregar fato derivado algum.

## Scope

Este documento **SHALL** definir os fatos primários e as invariantes de qualquer representação. Ele **MUST NOT** definir formato concreto (isso é ilustração em [003](003-format-mapping.md)), **MUST NOT** definir regras de projeção (isso é [002](002-projection-rules.md)), e **MUST NOT** antecipar qualquer inferência semântica (Posição, Matéria, Espécie, Escopo, Completude) — essas são reconstruídas pelo Compiler.

## Definitions

- **Fato primário** — o que uma Declaração institui ([P3](../product/system/000-ontologia-normativa.md)): um Conteúdo ([D1](../product/system/000-ontologia-normativa.md)) para um Símbolo ([P1](../product/system/000-ontologia-normativa.md)) sob um Contexto ([P4](../product/system/000-ontologia-normativa.md)). Nada além disto é primário.
- **Fato derivado** — Posição, Matéria, Espécie, Escopo, Completude: propriedades que **decorrem** dos fatos primários e são reconstruídas pelo Compiler ([Semantic 004](../compiler/004-semantic-analysis.md) → [IR 005](../compiler/005-intermediate-representation.md)). **Nunca** integram o Modelo.
- **Projeção** — uma função que leva os fatos primários a uma forma externa e de volta, sem perda e sem acréscimo ([002](002-projection-rules.md)).
- **Modelo de Representação** — o conjunto abaixo, e somente ele.

### A superfície de fatos primários

| Fato primário | Forma | Conceito (Ontologia) |
|---|---|---|
| **Símbolo** | o que distingue unicamente a entidade | [P1](../product/system/000-ontologia-normativa.md) |
| **Entrada por Contexto** | um par (Contexto, Conteúdo); Contexto pode ser o invariante único | [P4](../product/system/000-ontologia-normativa.md) · [D1](../product/system/000-ontologia-normativa.md) |
| **Conteúdo — Atomic** | um payload terminal **opaco** (a Espécie Valor/Unidade/Restrição é derivada) | [P2](../product/system/000-ontologia-normativa.md) |
| **Conteúdo — Reference** | o Símbolo-alvo designado | [D2](../product/system/000-ontologia-normativa.md) |
| **Conteúdo — Composite** | um operador e os seus operandos | [P6](../product/system/000-ontologia-normativa.md) |
| **Destinação** | o Consumidor a que um Conteúdo se vincula, quando declarado | [D3](../product/system/000-ontologia-normativa.md) |

> **Nota não-normativa — implementação compatível.** A **AST** do Compiler ([003](../compiler/003-ast.md)) é **uma** implementação compatível deste Modelo. O Modelo **não deriva** da AST; a AST é que conforma ao Modelo. Uma evolução da AST **não** obriga alteração deste documento.

## Responsibilities

1. **Enumerar os fatos primários** — exatamente a superfície acima, derivada da Ontologia.
2. **Excluir os fatos derivados** — Posição, Matéria, Espécie, Escopo e Completude **MUST NOT** aparecer numa representação; a sua presença é defeito ([Diagnostics](#diagnostics)).
3. **Fixar as invariantes** que toda projeção ([002](002-projection-rules.md)) e todo round-trip ([004](004-round-trip.md)) devem preservar.

## Constraints

- O Modelo **MUST NOT** conter conceito ausente da [Ontologia](../product/system/000-ontologia-normativa.md); toda entrada da superfície cita o seu conceito.
- O Modelo **MUST NOT** conter fato derivado ([P3](../product/system/000-ontologia-normativa.md) — a existência é primária; a inferência é do Compiler).
- O Modelo **MUST NOT** depender da estrutura interna do Compiler nem de qualquer formato.
- O Modelo **MUST NOT** ordenar Símbolos nem agrupá-los: não há Agregado/Família na Ontologia (incompatibilidade registrada, [system/004 · Parte C](../product/system/004-design-tokens.md)).

## Diagnostics

Os diagnósticos deste pilar são **sobre a fidelidade da representação**, não sobre semântica (essa é do Compiler):

| Código | Condição |
|---|---|
| `representation.derived-fact` | a representação carrega um fato derivado (Posição/Matéria/Espécie/Escopo/Completude) |
| `representation.foreign-element` | elemento sem correspondência num fato primário da [Ontologia](../product/system/000-ontologia-normativa.md) |
| `representation.missing-primary` | fato primário declarado ausente da representação |

## Determinism

O Modelo é um conjunto fixo: para uma dada Declaração, os seus fatos primários são únicos e ordenáveis de forma total (por Símbolo, depois por Contexto). Nenhuma parte do Modelo depende de execução, ambiente ou ordem de iteração.

## Invariants

1. **Fidelidade** — a representação carrega **todos** os fatos primários e **nenhum** outro ([P3](../product/system/000-ontologia-normativa.md)).
2. **Só primários** — nenhum fato derivado presente.
3. **Símbolo invariante** — o Símbolo é um só; a sua grafia numa forma externa não o altera ([P1](../product/system/000-ontologia-normativa.md)).
4. **Independência** — o Modelo não depende de formato nem de implementação.

## Acceptance Criteria

- [ ] Cada fato primário da superfície cita um conceito da [Ontologia](../product/system/000-ontologia-normativa.md).
- [ ] Nenhum fato derivado integra o Modelo.
- [ ] O Modelo não referencia estrutura interna do Compiler como dependência (a AST é citada só como implementação compatível, não-normativa).
- [ ] As quatro invariantes estão declaradas e são verificáveis por [005](005-conformance.md).
- [ ] Nenhuma referência quebrada.

## Change Policy

Este documento **SHALL** mudar apenas se a Ontologia mudar (P1–P6, D1–D3). Uma mudança na AST do Compiler, num formato ou na implementação **MUST NOT** alterar este Modelo. Introduzir aqui um fato derivado ou um conceito ausente da Ontologia é **proibido**.
