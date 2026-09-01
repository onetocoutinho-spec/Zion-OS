import type { TokenKind } from './token-kind';
import type { SourceLocation } from '../source/source-location';

// Compiler 002 — Token: um kind e a sua localização na Source. O span do lexema é SourceLocation.span.
export interface Token {
  readonly kind: TokenKind;
  readonly location: SourceLocation;
}
