# 002 — Projection Rules

**Status:** Proposed
**Owner:** Representation Engineering (Zion)
**Depends On:** [001 — Representation Model](001-representation-model.md) · [Ontologia · P1](../product/system/000-ontologia-normativa.md)

---

## Purpose

Definir as regras **independentes de formato** pelas quais os fatos primários do [Modelo (001)](001-representation-model.md) são projetados numa forma externa, preservando as invariantes de Fidelidade, Determinismo, Bidirecionalidade e Imutabilidade Conceitual. As regras valem para **qualquer** forma externa; nenhum formato é definido aqui.

## Scope

Este documento **SHALL** definir as regras de projeção. Ele **MUST NOT** definir formato concreto (só como exemplo — [003](003-format-mapping.md)), **MUST NOT** carregar fato derivado, e **MUST NOT** introduzir semântica.

## Definitions

- **Elemento de projeção** — a unidade da forma externa que carrega um fato primário.
- **Grafia** — a forma como um Símbolo é escrito numa forma externa; distinta do Símbolo, que é um só ([P1](../product/system/000-ontologia-normativa.md)).
- **Ordem canônica** — a ordem total dos fatos primários: por Símbolo, depois por Contexto ([001 · Determinism](001-representation-model.md#determinism)).

## Responsibilities

1. **Totalidade** — cada fato primário do [Modelo (001)](001-representation-model.md) **SHALL** projetar-se em exatamente um elemento de projeção.
2. **Injetividade e reversibilidade** — a projeção **SHALL** ser injetora: dois fatos primários distintos **MUST NOT** colapsar num mesmo elemento; e **SHALL** ser reversível — o fato primário é reconstruível a partir do elemento.
3. **Grafia reversível** — um Símbolo pode ter grafias distintas em formas externas distintas, mas **SHALL** denotar o mesmo Símbolo ([P1](../product/system/000-ontologia-normativa.md)); a grafia **MUST** ser reversível para o Símbolo. A grafia **MUST NOT** ser tratada como distinção.
4. **Preservação de Contexto** — a associação (Contexto, Conteúdo) **SHALL** ser preservada na projeção.
5. **Ordem canônica** — a projeção **SHALL** emitir os elementos na ordem canônica, tornando-a determinística.
6. **Formatos como exemplo** — qualquer menção a Markdown/JSON/YAML/XML **SHALL** ser exemplo não-normativo; a autoridade do formato é do Generator do Compiler ([003](003-format-mapping.md)).

> **Exemplo não-normativo.** Um fato primário `(Símbolo, Contexto, Conteúdo=Reference→outro Símbolo)` pode aparecer, numa forma, como um par nome→alvo, e noutra como um nó aninhado. Ambas são projeções válidas **se** forem totais, injetoras e reversíveis. O *como* é do formato (Generator); o *quê* é deste pilar.

## Constraints

- Nenhuma regra **MUST** projetar um fato derivado ([001 · Constraints](001-representation-model.md#constraints)).
- Nenhuma regra **MUST** depender de formato concreto, execução, ambiente ou ordem de iteração.
- Nenhuma regra **MUST** introduzir agrupamento ou ordenação de Símbolos além da ordem canônica (não há Agregado/Família — [system/004 · Parte C](../product/system/004-design-tokens.md)).

## Diagnostics

| Código | Condição |
|---|---|
| `projection.non-total` | fato primário sem elemento de projeção |
| `projection.non-injective` | dois fatos primários no mesmo elemento |
| `projection.non-reversible` | elemento do qual o fato primário não é reconstruível |
| `projection.grapheme-as-identity` | grafias tratadas como Símbolos distintos ([P1](../product/system/000-ontologia-normativa.md)) |

## Determinism

Para os mesmos fatos primários e a mesma forma-alvo, a projeção **SHALL** produzir a mesma saída, na ordem canônica ([001 · Determinism](001-representation-model.md#determinism)). Nenhuma escolha de projeção depende de estado externo.

## Invariants

1. **Total e injetora** — bijeção entre fatos primários e elementos de projeção.
2. **Reversível** — todo elemento reconstrói o seu fato primário.
3. **Grafia ⇒ mesmo Símbolo** ([P1](../product/system/000-ontologia-normativa.md)).
4. **Ordem canônica** preservada.
5. **Sem derivados, sem semântica.**

## Acceptance Criteria

- [ ] Toda projeção é total, injetora e reversível.
- [ ] Grafias distintas do mesmo Símbolo são reconhecidas como o mesmo Símbolo.
- [ ] Nenhum fato derivado é projetado.
- [ ] Menções a formatos são exemplos não-normativos.
- [ ] Nenhuma referência quebrada.

## Change Policy

Este documento **SHALL** mudar apenas se o [Modelo (001)](001-representation-model.md) mudar. Uma mudança de formato ou de implementação **MUST NOT** alterar estas regras.
