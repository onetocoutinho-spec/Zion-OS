import type { Diagnostic, ValidatedIR } from '@zion/shared';
import { collectDiagnostics, hasBlockingError } from '@zion/shared';
import type { PipelineRequest } from '@zion/compiler';
import { runPipeline } from '@zion/compiler';
import { generateCss } from '@zion/generator-css';
import { generateDocumentation } from '@zion/generator-documentation';
import { generateFigma } from '@zion/generator-figma';
import { generateJson } from '@zion/generator-json';
import { generateReact } from '@zion/generator-react';
import { generateTypeScript } from '@zion/generator-typescript';

// Os alvos de geração são exatamente os Generators congelados (Compiler 008-013).
export type GeneratorTarget = 'css' | 'documentation' | 'figma' | 'json' | 'react' | 'typescript';

// O pedido de compilação é o do pipeline (Compiler 006): Source abstrata + contratos injetados.
export type CompileRequest<U> = PipelineRequest<U>;

export interface ValidateResult {
  readonly validated: ValidatedIR;
  readonly diagnostics: readonly Diagnostic[];
  readonly exitCode: 0 | 1;
}

export interface GeneratedArtifact {
  readonly target: GeneratorTarget;
  readonly artifact: string;
}

export interface GenerateResult {
  readonly artifacts: readonly GeneratedArtifact[];
  readonly diagnostics: readonly Diagnostic[];
  readonly exitCode: 0 | 1;
}

// Compiler 014 — CLI: expõe o pipeline como um contrato de operações determinístico.
//
// INVARIANTE CLI1 — Orchestration Only:
//   A CLI apenas COORDENA. Não contém lógica de fase nem de orquestração: delega integralmente ao
//   Pipeline (Compiler 006) e aos Generators (008-013).
// INVARIANTE CLI2 — Stateless:
//   Nenhum estado arquitetural é persistido. Funções puras; sem cache, sem global, sem I/O.
// INVARIANTE CLI3 — Transparent Errors:
//   Diagnostics são APRESENTADOS, nunca reinterpretados ou alterados. A CLI apenas os coleta e
//   ordena pela Diagnostic Infrastructure (Compiler 006: por Source Position, depois código).

// Operação `validate` (Compiler 014): corre o pipeline até o Validator e reporta os Diagnostics,
// sem gerar artefato algum.
export function validate<U>(request: CompileRequest<U>): ValidateResult {
  const { validated, diagnostics, blocked } = runPipeline(request);
  return { validated, diagnostics, exitCode: blocked ? 1 : 0 };
}

const GENERATORS: Readonly<
  Record<
    GeneratorTarget,
    (validated: ValidatedIR) => { artifact: string; diagnostics: readonly Diagnostic[] }
  >
> = {
  css: generateCss,
  documentation: generateDocumentation,
  figma: generateFigma,
  json: generateJson,
  react: generateReact,
  typescript: generateTypeScript,
};

// Operação `generate` (Compiler 014): corre o pipeline e invoca os Generators selecionados sobre a
// IR validada. Barreira de Compiler 006: um Diagnostic `error` IMPEDE a entrada dos Generators;
// `warning` não bloqueia. Ordem de invocação determinística (alvos ordenados).
export function generate<U>(
  request: CompileRequest<U>,
  targets: readonly GeneratorTarget[],
): GenerateResult {
  const { validated, diagnostics, blocked } = runPipeline(request);
  if (blocked) {
    return { artifacts: [], diagnostics, exitCode: 1 };
  }
  const artifacts: GeneratedArtifact[] = [];
  const groups: (readonly Diagnostic[])[] = [diagnostics];
  for (const target of targets.slice().sort()) {
    const output = GENERATORS[target](validated);
    artifacts.push({ target, artifact: output.artifact });
    groups.push(output.diagnostics);
  }
  const collected = collectDiagnostics(groups);
  return { artifacts, diagnostics: collected, exitCode: hasBlockingError(collected) ? 1 : 0 };
}
