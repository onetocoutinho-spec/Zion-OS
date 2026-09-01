// REGRA FORMAL (infraestrutura de diagnósticos):
//   A infraestrutura de diagnósticos é completamente agnóstica da origem dos diagnósticos.
//   Ela não conhece Lexer, Parser, Semantic Analysis, Validator, Runtime ou qualquer outra fase.
//   Opera exclusivamente sobre o contrato `Diagnostic` (Compiler 001).
export { compareLocation, compareDiagnostic } from './order';
export { collectDiagnostics } from './collect';
export { hasBlockingError, filterBySeverity } from './classify';
export { report } from './report';
export type { DiagnosticReport } from './report';
