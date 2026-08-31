import type { SourceId } from '@zion/shared';
import type { Cursor } from './cursor';

// Compiler 002 — SourceReader: cria o cursor inicial sobre um fluxo ordenado de Source Units opacas.
// Única origem de Source Position; não interpreta a unidade.
export function createCursor<U>(source: SourceId, units: readonly U[]): Cursor<U> {
  return { source, units, offset: 0 };
}
