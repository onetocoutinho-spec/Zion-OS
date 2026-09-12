import type { Diagnostic } from '../../contracts/diagnostics/diagnostic';
import { compareDiagnostic } from './order';

// Compiler 006 §2 — acumular os Diagnostics de todas as fases numa coleção única e ordenada por Source Position.
// Função pura e determinística: a entrada não é mutada; a saída é uma nova coleção ordenada.
export function collectDiagnostics(
  groups: readonly (readonly Diagnostic[])[],
): readonly Diagnostic[] {
  const merged: Diagnostic[] = [];
  for (const group of groups) {
    for (const diagnostic of group) merged.push(diagnostic);
  }
  return merged.sort(compareDiagnostic);
}
