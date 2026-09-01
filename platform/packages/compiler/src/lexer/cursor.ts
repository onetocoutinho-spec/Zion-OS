import type { SourceId, Position } from '@zion/shared';

// Compiler 002 — Cursor imutável: a posição corrente sobre o fluxo ordenado de Source Units opacas.
// A unidade U é um parâmetro de tipo: a sua forma concreta é diferida à LexicalSpecification.
export interface Cursor<U> {
  readonly source: SourceId;
  readonly units: readonly U[];
  readonly offset: number;
}

// Position tracking (Compiler 001) — a posição corrente como offset sobre a Source abstrata.
export function positionAt<U>(cursor: Cursor<U>): Position {
  return { offset: cursor.offset };
}

// EOF — o cursor esgotou o fluxo de unidades.
export function atEnd<U>(cursor: Cursor<U>): boolean {
  return cursor.offset >= cursor.units.length;
}

// Unidade corrente (opaca), ou undefined em EOF. O mecanismo nunca a inspeciona.
export function peek<U>(cursor: Cursor<U>): U | undefined {
  return cursor.units[cursor.offset];
}

// Avanço imutável e determinístico; nunca ultrapassa o fim.
export function advance<U>(cursor: Cursor<U>, by: number): Cursor<U> {
  const step = by > 0 ? by : 0;
  const target = cursor.offset + step;
  const clamped = target > cursor.units.length ? cursor.units.length : target;
  return { source: cursor.source, units: cursor.units, offset: clamped };
}
