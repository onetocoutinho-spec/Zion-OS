# 004 — Round-trip

**Status:** Proposed
**Owner:** Representation Engineering (Zion)
**Depends On:** [001 — Representation Model](001-representation-model.md) · [002 — Projection Rules](002-projection-rules.md) · [Ontologia · P1, P3](../product/system/000-ontologia-normativa.md)

---

## Purpose

Definir a garantia de **bidirecionalidade**: uma representação projeta-se nos fatos primários e de volta **sem perda e sem acréscimo**, e os fatos **derivados** são **reconstruídos pelo Compiler** a partir dos primários — nunca carregados na representação.

## Scope

Este documento **SHALL** definir o round-trip e a fronteira com a reconstrução dos derivados. Ele **MUST NOT** reconstruir derivados (isso é do Compiler) nem definir formato.

## Definitions

- **Round-trip** — a composição das duas direções da projeção ([002](002-projection-rules.md)): forma externa → fatos primários → forma externa.
- **Reconstrução** — o cálculo dos fatos derivados (Posição, Matéria, Espécie, Escopo, Completude) a partir dos primários, realizado pelo Compiler ([Semantic 004](../compiler/004-semantic-analysis.md) → [IR 005](../compiler/005-intermediate-representation.md)).

## Responsibilities

1. **Direção direta** — de uma forma externa **SHALL** ser possível recuperar exatamente os fatos primários ([002 · reversibilidade](002-projection-rules.md#responsibilities)).
2. **Direção inversa** — dos fatos primários **SHALL** ser possível reproduzir a forma externa na ordem canônica.
3. **Identidade** — a composição das duas direções **SHALL** ser a identidade sobre os fatos primários: nenhum fato ganho, nenhum perdido ([P3](../product/system/000-ontologia-normativa.md)).
4. **Fronteira dos derivados** — a reconstrução dos fatos derivados **SHALL** ser feita pelo Compiler a partir dos primários; ela **MUST NOT** integrar o round-trip nem a representação.

## Constraints

- O round-trip **MUST NOT** incluir fato derivado; incluí-lo quebra a garantia de "só primários" ([001](001-representation-model.md)).
- O round-trip **MUST** ser identidade sobre os primários; qualquer divergência é defeito.
- Este pilar **MUST NOT** depender da estrutura interna do Compiler; a reconstrução é citada como **papel** do Compiler, não como dependência.

## Diagnostics

| Código | Condição |
|---|---|
| `roundtrip.lossy` | fato primário perdido numa das direções |
| `roundtrip.non-identity` | forma → primários → forma difere do original (na ordem canônica) |
| `roundtrip.derived-leak` | fato derivado presente, participando do round-trip |

## Determinism

O round-trip **SHALL** ser determinístico: para os mesmos fatos primários e a mesma forma-alvo, ambas as direções produzem sempre o mesmo resultado ([002 · Determinism](002-projection-rules.md#determinism)).

## Invariants

1. **Identidade sobre os primários** — round-trip preserva exatamente os fatos primários.
2. **Grafia invariante** — o Símbolo sobrevive a ambas as direções ([P1](../product/system/000-ontologia-normativa.md)).
3. **Derivados fora** — nunca carregados; sempre reconstruídos pelo Compiler.

## Acceptance Criteria

- [ ] Forma → primários → forma é a identidade (ordem canônica).
- [ ] Nenhum fato primário é perdido; nenhum estranho é ganho.
- [ ] Nenhum fato derivado participa do round-trip.
- [ ] A reconstrução dos derivados é atribuída ao Compiler, não a este pilar.
- [ ] Nenhuma referência quebrada.

## Change Policy

Este documento **SHALL** mudar apenas se o [Modelo (001)](001-representation-model.md) ou as [Regras (002)](002-projection-rules.md) mudarem. A forma como o Compiler reconstrói os derivados **MUST NOT** obrigar mudança aqui.
