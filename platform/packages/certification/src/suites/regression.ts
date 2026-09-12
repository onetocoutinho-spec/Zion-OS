import type { ASTNode, Diagnostic } from '@zion/shared';
import { analyze, buildIR, validate } from '@zion/compiler';
import { generateCss } from '@zion/generator-css';
import { generateJson } from '@zion/generator-json';
import type { CertificationCheck, SuiteResult } from '../report';
import { suiteOf } from '../report';
import { fixtureNodes, stable } from '../fixtures';

function check(id: string, specification: string, passed: boolean): CertificationCheck {
  return { id, specification, passed };
}

// Regression Certification — fixa comportamentos que as especificacoes EXIGEM e cuja regressao seria
// silenciosa. CERT-C2: cada fixacao deriva de uma norma, nunca de conveniencia.
export function regressionSuite(): SuiteResult {
  const checks: CertificationCheck[] = [];
  const validated = validate(buildIR(fixtureNodes, analyze(fixtureNodes)));

  // Compiler 008-013 — Incompleto NUNCA e emitido com Valor inventado: e omitido + `resolution.incomplete`.
  const css = generateCss(validated);
  const incompleteWarnings = css.diagnostics.filter(
    (diagnostic: Diagnostic) => diagnostic.code === 'resolution.incomplete',
  );
  checks.push(
    check(
      'regression.generators.incomplete-warned',
      'Compiler 008 · Incompleto omitido com warning',
      incompleteWarnings.length > 0,
    ),
  );
  checks.push(
    check(
      'regression.generators.incomplete-not-invented',
      'G3 Fidelity · sem valor inventado',
      !css.artifact.includes('--c:'),
    ),
  );

  // Compiler 008-013 — a severidade da Incompletude e `warning`, nunca `error` (Compiler 007).
  checks.push(
    check(
      'regression.generators.incomplete-severity',
      'Compiler 007 · Incompletude nao e error',
      incompleteWarnings.every((d) => d.severity === 'warning'),
    ),
  );

  // Compiler 001 — ordem total deterministica por Simbolo: a ordem de entrada nao altera a saida.
  const shuffled: readonly ASTNode[] = [...fixtureNodes].reverse();
  const shuffledArtifact = generateJson(validate(buildIR(shuffled, analyze(shuffled)))).artifact;
  const originalArtifact = generateJson(validated).artifact;
  checks.push(
    check(
      'regression.generators.symbol-order-stable',
      'Compiler 001 · Determinism (ordem por Simbolo)',
      shuffledArtifact === originalArtifact,
    ),
  );

  // Ontologia 5.5.1 — um Token Incompleto EXISTE no IR: nunca e descartado silenciosamente.
  checks.push(
    check(
      'regression.ir.incomplete-preserved',
      'Ontologia 5.5.1',
      validated.ir.nodes.some((node) => node.symbol === 'c'),
    ),
  );

  // Compiler 007 — V1 Read Only: validar duas vezes nao altera a IR.
  const snapshot = stable(validated.ir);
  validate(validated.ir);
  checks.push(
    check(
      'regression.validator.no-mutation',
      'Compiler 007 · V1 Read Only',
      stable(validated.ir) === snapshot,
    ),
  );

  return suiteOf('regression', checks);
}
