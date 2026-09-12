import type { Diagnostic } from '../../contracts/diagnostics/diagnostic';
import { collectDiagnostics } from './collect';
import { hasBlockingError } from './classify';

// Compiler 006 — o artefato transportável: a coleção ordenada de Diagnostics e a barreira derivada.
export interface DiagnosticReport {
  readonly diagnostics: readonly Diagnostic[];
  readonly blocked: boolean;
}

// Compiler 006 — mecanismo de coleta + classificação + transporte. Função pura e determinística.
// Não origina Diagnostics; apenas acumula, ordena e classifica os recebidos das fases.
export function report(groups: readonly (readonly Diagnostic[])[]): DiagnosticReport {
  const diagnostics = collectDiagnostics(groups);
  return { diagnostics, blocked: hasBlockingError(diagnostics) };
}
