import type { SourceId } from './source-id';
import type { Span } from './span';

// Compiler 001 — SourceLocation (Source Position): qual Source + onde. Suficiente para localizar unicamente.
export interface SourceLocation {
  readonly source: SourceId;
  readonly span: Span;
}
