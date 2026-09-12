import type { Token, Diagnostic } from '@zion/shared';
import type { Cursor } from './cursor';
import { atEnd, advance } from './cursor';
import type { LexicalContract } from './lexical-contract';

// Compiler 002 — o artefato de saída do Lexer: a sequência ordenada de Tokens e os Diagnostics léxicos.
export interface TokenStream {
  readonly tokens: readonly Token[];
  readonly diagnostics: readonly Diagnostic[];
}

// Tokenizer Engine — mecanismo genérico e determinístico. Consome EXCLUSIVAMENTE o LexicalContract injetado;
// não conhece TokenKind concreto, gramática, alfabeto nem sintaxe. Integração com a Diagnostic Infrastructure:
// emite Diagnostics no contrato de Compiler 001, consumíveis por @zion/shared (collect/report).
//
// INVARIANTE L1 — Progress:
//   Toda iteração do Tokenizer consome ao menos uma Source Unit ou encerra o processamento.
//   Nenhum LexicalContract pode permanecer indefinidamente sobre a mesma posição: se o passo não
//   avançar o cursor, o mecanismo avança uma unidade, garantindo progresso estrito e terminação.
export function tokenize<U>(start: Cursor<U>, contract: LexicalContract<U>): TokenStream {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  let current = start;
  while (!atEnd(current)) {
    const step = contract.step(current);
    if (step.kind === 'token') tokens.push(step.token);
    else if (step.kind === 'error') diagnostics.push(step.diagnostic);
    // L1 — Progress: relata todos os erros (nunca aborta) e, se o contrato não avançou,
    // o mecanismo avança uma unidade para garantir progresso estrito.
    current = step.next.offset > current.offset ? step.next : advance(current, 1);
  }
  return { tokens, diagnostics };
}
