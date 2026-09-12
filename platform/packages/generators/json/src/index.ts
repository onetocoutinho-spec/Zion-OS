import type { Diagnostic, DiagnosticCode, IRNode, ValidatedIR } from '@zion/shared';

// A saída de um Generator: o artefato e os Diagnostics propagados.
export interface GeneratorOutput {
  readonly artifact: string;
  readonly diagnostics: readonly Diagnostic[];
}

// REGRAS DOS GENERATORS (formalizadas):
//   G1 — Projection Only: este Generator é uma projeção da ValidatedIR. Nunca modifica a IR.
//        Nunca cria conhecimento.
//   G2 — Independence: depende EXCLUSIVAMENTE da ValidatedIR. Não depende de nenhum outro Generator.
//   G3 — Fidelity: toda informação emitida tem origem rastreável na ValidatedIR. Sem heurística,
//        sem inferência, sem valor inventado. O Valor resolvido é repassado, nunca reinterpretado.
//   G4 — Output Isolation: os artefatos produzidos são TERMINAIS. Nenhum Generator consome a saída
//        de outro Generator. Nenhuma saída de Generator retorna ao pipeline do compilador.
//
// Compiler 008-013 — comportamento comum exigido:
//   - ordem total determinística por Símbolo;
//   - Token Incompleto NUNCA é emitido com Valor inventado: é OMITIDO e acompanhado de
//     `resolution.incomplete` (warning, Compiler 001/005);
//   - nenhum Token ausente da IR é emitido (P3); o Valor resolvido nunca é alterado.
// Compiler 012 — JSON: representação estruturada e neutra. O Valor é repassado tal como declarado.

function incompleteDiagnostic(node: IRNode): Diagnostic {
  return {
    code: 'resolution.incomplete' as DiagnosticCode,
    severity: 'warning',
    location: node.location,
    message: 'Token Incompleto: omitido da geração (Valor terminal ausente).',
    concept: 'Ontologia 5.5.1',
  };
}

// Ordem total determinística por Símbolo (Compiler 001 — Determinism).
function ordered(nodes: readonly IRNode[]): readonly IRNode[] {
  return nodes.slice().sort((a, b) => (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));
}

export function generateJson(validated: ValidatedIR): GeneratorOutput {
  const diagnostics: Diagnostic[] = [];
  const emitted: unknown[] = [];
  for (const node of ordered(validated.ir.nodes)) {
    const resolutions: unknown[] = [];
    for (const resolution of node.resolutions) {
      if (resolution.completeness === 'incomplete') {
        diagnostics.push(incompleteDiagnostic(node));
        continue;
      }
      resolutions.push({
        ...(resolution.context === undefined ? {} : { context: resolution.context }),
        completeness: resolution.completeness,
        ...(resolution.value === undefined ? {} : { value: resolution.value }),
      });
    }
    emitted.push({
      symbol: node.symbol,
      ...(node.matter === undefined ? {} : { matter: node.matter }),
      ...(node.destination === undefined ? {} : { destination: node.destination }),
      resolutions,
    });
  }
  return { artifact: JSON.stringify({ tokens: emitted }, undefined, 2), diagnostics };
}
