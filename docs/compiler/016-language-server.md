# 016 — Language Server

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [006 — Compiler Pipeline](006-compiler-pipeline.md) · [007 — Validator](007-validator.md) · [015 — Runtime](015-runtime.md)

---

## Purpose

Definir o **Language Server** que expõe, a um editor, os Diagnostics do pipeline e a resolução de Tokens — em tempo de edição. O Language Server **compõe** capacidades já definidas; ele **MUST NOT** conter lógica de compilação nem definir a Linguagem Zion.

## Scope

Este documento **SHALL** definir o contrato de serviços de edição sobre uma Source viva. Ele **MUST NOT** especificar o protocolo de transporte concreto nem assumir a representação textual da Source — a análise da Source depende da gramática da futura Especificação da Linguagem, consumida como contrato ([002](002-lexical-analysis.md)/[003](003-ast.md)).

## Input

- **Source** viva (buffer de edição), tratada como abstrata ([001 · Constraints](001-compiler-architecture.md#constraints)), e pedidos do editor.

## Output

- **Diagnostics** ([006](006-compiler-pipeline.md)) posicionados por Source Position; e respostas de **resolução** (o Valor de um Token sob um Contexto, via [015](015-runtime.md)).

## Responsibilities

1. **Diagnostics ao vivo** — correr o pipeline ([006](006-compiler-pipeline.md)) sobre a Source viva e publicar os Diagnostics.
2. **Resolução sob o cursor** — dado um Símbolo e um Contexto, responder com o Valor resolvido via [015](015-runtime.md).
3. **Navegação por Declaração** — localizar a Declaração de um Símbolo pela sua Source Position ([001](001-compiler-architecture.md#contrato-partilhado--source-position)).

## Constraints

- O Language Server **MUST NOT** reimplementar fase alguma; **SHALL** delegar a [006](006-compiler-pipeline.md), [007](007-validator.md) e [015](015-runtime.md).
- O Language Server **MUST NOT** definir gramática, lexema ou palavra-chave — depende do contrato da futura Especificação da Linguagem.
- O Language Server **MUST NOT** eleger Contexto ([015 · Constraints](015-runtime.md#constraints)); o Contexto de uma consulta é fornecido pelo editor.

## Determinism

Para uma mesma Source e um mesmo pedido, o Language Server **SHALL** produzir os mesmos Diagnostics e a mesma resolução ([001 · Determinism](001-compiler-architecture.md#determinism)).

## Diagnostics

O Language Server **MUST NOT** originar Diagnostics de compilação próprios; **SHALL** publicar os de [006](006-compiler-pipeline.md)/[007](007-validator.md).

## Invariants

1. **Delegação total** — nenhuma lógica de fase.
2. **Diagnostics idênticos aos do pipeline**, apenas transportados.
3. **Contexto fornecido pelo editor**, nunca decidido pelo servidor.

## Acceptance Criteria

- [ ] Diagnostics ao vivo coincidem com os do pipeline para a mesma Source.
- [ ] Resolução sob o cursor delega a [015](015-runtime.md).
- [ ] Nenhuma gramática concreta é assumida.
- [ ] Nenhuma referência quebrada.

## Change Policy

**SHALL** mudar apenas se o contrato de [006](006-compiler-pipeline.md), [007](007-validator.md) ou [015](015-runtime.md) mudar ([001 · Change Policy](001-compiler-architecture.md#change-policy)).
