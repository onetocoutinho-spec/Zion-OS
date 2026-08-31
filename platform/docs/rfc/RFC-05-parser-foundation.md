# RFC-05 — Parser Foundation

```
Status:   Proposed — aguarda aprovação
Fase:     PHASE 06 — Parser (bloqueada até aprovação)
Autoria:  Principal Compiler Engineer (implementação)
Precede:  segue o mesmo princípio da RFC-04 (Lexer)
```

## Tema
Fundamento arquitetural do Parser.

## Justificativa
- A **Compiler Specification** ([compiler/003](../../../docs/compiler/003-ast.md)) define o **vocabulário de nós** da AST como **ontológico** (Símbolo, e as três formas de Conteúdo — Atomic/Reference/Composite), mas **difere integralmente a gramática** — as regras de produção que reduzem o Token Stream à AST — à **Especificação da Linguagem Zion**.
- Essa Especificação **não existe** e é deliberadamente ausente. Sem regras de produção, precedência sintática e estrutura concreta, **não há fundamento** para um Parser **completo**; implementá-lo exigiria **inventar** gramática/sintaxe — proibido pela regra absoluta e pela própria [compiler/003 · Constraints](../../../docs/compiler/003-ast.md) (*"A AST MUST NOT enunciar gramática, precedência sintática ou lexema concreto"*).

## Restrição
Não inventar gramática, regras de produção, precedência sintática nem sintaxe. Não assumir linguagem concreta.

## Proposta de implementação (mesmo princípio do Lexer)
Implementar o Parser como um **mecanismo genérico e parametrizado**, dirigido por um **contrato sintático injetado** — análogo ao `LexicalContract` do Lexer.

**1. Contrato sintático injetado (`SyntacticContract`).** Um parâmetro/interface abstrata que fornece as **regras de produção** (a função que, a partir do Token Stream, reconhece o próximo nó da AST ou emite um Diagnostic `syntactic`). O conjunto de `TokenKind` reconhecidos e a gramática pertencem ao seu domínio. Enquanto a Especificação da Linguagem não existir, este contrato permanece **aberto/vazio** — sem gramática concreta. A compiler/003 exige exatamente isto: o Parser é *"especificado apenas pelo seu contrato de saída (o vocabulário de nós)"* enquanto *"a gramática concreta pertence à Especificação da Linguagem"*.

**2. O que a PHASE 06 entrega (mecanismo, não linguagem):**
- Um cursor imutável sobre o **Token Stream** (posições preservadas).
- O motor `parse` — aplica as **regras de produção injetadas** para construir nós da AST (`ASTNode`/`RepresentationNode`/`Content`, já contratados em `@zion/shared`); não conhece gramática alguma.
- **Recuperação de erro determinística** e **integração com a Diagnostic Infrastructure** (família `syntactic`, Compiler 001).
- **Invariante análoga à L1 — Progress:** toda iteração consome ao menos um Token ou encerra; nenhum contrato pode permanecer indefinidamente sobre a mesma posição.

**3. O que a PHASE 06 NÃO faz:** não define gramática, precedência, sintaxe ou linguagem; não implementa Semantic/IR; não reintroduz classificação (Posição/Matéria/Espécie — isso é a Semantic Analysis).

**4. Testabilidade sem linguagem:** os testes (fase futura) exercitam o motor com um **contrato sintático de exemplo** (fixture **não normativo**), isolado nos testes — jamais autoridade arquitetural, jamais no código de produção.

## Princípio (herdado da RFC-04, aplicado ao Parser)
- O mecanismo do Parser é **permanente**.
- O **contrato sintático** é **substituível**.
- Linguagens futuras adaptam-se ao mecanismo.
- O mecanismo nunca é adaptado à linguagem.

## Impacto
- A PHASE 06 materializa o **Parser arquitetural** (grounded em compiler/003) sem antecipar a Especificação da Linguagem. Zero gramática concreta no código de produção.
- Quando (e se) a Especificação da Linguagem for congelada, ela preenche o `SyntacticContract`, e o **mesmo Parser** roda sem alteração.

## Alternativa rejeitada
- **Adiar o Parser** até existir uma Especificação da Linguagem: bloquearia o roadmap. A compiler/003 já autoriza e prescreve a via parametrizada (gramática injetada).

## Decisão
Aguarda aprovação. Nenhum código do Parser será escrito antes dela.
