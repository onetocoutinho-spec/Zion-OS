# 017 — Testing & Certification

**Status:** Proposed
**Owner:** Compiler Engineering (Zion)
**Depends On:** [001](001-compiler-architecture.md) · [002](002-lexical-analysis.md) · [003](003-ast.md) · [004](004-semantic-analysis.md) · [005](005-intermediate-representation.md) · [006](006-compiler-pipeline.md) · [007](007-validator.md) · [008–013 Generators](008-css-generator.md) · [014](014-cli.md) · [015](015-runtime.md) · [016](016-language-server.md)

---

## Purpose

Definir como se **prova** que uma implementação do compilador está conforme esta especificação e fiel à arquitetura congelada. A certificação não introduz requisito novo; ela **verifica** os requisitos já declarados nos documentos 001–016.

## Scope

Este documento **SHALL** definir as categorias de teste e o critério de certificação. Ele **MUST NOT** introduzir comportamento não especificado em 001–016 nem assumir a representação textual da Source.

## Input

- Uma implementação candidata e o corpus congelado como oráculo ([Ontologia](../product/system/000-ontologia-normativa.md), [system/004](../product/system/004-design-tokens.md), [ADRs](../decisions/)).

## Output

- Um **veredito de certificação** determinístico: conforme, ou não-conforme com a lista de requisitos violados.

## Responsibilities

1. **Testes de comportamento** — para cada fase 002–007 e cada Generator 008–013, verificar Input→Output contra o contrato do respectivo documento.
2. **Testes de determinismo** — verificar que a mesma Source produz a mesma saída byte a byte, em execuções e ordens de iteração distintas ([001 · Determinism](001-compiler-architecture.md#determinism)).
3. **Testes de invariantes** — verificar as invariantes da [Ontologia · Parte 7](../product/system/000-ontologia-normativa.md) sobre a IR ([007](007-validator.md)).
4. **Testes de erro e limite** — verificar que Source inválida, ciclos ([5.3.1](../product/system/000-ontologia-normativa.md)) e Incompletude ([5.5.1](../product/system/000-ontologia-normativa.md)) produzem o Diagnostic esperado e nunca Valor inventado.
5. **Testes de regressão** — golden outputs por Generator; qualquer divergência é falha.

## Constraints

- A certificação **MUST NOT** aceitar implementação que resolva por invenção o que a Ontologia não exprime ([001 · Diagnostics](001-compiler-architecture.md#contrato-partilhado--diagnostic)).
- A certificação **MUST NOT** exigir comportamento ausente de 001–016.
- Os testes que dependem de gramática concreta **SHALL** ser diferidos até a Especificação da Linguagem existir; até lá, certificam-se as fases sobre contratos abstratos (Token Stream, AST) fornecidos como fixtures.

## Determinism

O veredito **SHALL** ser função pura de (implementação, corpus): mesma implementação → mesmo veredito ([001 · Determinism](001-compiler-architecture.md#determinism)).

## Diagnostics

Este documento não emite Diagnostics de compilação; a sua saída é o veredito de certificação. Falhas **SHALL** citar o documento e o requisito violado.

## Invariants

1. **Cobertura** — toda fase e todo Generator têm testes de comportamento.
2. **Determinismo provado**, não presumido.
3. **Nenhum requisito novo** — todo teste rastreia-se a um documento 001–016 ou ao corpus congelado.
4. **Gramática diferida** — nenhum teste presume lexema/sintaxe concreta enquanto a Linguagem não existir.

## Acceptance Criteria

- [ ] Cada fase 002–007 e cada Generator 008–013 têm testes de comportamento, erro, limite e determinismo.
- [ ] As invariantes da [Parte 7](../product/system/000-ontologia-normativa.md) são testadas sobre a IR.
- [ ] Golden outputs de regressão existem por Generator.
- [ ] Nenhum teste presume gramática concreta.
- [ ] Nenhuma referência quebrada.

## Change Policy

**SHALL** mudar apenas quando um documento 001–016 mudar, para permanecer o seu espelho verificável ([001 · Change Policy](001-compiler-architecture.md#change-policy)).
