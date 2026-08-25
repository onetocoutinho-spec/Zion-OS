import type { IRNode } from './ir-node';

// Compiler 005 — o IR: o conjunto dos IRNodes projetados a partir do SemanticModel + representação.
export interface IR {
  readonly nodes: readonly IRNode[];
}
