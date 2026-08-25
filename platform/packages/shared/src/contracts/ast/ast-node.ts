import type { Symbol } from '../ontology/symbol';
import type { Context } from '../ontology/context';
import type { Content } from '../ontology/content';
import type { Destination } from '../ontology/destination';
import type { SourceLocation } from '../source/source-location';

// Representation 001 / Compiler 003 — Entrada por Contexto: Contexto (ausente = invariante único) + Conteúdo.
export interface ContextEntry {
  readonly context?: Context;
  readonly content: Content;
}

// Compiler 003 — nó estrutural neutro da árvore: liga um Símbolo (P1) ao Conteúdo instituído por
// Contexto (P3/D1) e à Destinação (D3) quando declarada. Nome estrutural (não ontológico) para manter
// a neutralidade da árvore; corresponde ao nó que a Compiler 003 designa como o nó de Declaração.
export interface RepresentationNode {
  readonly kind: 'representation';
  readonly symbol: Symbol;
  readonly entries: readonly ContextEntry[];
  readonly destination?: Destination;
  readonly location: SourceLocation;
}

// Compiler 003 — o vocabulário de nós da árvore: o nó estrutural e as três formas ontológicas de Conteúdo.
export type ASTNode = RepresentationNode | Content;
