import type { Diagnostic } from '../../contracts/diagnostics/diagnostic';
import type { DiagnosticSeverity } from '../../contracts/diagnostics/diagnostic-severity';

// Compiler 006 §3 — barreira: qualquer Diagnostic de severidade 'error' bloqueia; 'warning' não.
export function hasBlockingError(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === 'error');
}

// Compiler 001 — classificação por severidade.
export function filterBySeverity(
  diagnostics: readonly Diagnostic[],
  severity: DiagnosticSeverity,
): readonly Diagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.severity === severity);
}
