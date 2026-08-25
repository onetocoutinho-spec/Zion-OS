import type { Token, Diagnostic } from '@zion/shared';
import type { Cursor } from './cursor';

// PRINCÍPIO (RFC-04, aprovada):
//   O mecanismo do Lexer é permanente.
//   O contrato léxico é substituível.
//   Linguagens futuras adaptam-se ao mecanismo.
//   O mecanismo nunca é adaptado à linguagem.

// Um passo de reconhecimento léxico, produzido pelo LexicalContract a partir do cursor:
//   'token' — um Token reconhecido, com o cursor avançado;
//   'skip'  — uma unidade ignorável (o análogo de whitespace/comment, definido pelo contrato);
//   'error' — um Diagnostic léxico (Compiler 001) e o ponto de ressincronização.
export type LexStep<U> =
  | { readonly kind: 'token'; readonly token: Token; readonly next: Cursor<U> }
  | { readonly kind: 'skip'; readonly next: Cursor<U> }
  | { readonly kind: 'error'; readonly diagnostic: Diagnostic; readonly next: Cursor<U> };

// Compiler 002 — LexicalContract: o contrato léxico OPERACIONAL injetado. Fornece as regras léxicas
// concretas; o conjunto de TokenKind e a forma das Source Units (U) pertencem ao seu domínio.
// Este pacote NÃO define nenhum contrato concreto — apenas a interface que o mecanismo consome.
// Qualquer LexicalContract usado em testes é NÃO NORMATIVO e jamais serve como autoridade arquitetural.
export interface LexicalContract<U> {
  readonly step: (cursor: Cursor<U>) => LexStep<U>;
}
