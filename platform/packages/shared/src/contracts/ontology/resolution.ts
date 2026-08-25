import type { Context } from './context';
import type { Completeness } from './completeness';

// 5.1 — Resolução: o resultado da Resolução de um Token sob um Contexto.
export interface Resolution {
  // Contexto da Resolução; ausente = a entrada invariante única (P4). Opcional por losslessness (IR1).
  readonly context?: Context;
  readonly completeness: Completeness;
  // Valor terminal opaco quando Completo; ausente quando Incompleto (5.5.1).
  readonly value?: unknown;
}
