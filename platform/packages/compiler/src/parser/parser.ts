import type { ASTNode, Diagnostic } from '@zion/shared';
import type { TokenCursor } from './token-cursor';
import { tokenAtEnd, advanceTokens } from './token-cursor';
import type { ConstructionContract } from './construction-contract';

// Compiler 003 — o resultado do Parser: a representação operacional construída e os Diagnostics sintáticos.
// Os nós são ASTNode (Representation compatível); o Representation Model permanece a autoridade normativa.
export interface ParseResult {
  readonly nodes: readonly ASTNode[];
  readonly diagnostics: readonly Diagnostic[];
}

// Parser Engine — mecanismo genérico e determinístico. Consome EXCLUSIVAMENTE o ConstructionContract injetado;
// não conhece gramática, precedência, sintaxe nem linguagem. Constrói uma representação operacional compatível
// com o Representation Model. Integra com a Diagnostic Infrastructure (família syntactic, Compiler 001).
//
// INVARIANTE P1 — Deterministic Construction:
//   Mesmo TokenStream + mesmo ConstructionContract ⇒ mesma representação. (Função pura, sem estado externo.)
// INVARIANTE P2 — Progress:
//   Toda iteração consome ao menos um Token ou conclui o processamento. Nenhum Parser permanece
//   indefinidamente sobre o mesmo Token: se o passo não avançar, o mecanismo avança um Token.
export function parse(start: TokenCursor, contract: ConstructionContract): ParseResult {
  const nodes: ASTNode[] = [];
  const diagnostics: Diagnostic[] = [];
  let current = start;
  while (!tokenAtEnd(current)) {
    const step = contract.step(current);
    if (step.kind === 'node') nodes.push(step.node);
    else if (step.kind === 'error') diagnostics.push(step.diagnostic);
    // P2 — Progress: se o contrato não avançou, o mecanismo avança um Token (progresso estrito, terminação).
    current = step.next.offset > current.offset ? step.next : advanceTokens(current, 1);
  }
  return { nodes, diagnostics };
}
