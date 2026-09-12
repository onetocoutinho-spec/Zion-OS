// REGRA C1 — Contract Minimality:
//   Campos públicos só podem tornar-se opcionais quando isso for necessário para preservar fielmente
//   estados permitidos pelas especificações. Opcionalidade nunca é conveniência de implementação.
//   Aplicações vigentes: IRNode.matter (M1 — Matter Opacity) e Resolution.context (entrada invariante, P4).
export type * from './ontology';
export type * from './representation';
export type * from './source';
export type * from './token';
export type * from './diagnostics';
export type * from './ast';
export type * from './ir';
