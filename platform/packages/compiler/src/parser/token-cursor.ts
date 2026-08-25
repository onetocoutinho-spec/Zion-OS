import type { Token, SourceId } from '@zion/shared';

// Compiler 003 — Token cursor: posição imutável sobre o Token Stream (índice de Token).
export interface TokenCursor {
  readonly source: SourceId;
  readonly tokens: readonly Token[];
  readonly offset: number;
}

export function createTokenCursor(source: SourceId, tokens: readonly Token[]): TokenCursor {
  return { source, tokens, offset: 0 };
}

// Fim do Token Stream.
export function tokenAtEnd(cursor: TokenCursor): boolean {
  return cursor.offset >= cursor.tokens.length;
}

// Token corrente, ou undefined no fim.
export function peekToken(cursor: TokenCursor): Token | undefined {
  return cursor.tokens[cursor.offset];
}

// Avanço imutável e determinístico; nunca ultrapassa o fim.
export function advanceTokens(cursor: TokenCursor, by: number): TokenCursor {
  const step = by > 0 ? by : 0;
  const target = cursor.offset + step;
  const clamped = target > cursor.tokens.length ? cursor.tokens.length : target;
  return { source: cursor.source, tokens: cursor.tokens, offset: clamped };
}
