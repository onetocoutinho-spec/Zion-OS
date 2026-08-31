# RFC-04 — Fundamento arquitetural do Lexer

```
Status:   Proposed — aguarda aprovação
Fase:     PHASE 05 — Lexer (bloqueada até aprovação)
Autoria:  Principal Compiler Engineer (implementação)
```

## Tema
Fundamento arquitetural do Lexer.

## Justificativa
- A **Compiler Specification** ([compiler/001](../../../docs/compiler/001-compiler-architecture.md), [002](../../../docs/compiler/002-lexical-analysis.md)) define um **Source abstrato** e **difere integralmente** o léxico concreto — alfabeto, gramática, conjunto de `TokenKind` e regras léxicas — à **Especificação da Linguagem Zion**.
- Essa Especificação da Linguagem **não existe** e é **deliberadamente ausente** (a fase "Language Specification" foi cancelada; substituída pela Representation Specification, que não define linguagem).
- Sem alfabeto, gramática e conjunto concreto de `TokenKind`, **não há fundamento** para um Lexer **completo**. Implementá-lo exigiria **inventar** sintaxe/lexemas — proibido pela regra absoluta e pela própria [compiler/002 · Constraints](../../../docs/compiler/002-lexical-analysis.md).

## Restrição
Não inventar gramática, alfabeto, palavras-chave nem `TokenKind`. Não assumir representação textual da Source.

## Proposta de implementação (compatível com a restrição)
Implementar o Lexer como **exatamente a arquitetura parametrizada que a compiler/002 especifica**: um **mecanismo de lexing genérico**, dirigido por um **contrato léxico injetado**, sem nenhum lexema concreto.

**1. Contrato léxico injetado (`LexicalGrammar`).** Um parâmetro/interface abstrata que fornece: o conjunto de `TokenKind` e as regras léxicas (a função total `Source Units → Token | Diagnostic`). Enquanto a Especificação da Linguagem não existir, este contrato permanece **aberto/vazio** — sem kinds concretos. A compiler/002 exige exatamente isto: *"consumir o conjunto de kinds e as regras léxicas como um contrato injetado pela Especificação da Linguagem"*.

**2. O que a PHASE 05 entrega (mecanismo, não linguagem):**
- `SourceReader` — expõe a Source como fluxo ordenado de **Source Units opacas** + posição corrente (única origem de Source Position). Não interpreta a unidade.
- `Tokenizer` (motor) — aplica as **regras léxicas injetadas** para agrupar unidades em Tokens; não conhece lexema algum.
- `TokenStream` — sequência ordenada de Tokens (já contratada em `@zion/shared`).
- **Recuperação de erro determinística**, **EOF**, e o tratamento de **unidades ignoráveis** (o análogo de whitespace/comments) **como ganchos do contrato injetado** — nunca concretos.

**3. O que a PHASE 05 NÃO faz:** não define `TokenKind` concreto, alfabeto, gramática ou sintaxe; não assume texto; não implementa Parser/Semantic/IR.

**4. Testabilidade sem linguagem:** os testes (fase futura) exercitam o motor com um **contrato léxico de exemplo** (fixture não-normativo), **isolado nos testes** — nunca no código de produção.

## Impacto
- A PHASE 05 materializa o **Lexer arquitetural** (grounded em compiler/002) sem antecipar a Especificação da Linguagem. Zero token concreto no código de produção.
- Quando (e se) a Especificação da Linguagem for congelada, ela preenche o `LexicalGrammar`, e o **mesmo Lexer** roda sem alteração.

## Alternativa rejeitada
- **Adiar o Lexer** até existir uma Especificação da Linguagem: bloquearia o roadmap indefinidamente. A compiler/002 já autoriza — e prescreve — a arquitetura parametrizada, tornando o adiamento desnecessário.

## Decisão
Aguarda aprovação. Nenhum código do Lexer será escrito antes dela.
