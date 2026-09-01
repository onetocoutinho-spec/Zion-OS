# Representation Specification — Pilar Oficial

```
─────────────────────────────────────────────
Pilar:                   docs/representation/ (5º pilar documental)
Status:                  Proposed (congela após auditoria — REPRESENTATION SPECIFICATION FROZEN)
Owner:                   Representation Engineering (Zion)
Autoridade conceitual:   Ontologia (system/000) — precede este pilar
Ordem normativa:         Ontologia → Representation → Compiler → Implementation
Autoridade deste pilar:  o Modelo de Representação (001), derivado diretamente da Ontologia
─────────────────────────────────────────────
```

> Este pilar **não define uma linguagem** e **não define formato algum**. Ele define **como os conceitos da Ontologia são projetados** em representações externas, de modo fiel, determinístico e bidirecional. A Source permanece abstrata ([Compiler 001 · Source abstrata](../compiler/001-compiler-architecture.md#constraints)).
>
> Nenhuma semântica nova. Nenhum conceito novo. Toda representação é uma **projeção fiel da Ontologia** ([system/000](../product/system/000-ontologia-normativa.md)).

---

## Propósito

Definir o **Modelo de Representação** — a superfície de **fatos primários** da Ontologia que qualquer forma externa deve carregar — e as **regras de projeção** que a levam a formatos concretos, sem antecipar nenhuma inferência semântica. Os fatos **derivados** (Posição, Matéria, Espécie, Escopo, Completude) **nunca** são representados: são reconstruídos pelo Compiler ([004 Semantic](../compiler/004-semantic-analysis.md), [005 IR](../compiler/005-intermediate-representation.md)).

## Princípio de projeção

Uma representação é uma **projeção**: uma função que leva os fatos primários da Ontologia a elementos de uma forma externa e de volta, **sem perda e sem acréscimo**. Ela preserva o Símbolo ([P1](../product/system/000-ontologia-normativa.md) — a grafia não altera o Símbolo), o Conteúdo por Contexto ([D1](../product/system/000-ontologia-normativa.md), [P4](../product/system/000-ontologia-normativa.md)) e nada mais.

## Fronteira de autoridade

- **Este pilar é autoridade apenas sobre o Modelo de Representação e as Regras de Projeção.**
- **Este pilar NÃO é autoridade sobre Markdown, JSON, YAML ou XML.** A materialização de cada formato é delegada, **para baixo**, aos **Generators do Compiler** ([011 Documentation](../compiler/011-documentation-generator.md), [012 JSON](../compiler/012-json-generator.md)); onde não há Generator, o formato aparece **apenas como exemplo** de projeção, nunca como definição normativa.
- Este pilar situa-se **acima** do Compiler na ordem normativa (Ontologia → **Representation** → Compiler → Implementation): o Compiler é uma **implementação** deste Modelo, não a sua fonte. O Modelo deriva **diretamente da Ontologia** e **nunca** depende da estrutura interna do Compiler.

## Relação com a Ontologia

A Ontologia é a **autoridade conceitual**. O Modelo de Representação é a projeção dos seus **fatos primários** — Símbolo ([P1](../product/system/000-ontologia-normativa.md)) e Conteúdo por Contexto ([D1](../product/system/000-ontologia-normativa.md)/[P4](../product/system/000-ontologia-normativa.md)), incluindo as três formas de Conteúdo (Atomic/Reference/Composite — [P2](../product/system/000-ontologia-normativa.md)/[D2](../product/system/000-ontologia-normativa.md)/[P6](../product/system/000-ontologia-normativa.md)) e a Destinação quando declarada ([D3](../product/system/000-ontologia-normativa.md)). Nenhum conceito é criado; nenhum é alterado.

## Relação com o Compiler

O Compiler é uma **implementação** deste pilar. A sua **AST** ([003](../compiler/003-ast.md)) é uma **implementação compatível** do Modelo de Representação — **não** a sua definição: o Modelo deriva diretamente da Ontologia e **não depende** da AST nem de qualquer estrutura interna do Compiler. Uma evolução futura da AST **não** obriga alteração deste Modelo. O Compiler **reconstrói** os fatos derivados (Semantic [004](../compiler/004-semantic-analysis.md) → IR [005](../compiler/005-intermediate-representation.md)) e **materializa** cada formato (Generators [008–013](../compiler/008-css-generator.md)); este pilar não repete essas responsabilidades.

## Relação com o Runtime

O [Runtime do Compiler](../compiler/015-runtime.md) resolve um Token sob um Contexto no consumo, a partir da IR. Uma representação **não resolve** e **não infere**: ela apenas carrega os fatos primários que, uma vez reconstruídos pelo Compiler, o Runtime resolve.

## Fluxo completo

```
Ontologia (conceitos)
        │  projeção dos fatos primários
        ▼
Representation Model  (Símbolo + Contexto→Conteúdo — 001)
        │  Regras de Projeção (002) · Format Mapping (003, via Generators)
        ▼
Source (forma externa concreta — abstrata para o Compiler)
        │
        ▼
Compiler  →  AST (003)  →  Semantic (004)  →  IR (005)  →  Validator (007)
        │                    reconstrói os fatos DERIVADOS
        ▼
Generators (008–013)  →  Artifacts        Runtime (015)  →  Resolução
```

Round-trip ([004](004-round-trip.md)): a forma externa **↔** os fatos primários, sem perda; os derivados nunca fazem parte da representação — são reconstruídos pelo Compiler.

## Índice

| # | Documento | Papel |
|--:|-----------|-------|
| 001 | [Representation Model](001-representation-model.md) | os fatos primários e as invariantes |
| 002 | [Projection Rules](002-projection-rules.md) | regras format-agnostic de projeção |
| 003 | [Format Mapping](003-format-mapping.md) | ligação a formatos via Generators (autoridade deferida) |
| 004 | [Round-trip](004-round-trip.md) | bidirecionalidade e reconstrução dos derivados |
| 005 | [Conformance](005-conformance.md) | verificação de fidelidade da projeção |

## Ordem de leitura

1. **001** — Representation Model (a superfície; leia primeiro).
2. **002** — Projection Rules (como a superfície se projeta).
3. **003** — Format Mapping (como a projeção se liga a um formato, via Generator).
4. **004** — Round-trip (a ida-e-volta e a fronteira com os derivados).
5. **005** — Conformance (como se prova fiel).

## Dependências

- **Acima (fonte da verdade, imutáveis aqui):** [Ontologia (system/000)](../product/system/000-ontologia-normativa.md) · [Product Laws (system/002)](../product/system/002-product-laws.md).
- **Abaixo (implementação deste pilar):** [Compiler Specification](../compiler/README.md) — a AST implementa o Modelo; os Generators materializam os formatos. Onde este pilar cita o Compiler (`003` mapping, `005` conformance), é como **implementação a jusante que conforma a este pilar**, nunca como dependência conceitual a montante.
- **Interno:** `002`–`005` dependem de `001`.
- Grafo estritamente para trás; nenhum documento deste pilar depende da estrutura interna do Compiler nem altera um pilar acima.

> **Errata documental (não reaberta):** o pilar Compiler foi congelado **antes** deste pilar e, por isso, (a) não cita a Representation Specification a montante e (b) refere `system/004 · §15.5`, seção dissolvida em [P1](../product/system/000-ontologia-normativa.md) na reescrita v2.0 do `004`. Ambas são tratadas como errata documental do Compiler; não reabro o pilar congelado. Este pilar deriva da Ontologia e ancora a bidirecionalidade de grafia em **P1**, nunca em §15.5.
