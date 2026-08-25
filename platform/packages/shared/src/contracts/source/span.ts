import type { Position } from './position';

// Compiler 002 — Span: intervalo [start, end) sobre a Source.
export interface Span {
  readonly start: Position;
  readonly end: Position;
}
