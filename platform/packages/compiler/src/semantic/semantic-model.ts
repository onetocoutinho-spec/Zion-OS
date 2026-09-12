import type {
  ASTNode,
  Context,
  Completeness,
  Destination,
  Diagnostic,
  Species,
  Symbol,
} from '@zion/shared';
import { buildSymbolTable } from './symbol-table';
import { speciesOfContent } from './species';
import { contentCompleteness } from './resolution';
import type { MatterResolution } from './matter';
import { resolveMatter } from './matter';

// Fatos derivados de um Contexto de um Símbolo (Espécie por forma + Completude da sua cadeia).
export interface ContextFacts {
  readonly context?: Context;
  readonly species: Species;
  readonly completeness: Completeness;
}

// Fatos derivados de um Símbolo. ACRESCENTADOS à representação, nunca substituindo-a (S1).
export interface SymbolFacts {
  readonly symbol: Symbol;
  readonly contexts: readonly ContextFacts[];
  readonly matter: MatterResolution;
  readonly destination?: Destination;
}

// O resultado da análise semântica: os fatos derivados + os Diagnostics semânticos.
export interface SemanticModel {
  readonly facts: readonly SymbolFacts[];
  readonly diagnostics: readonly Diagnostic[];
}

// Compiler 004/005 + Ontologia — Semantic Analysis. Deriva os fatos da Ontologia SOBRE a representação
// recebida, sem alterá-la (S1 Monotonicity). Determinística: mesma AST + mesma Ontologia => mesmo
// resultado (S2). Não infere: apenas fatos com fundamento direto na Ontologia (S3 Non-Inference).
export function analyze(nodes: readonly ASTNode[]): SemanticModel {
  const table = buildSymbolTable(nodes);
  const diagnostics: Diagnostic[] = [];
  const facts: SymbolFacts[] = [];
  for (const node of nodes) {
    if (node.kind !== 'representation') continue;
    const contexts: ContextFacts[] = node.entries.map((entry) => ({
      context: entry.context,
      species: speciesOfContent(entry.content),
      completeness: contentCompleteness(
        table,
        entry.content,
        entry.context,
        new Set<Symbol>([node.symbol]),
        diagnostics,
        node.location,
      ),
    }));
    facts.push({
      symbol: node.symbol,
      contexts,
      matter: resolveMatter(),
      destination: node.destination,
    });
  }
  return { facts, diagnostics };
}
