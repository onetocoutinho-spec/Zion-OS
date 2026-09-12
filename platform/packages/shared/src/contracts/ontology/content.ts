import type { Reference } from './reference';

// P2 — Conteúdo Atomic: payload terminal opaco (a Espécie é derivada, não representada).
export interface AtomicContent {
  readonly kind: 'atomic';
  readonly payload: unknown;
}

// D2 — Conteúdo Reference.
export interface ReferenceContent {
  readonly kind: 'reference';
  readonly reference: Reference;
}

// P6 — Conteúdo Composite: um operador e os seus operandos.
export interface CompositeContent {
  readonly kind: 'composite';
  readonly operator: string;
  readonly operands: readonly Content[];
}

// D1 — as três formas ontológicas de Conteúdo.
export type Content = AtomicContent | ReferenceContent | CompositeContent;
