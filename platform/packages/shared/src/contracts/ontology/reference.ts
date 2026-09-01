import type { Symbol } from './symbol';

// D2 — Referência: Conteúdo que consiste num Símbolo.
export interface Reference {
  readonly target: Symbol;
}
