import type { Content, Context, Symbol } from '@zion/shared';
import type { SymbolTable } from '../semantic/symbol-table';
import { entryContent } from '../semantic/resolution';

// Resolve o Valor terminal de um Conteúdo por REORGANIZAÇÃO (IR2 — No New Facts): substitui a Referência
// pelo Conteúdo já declarado do alvo (5.1), até uma base atômica. Nenhum conhecimento novo é criado:
//   Atomic    -> o payload já declarado (o Valor terminal);
//   Reference -> o Valor terminal do alvo (pendente/ciclo -> ausente);
//   Composite -> ausente (uma Operação não é Valor terminal; a sua avaliação é do runtime, não do IR).
export function resolveTerminalValue(
  table: SymbolTable,
  content: Content,
  context: Context | undefined,
  visited: ReadonlySet<Symbol>,
): unknown {
  if (content.kind === 'atomic') return content.payload;
  if (content.kind === 'composite') return undefined;
  const target = content.reference.target;
  if (visited.has(target)) return undefined;
  const targetNode = table.get(target);
  if (targetNode === undefined) return undefined;
  const targetContent = entryContent(targetNode, context);
  if (targetContent === undefined) return undefined;
  const nextVisited = new Set(visited);
  nextVisited.add(target);
  return resolveTerminalValue(table, targetContent, context, nextVisited);
}
