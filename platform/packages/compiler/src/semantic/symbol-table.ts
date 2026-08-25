import type { ASTNode, RepresentationNode, Symbol } from '@zion/shared';

// Tabela de Símbolos: Símbolo -> nó da representação (P1 · P3). Construída a partir da representação recebida,
// sem alterá-la (S1). Iteração de entrada determinística; em Símbolo repetido, o último prevalece.
export type SymbolTable = ReadonlyMap<Symbol, RepresentationNode>;

export function buildSymbolTable(nodes: readonly ASTNode[]): SymbolTable {
  const table = new Map<Symbol, RepresentationNode>();
  for (const node of nodes) {
    if (node.kind === 'representation') table.set(node.symbol, node);
  }
  return table;
}
