import type { Diagnostic } from '../../contracts/diagnostics/diagnostic';
import type { SourceLocation } from '../../contracts/source/source-location';

// Compiler 006 — ordem total por Source Position: source, depois offset de início, depois de fim.
export function compareLocation(a: SourceLocation, b: SourceLocation): number {
  if (a.source !== b.source) return a.source < b.source ? -1 : 1;
  if (a.span.start.offset !== b.span.start.offset) return a.span.start.offset - b.span.start.offset;
  return a.span.end.offset - b.span.end.offset;
}

// Compiler 006 — ordenação por Source Position, então por código (e mensagem como desempate total).
export function compareDiagnostic(a: Diagnostic, b: Diagnostic): number {
  const byLocation = compareLocation(a.location, b.location);
  if (byLocation !== 0) return byLocation;
  if (a.code !== b.code) return a.code < b.code ? -1 : 1;
  if (a.message !== b.message) return a.message < b.message ? -1 : 1;
  return 0;
}
