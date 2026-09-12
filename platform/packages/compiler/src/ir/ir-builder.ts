import type { ASTNode, IR, IRNode, Resolution, Symbol } from '@zion/shared';
import { buildSymbolTable } from '../semantic/symbol-table';
import { entryContent } from '../semantic/resolution';
import type { SemanticModel, SymbolFacts } from '../semantic/semantic-model';
import { resolveTerminalValue } from './terminal-value';

// Compiler 005 — projeção do SemanticModel na IR. NÃO cria conhecimento; apenas reorganiza fatos existentes.
//
// INVARIANTE IR1 — Losslessness:
//   Todo fato da representação e da análise semântica permanece representável no IR
//   (Símbolo, Matéria — inclusive `unresolved` por M1 —, Completude e Valor por Contexto, Destinação).
// INVARIANTE IR2 — No New Facts:
//   O IR não infere nem avalia. A resolução do Valor terminal é substituição de Referência por
//   Conteúdo já declarado (5.1); Operações não são avaliadas.
// INVARIANTE IR3 — Deterministic Projection:
//   Mesmo SemanticModel + mesma representação => mesmo IR. Iteração em ordem de entrada; sem estado externo.
// INVARIANTE IR4 — No Evaluation:
//   O IR jamais executa operações nem calcula resultados. Apenas reorganiza fatos existentes.
//   Um Composite (Operação) nunca é avaliado: o seu Valor terminal permanece ausente.
export function buildIR(nodes: readonly ASTNode[], model: SemanticModel): IR {
  const table = buildSymbolTable(nodes);
  const factsBySymbol = new Map<Symbol, SymbolFacts>(
    model.facts.map((facts) => [facts.symbol, facts]),
  );
  const irNodes: IRNode[] = [];
  for (const node of nodes) {
    if (node.kind !== 'representation') continue;
    const facts = factsBySymbol.get(node.symbol);
    if (facts === undefined) continue;
    const resolutions: Resolution[] = facts.contexts.map((contextFacts) => {
      const content = entryContent(node, contextFacts.context);
      const value =
        contextFacts.completeness === 'complete' && content !== undefined
          ? resolveTerminalValue(
              table,
              content,
              contextFacts.context,
              new Set<Symbol>([node.symbol]),
            )
          : undefined;
      const resolution: Resolution = {
        completeness: contextFacts.completeness,
        ...(contextFacts.context === undefined ? {} : { context: contextFacts.context }),
        ...(value === undefined ? {} : { value }),
      };
      return resolution;
    });
    const irNode: IRNode = {
      symbol: node.symbol,
      resolutions,
      location: node.location,
      ...(facts.matter.resolved ? { matter: facts.matter.matter } : {}),
      ...(facts.destination === undefined ? {} : { destination: facts.destination }),
    };
    irNodes.push(irNode);
  }
  return { nodes: irNodes };
}
