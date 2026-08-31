import type { Diagnostic, SourceId, ValidatedIR } from '@zion/shared';
import { collectDiagnostics, hasBlockingError } from '@zion/shared';
import type { LexicalContract } from '../lexer/lexical-contract';
import { createCursor } from '../lexer/source-reader';
import { tokenize } from '../lexer/tokenizer';
import type { ConstructionContract } from '../parser/construction-contract';
import { createTokenCursor } from '../parser/token-cursor';
import { parse } from '../parser/parser';
import { analyze } from '../semantic/semantic-model';
import { buildIR } from '../ir/ir-builder';
import { validate } from '../validator/validator';

// O pedido do pipeline. A Source é ABSTRATA (Compiler 001): unidades opacas (U) e contratos
// léxico/de construção INJETADOS — nenhuma linguagem é assumida.
export interface PipelineRequest<U> {
  readonly source: SourceId;
  readonly units: readonly U[];
  readonly lexical: LexicalContract<U>;
  readonly construction: ConstructionContract;
}

export interface PipelineResult {
  readonly validated: ValidatedIR;
  readonly diagnostics: readonly Diagnostic[];
  readonly blocked: boolean;
}

// Compiler 006 — Pipeline: a orquestração determinística das fases.
//   Ordem: 002 -> 003 -> 004 -> 005 -> 007 (DAG de Compiler 001).
//   Propagação: acumula os Diagnostics de TODAS as fases numa coleção única, ordenada por
//     Source Position e depois por código (Diagnostic Infrastructure de @zion/shared).
//   Barreira: `error` impede a entrada dos Generators; `warning` (ex.: Incompletude) não bloqueia.
//
// O pipeline MUST NOT originar Diagnostics próprios e MUST NOT conter lógica de fase: apenas compõe.
// É o ÚNICO orquestrador — CLI (014) e Language Server (016) delegam a ele, o que garante que os
// seus Diagnostics sejam identicamente os do pipeline (LS3 — Diagnostic Fidelity).
export function runPipeline<U>(request: PipelineRequest<U>): PipelineResult {
  const cursor = createCursor(request.source, request.units);
  const stream = tokenize(cursor, request.lexical);
  const tokenCursor = createTokenCursor(request.source, stream.tokens);
  const parsed = parse(tokenCursor, request.construction);
  const model = analyze(parsed.nodes);
  const ir = buildIR(parsed.nodes, model);
  const validated = validate(ir);
  const diagnostics = collectDiagnostics([
    stream.diagnostics,
    parsed.diagnostics,
    model.diagnostics,
    validated.diagnostics,
  ]);
  return { validated, diagnostics, blocked: hasBlockingError(diagnostics) };
}
