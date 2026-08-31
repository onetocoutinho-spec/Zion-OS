import type {
  Content,
  Context,
  Completeness,
  Diagnostic,
  DiagnosticCode,
  RepresentationNode,
  SourceLocation,
  Symbol,
} from '@zion/shared';
import type { SymbolTable } from './symbol-table';

// Construtor de Diagnostic semântico (Compiler 001). O código é um branded string estável.
export function semanticDiagnostic(
  code: string,
  location: SourceLocation,
  message: string,
  concept: string,
): Diagnostic {
  return { code: code as DiagnosticCode, severity: 'error', location, message, concept };
}

// O Conteúdo de um nó sob um Contexto: a entrada exata, ou a entrada invariante única (Contexto ausente).
export function entryContent(
  node: RepresentationNode,
  context: Context | undefined,
): Content | undefined {
  const exact = node.entries.find((entry) => entry.context === context);
  if (exact) return exact.content;
  const invariant = node.entries.find((entry) => entry.context === undefined);
  return invariant?.content;
}

// Completude (5.5) por percurso mecânico da Cadeia de Resolução (5.1/5.2), com detecção de
// Referência pendente (P3) e ciclo (5.3.1). Sem inferência (S3).
export function contentCompleteness(
  table: SymbolTable,
  content: Content,
  context: Context | undefined,
  visited: ReadonlySet<Symbol>,
  diagnostics: Diagnostic[],
  location: SourceLocation,
): Completeness {
  if (content.kind === 'atomic') return 'complete';
  if (content.kind === 'composite') {
    for (const operand of content.operands) {
      if (
        contentCompleteness(table, operand, context, visited, diagnostics, location) ===
        'incomplete'
      ) {
        return 'incomplete';
      }
    }
    return 'complete';
  }
  const target = content.reference.target;
  const targetNode = table.get(target);
  if (targetNode === undefined) {
    diagnostics.push(
      semanticDiagnostic(
        'semantic.dangling-reference',
        location,
        'Referência a Símbolo não declarado.',
        'Ontologia P3',
      ),
    );
    return 'incomplete';
  }
  if (visited.has(target)) {
    diagnostics.push(
      semanticDiagnostic(
        'semantic.cycle',
        location,
        'Ciclo de Dependência na Resolução.',
        'Ontologia 5.3.1',
      ),
    );
    return 'incomplete';
  }
  const targetContent = entryContent(targetNode, context);
  if (targetContent === undefined) return 'incomplete';
  const nextVisited = new Set(visited);
  nextVisited.add(target);
  return contentCompleteness(table, targetContent, context, nextVisited, diagnostics, location);
}
