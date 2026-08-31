import type {
  Context,
  Diagnostic,
  DiagnosticCode,
  IRNode,
  Resolution,
  Symbol,
  ValidatedIR,
} from '@zion/shared';

// O resultado de um pedido de resolução no Runtime.
//   'value'          — o Valor terminal resolvido (5.1);
//   'incomplete'     — a marca de Incompletude (5.5.1), nunca um Valor inventado;
//   'unevaluated'    — Resolução Completa cujo Conteúdo é uma Operação (P6): a avaliação exige
//                      semântica de operador, que NENHUM pilar congelado define (ver R2, abaixo);
//   'unknown-symbol' — Símbolo ausente da IR (P3: o que não é declarado não existe).
export type RuntimeResolution =
  | { readonly kind: 'value'; readonly value: unknown }
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'unevaluated' }
  | { readonly kind: 'unknown-symbol' };

export interface RuntimeResult {
  readonly resolution: RuntimeResolution;
  readonly diagnostics: readonly Diagnostic[];
}

// Compiler 015 — Runtime: aplica a Resolução (5.1) sobre a ValidatedIR no momento do consumo.
//
// INVARIANTE R1 — Runtime Independence:
//   O Runtime consome a ValidatedIR, mas NUNCA modifica Representation, SemanticModel, IR ou
//   ValidatedIR. Não possui efeito colateral: é função pura de (ValidatedIR, Símbolo, Contexto).
// INVARIANTE R2 — Runtime Evaluation:
//   Toda avaliação ocorre EXCLUSIVAMENTE aqui. Nenhuma Operação é antecipada pelo Compiler (IR4 —
//   No Evaluation) nem pelos Generators (G1/G3). Consequência honesta: a semântica dos operadores
//   não é definida por nenhum pilar congelado, logo nenhuma Operação é avaliada neste nível — o
//   estado é reportado como 'unevaluated', jamais inventado.
// INVARIANTE R3 — Deferred Evaluation:
//   Na ausência de uma semântica normativa para uma Operação, o Runtime retorna `unevaluated`.
//   Esse estado representa AUSÊNCIA LEGÍTIMA de semântica executável, nunca erro nem omissão.
//
// Contexto vigente: é PARÂMETRO do pedido. O Runtime NUNCA elege, persiste ou troca Contexto
// (a Eleição de Contexto é incompatibilidade registrada — system/004 Parte C — e pertence a quem chama).
function incompleteDiagnostic(node: IRNode): Diagnostic {
  return {
    code: 'resolution.incomplete' as DiagnosticCode,
    severity: 'warning',
    location: node.location,
    message: 'Resolução Incompleta: a Cadeia não encerra em Valor.',
    concept: 'Ontologia 5.5.1',
  };
}

// 5.4 — Precedência elege exatamente um Conteúdo por Contexto: a Resolução exata do Contexto,
// ou a entrada invariante única (Contexto ausente).
function resolutionFor(node: IRNode, context: Context | undefined): Resolution | undefined {
  const exact = node.resolutions.find((resolution) => resolution.context === context);
  if (exact !== undefined) return exact;
  return node.resolutions.find((resolution) => resolution.context === undefined);
}

export function resolve(validated: ValidatedIR, symbol: Symbol, context?: Context): RuntimeResult {
  const node = validated.ir.nodes.find((candidate) => candidate.symbol === symbol);
  if (node === undefined) {
    // Símbolo ausente da IR: sinalizado pelo ESTADO do resultado. Um Diagnostic posicionado é
    // impossível — não existe Source Position para um Símbolo que a IR não contém, e inventá-la
    // violaria a fidelidade. O estado é o sinal.
    return { resolution: { kind: 'unknown-symbol' }, diagnostics: [] };
  }
  const resolution = resolutionFor(node, context);
  if (resolution === undefined || resolution.completeness === 'incomplete') {
    return { resolution: { kind: 'incomplete' }, diagnostics: [incompleteDiagnostic(node)] };
  }
  if (resolution.value === undefined) {
    // Completa, mas sem Valor terminal: o Conteúdo é uma Operação (P6). Ver R2.
    return { resolution: { kind: 'unevaluated' }, diagnostics: [] };
  }
  return { resolution: { kind: 'value', value: resolution.value }, diagnostics: [] };
}
