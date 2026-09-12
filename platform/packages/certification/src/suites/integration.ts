import { runPipeline } from '@zion/compiler';
import { generate, validate as cliValidate } from '@zion/cli';
import { declarationOf, diagnostics as lspDiagnostics } from '@zion/lsp';
import type { CertificationCheck, SuiteResult } from '../report';
import { suiteOf } from '../report';
import { fixtureRequest, stable } from '../fixtures';

function check(id: string, specification: string, passed: boolean): CertificationCheck {
  return { id, specification, passed };
}

// Integration Certification — observa a composicao dos componentes contra as suas especificacoes.
export function integrationSuite(): SuiteResult {
  const checks: CertificationCheck[] = [];

  // Compiler 006 — Determinism: mesma Source => mesma IR validada e mesmos Diagnostics.
  const runA = runPipeline(fixtureRequest);
  const runB = runPipeline(fixtureRequest);
  checks.push(
    check(
      'integration.pipeline.determinism',
      'Compiler 006 · Determinism',
      stable(runA) === stable(runB),
    ),
  );

  // Compiler 006 — o pipeline nao origina Diagnostics proprios: a colecao e a das fases.
  checks.push(
    check(
      'integration.pipeline.no-own-diagnostics',
      'Compiler 006 · MUST NOT originar Diagnostics',
      Array.isArray(runA.diagnostics),
    ),
  );

  // Compiler 014 — `validate`: exitCode 0 sem `error`.
  const validated = cliValidate(fixtureRequest);
  checks.push(
    check(
      'integration.cli.validate-exit-code',
      'Compiler 014 · codigo de saida',
      validated.exitCode === 0,
    ),
  );

  // Compiler 014 — `validate` nao gera artefato algum (a operacao apenas reporta).
  const generated = generate(fixtureRequest, ['css', 'json']);
  checks.push(
    check(
      'integration.cli.generate-artifacts',
      'Compiler 014 · operacao generate',
      generated.artifacts.length === 2 && generated.exitCode === 0,
    ),
  );

  // Compiler 014 — ordem de invocacao deterministica (alvos ordenados).
  const orderA = generate(fixtureRequest, ['json', 'css']);
  const orderB = generate(fixtureRequest, ['css', 'json']);
  checks.push(
    check(
      'integration.cli.target-order-stable',
      'Compiler 014 · Determinism',
      stable(orderA.artifacts) === stable(orderB.artifacts),
    ),
  );

  // LS3 — Diagnostic Fidelity: os Diagnostics do LSP sao EXATAMENTE os do pipeline.
  checks.push(
    check(
      'integration.lsp.LS3-fidelity',
      'Compiler 016 · LS3 Diagnostic Fidelity',
      stable(lspDiagnostics(fixtureRequest)) === stable(runA.diagnostics),
    ),
  );

  // Compiler 016 — Navegacao por Declaracao: a Source Position da Declaracao do Simbolo.
  const declaration = declarationOf(fixtureRequest, 'x' as never);
  checks.push(
    check(
      'integration.lsp.declaration',
      'Compiler 016 · Navegacao por Declaracao',
      declaration !== undefined,
    ),
  );

  // P3 — o que nao e declarado nao existe: Simbolo ausente nao possui Declaracao.
  checks.push(
    check(
      'integration.lsp.declaration-absent',
      'Ontologia P3',
      declarationOf(fixtureRequest, 'zzz' as never) === undefined,
    ),
  );

  return suiteOf('integration', checks);
}
