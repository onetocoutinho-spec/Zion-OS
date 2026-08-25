import type { Context, Diagnostic, SourceLocation, Symbol } from '@zion/shared';
import type { PipelineRequest } from '@zion/compiler';
import { runPipeline } from '@zion/compiler';
import type { RuntimeResult } from '@zion/runtime';
import { resolve } from '@zion/runtime';

// O pedido do Language Server é o do pipeline (Compiler 006): a Source VIVA (buffer de edição),
// tratada como abstrata, mais os contratos injetados. Nenhuma linguagem é assumida.
export type LanguageServerRequest<U> = PipelineRequest<U>;

// Compiler 016 — Language Server: expõe a um editor os Diagnostics do pipeline e a resolução de Tokens.
//
// INVARIANTE LS1 — Query Only:
//   Apenas responde consultas sobre o estado produzido pelo compilador. NUNCA modifica
//   Representation, SemanticModel, IR ou ValidatedIR. Não possui efeito colateral.
// INVARIANTE LS2 — Stateless Requests:
//   Cada requisição é independente: o estado é derivado da Source do próprio pedido. Nenhum estado
//   de sessão altera os resultados (sem cache, sem incrementalidade — ver Pendências).
// INVARIANTE LS3 — Diagnostic Fidelity:
//   Os Diagnostics retornados são EXATAMENTE os produzidos pelo pipeline: o servidor delega ao mesmo
//   `runPipeline` (Compiler 006) e apenas os transporta. Sem heurística, sem alteração de severidade,
//   sem diagnóstico adicional.
//
// O servidor MUST NOT reimplementar fase alguma; delega a 006 (pipeline) e 015 (runtime).
// O servidor MUST NOT eleger Contexto: o Contexto de uma consulta é fornecido pelo editor (015).

// Compiler 016 — Diagnostics ao vivo: corre o pipeline sobre a Source viva e publica os Diagnostics.
export function diagnostics<U>(request: LanguageServerRequest<U>): readonly Diagnostic[] {
  return runPipeline(request).diagnostics;
}

// Compiler 016 — Resolução sob o cursor: dado um Símbolo e um Contexto, responde com o Valor
// resolvido, delegando ao Runtime (015). O Contexto vem do editor, nunca do servidor.
export function resolveSymbol<U>(
  request: LanguageServerRequest<U>,
  symbol: Symbol,
  context?: Context,
): RuntimeResult {
  const { validated } = runPipeline(request);
  return resolve(validated, symbol, context);
}

// Compiler 016 — Navegação por Declaração: localiza a Declaração de um Símbolo pela sua
// Source Position (Compiler 001). Ausente quando o Símbolo não é declarado (P3).
export function declarationOf<U>(
  request: LanguageServerRequest<U>,
  symbol: Symbol,
): SourceLocation | undefined {
  const { validated } = runPipeline(request);
  return validated.ir.nodes.find((node) => node.symbol === symbol)?.location;
}
