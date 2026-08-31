# ADR-005 — Escopo da cadeia de resolução e declaração de tokens fora dela

> **Status:** `Proposed`
> **Data:** 2026-07-16 · **Responsável:** Arquitetura Zion (proposta — aguarda ratificação humana, [decisions/000 §6](./000-decision-record-methodology.md))
> **Metodologia:** [decisions/000 — Decision Record Methodology](./000-decision-record-methodology.md)

---

## Contexto

Este registro formaliza as **21 normas** referenciadas pela [Ontologia Normativa (system/000)](../product/system/000-ontologia-normativa.md) na sua verificação de aceite (*Critério de aceite — verificação executada · Suficiência para ADR-005 — 21 normas*). Ele existe para que essa referência deixe de apontar para um documento ausente do corpus.

As normas abaixo são transcritas **sem acréscimo**. Nenhuma norma nova é introduzida.

> **Relação com a Ontologia.** A [Ontologia (000)](../product/system/000-ontologia-normativa.md) **precede este ADR** ([Hierarquia das Decisões, system/002 §3](../product/system/002-product-laws.md)). A sua seção *Suficiência para ADR-005* reescreve, dissolve ou revoga cada uma das normas abaixo usando apenas os seus 31 conceitos. Onde este ADR e a Ontologia divergirem, prevalece a Ontologia.

---

## Problema

O escopo do §3 do `system/004` — o que a **cadeia de resolução** governa, e o estatuto de tokens que não pertencem a ela — não estava declarado de forma fechada. As 21 normas abaixo fixam esse escopo.

---

## Decisão

**Escopo exclusivo:** as normas do §3. Numeração `1`–`21`.

1. A cadeia de resolução é composta por Foundation, Semantic e Component.
2. O §3 governa a cadeia de resolução.
3. O §3 não governa nada além da cadeia de resolução.
4. Pertencer à cadeia exige resolver-se por tema.
5. Cada seção do 004 declara os seus próprios tokens.
6. Cada seção do 004 não é obrigada a atribuir os seus tokens à cadeia.
7. O §3:75 contém a proibição de componentes referenciarem Foundation.
8. O §3:75 não contém nenhuma outra proibição.
9. Componentes nunca referenciam Foundation.
10. O atributo `escopo` tem domínio de valores { universal, domínio Zion }.
11. Todo token declara `escopo`.
12. Os tokens listados em §5.4 têm escopo `domínio Zion`.
13. `Camada` designa exclusivamente um dos três níveis da cadeia.
14. `Tipo` deixa de ser termo do 004.
15. `Collections` deixa de ser termo do 004.
16. `Camada de Tokens` deixa de ser termo do 004.
17. O 004 declara `control.textarea.max-lines`.
18. `control.textarea.max-lines` tem unidade «linhas».
19. `control.textarea.max-lines` não pertence à cadeia.
20. `control.textarea.max-lines` tem escopo `universal`.
21. `control.textarea.max-lines` não tem valor.

---

## Itens deliberadamente não resolvidos

- Valor de `control.textarea.max-lines`.
- Critério para admitir tokens fora da cadeia.
- Natureza do conteúdo dos tokens fora da cadeia.

> Estes três itens **deixam de ser questões** sob a Ontologia (000): pela Norma 5.2.1 não há cadeia única, pela 5.2.2 nenhum Token está fora de Cadeia, e pela 5.5.1 um Token Incompleto existe. Ver *Critério de aceite* em [system/000](../product/system/000-ontologia-normativa.md).

---

## Consequências

- A referência da Ontologia (000) a este ADR passa a resolver-se dentro do corpus.
- Este ADR permanece `Proposed`: o seu conteúdo normativo já foi reescrito pela Ontologia (000), que tem precedência.
