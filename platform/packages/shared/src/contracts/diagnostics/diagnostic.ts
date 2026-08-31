import type { DiagnosticCode } from './diagnostic-code';
import type { DiagnosticSeverity } from './diagnostic-severity';
import type { SourceLocation } from '../source/source-location';

// Compiler 001 — Diagnostic: a única forma de comunicar um problema.
//
// REGRA D1 — Diagnostic Traceability:
//   Todo Diagnostic DEVE possuir uma localização normativa (`location`). Quando ela não existir,
//   o componente DEVE comunicar o estado operacional SEM inventar um Diagnostic.
//   Por isso `location` é obrigatória e nunca sintética. Aplicação vigente: o Runtime, perante um
//   Símbolo ausente da IR (sem Source Position possível), reporta o ESTADO `unknown-symbol` em vez
//   de fabricar um Diagnostic (Compiler 015).
export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly location: SourceLocation;
  readonly message: string;
  // Referência ao conceito congelado violado (Ontologia Parte 7 / system/004 Parte C).
  readonly concept: string;
}
