import type { ASTNode, Diagnostic } from '@zion/shared';
import type { TokenCursor } from './token-cursor';

// PRINCÍPIO (RFC-05, aprovada):
//   O mecanismo do Parser é permanente.
//   O contrato de construção é substituível.
//   Linguagens futuras adaptam-se ao mecanismo.
//   O mecanismo nunca é adaptado à linguagem.

// Um passo de construção, produzido pelo ConstructionContract a partir do cursor de Tokens:
//   'node'  — um nó da representação construído, com o cursor avançado;
//   'skip'  — um Token consumido sem produzir nó;
//   'error' — um Diagnostic sintático (Compiler 001) e o ponto de ressincronização.
export type ConstructionStep =
  | { readonly kind: 'node'; readonly node: ASTNode; readonly next: TokenCursor }
  | { readonly kind: 'skip'; readonly next: TokenCursor }
  | { readonly kind: 'error'; readonly diagnostic: Diagnostic; readonly next: TokenCursor };

// Compiler 003 — ConstructionContract: o contrato de CONSTRUÇÃO injetado. O Parser NÃO depende de uma
// gramática; depende apenas deste contrato de construção da representação. As regras de produção concretas
// (a gramática) pertencem ao seu domínio. Este pacote NÃO define nenhum contrato concreto.
// Qualquer ConstructionContract usado em testes é NÃO NORMATIVO e jamais serve como autoridade arquitetural.
export interface ConstructionContract {
  readonly step: (cursor: TokenCursor) => ConstructionStep;
}
