import type { Context } from '../ontology/context';
import type { Content } from '../ontology/content';

// Representation 001 — Entrada por Contexto: (Contexto, Conteúdo). Contexto ausente = a entrada invariante única.
// Fato primário; derivado diretamente da Ontologia (P4 · D1).
export interface RepresentationEntry {
  readonly context?: Context;
  readonly content: Content;
}
