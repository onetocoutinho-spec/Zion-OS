import type { Diagnostic } from '../diagnostics/diagnostic';
import type { IR } from './ir';

// Compiler 007 — a IR validada: a MESMA IR, os Diagnostics da validação e a aptidão para geração.
// `apt` é verdadeiro se e somente se não houver Diagnostic de severidade `error`.
// É a ÚNICA entrada dos Generators (G2 — Independence).
export interface ValidatedIR {
  readonly ir: IR;
  readonly diagnostics: readonly Diagnostic[];
  readonly apt: boolean;
}
