import type { Diagnostic } from '@zion/shared';
import { collectDiagnostics } from '@zion/shared';
import { runPipeline } from '@zion/compiler';
import type {
  CertificationCheck,
  CertificationReport,
  CertificationSummary,
  SuiteName,
  SuiteResult,
} from './report';
import { fixtureRequest } from './fixtures';
import { unitSuite } from './suites/unit';
import { integrationSuite } from './suites/integration';
import { goldenSuite } from './suites/golden';
import { regressionSuite } from './suites/regression';
import { propertySuite } from './suites/property';
import { performanceSuite } from './suites/performance';
import { roundtripSuite } from './suites/roundtrip';

// ─────────────────────────────────────────────────────────────────────────────
// @zion/certification — certifica a conformidade da plataforma. NAO implementa funcionalidade
// alguma da Zion Platform: apenas verifica.
//
// INVARIANTE CERT-C1 — Certification Is Observational:
//   A certificacao NUNCA modifica qualquer componente. Ela apenas OBSERVA o comportamento produzido
//   por Compiler, Runtime, Generators, CLI e Language Server. Nenhuma mutacao e permitida.
//   (Namespace CERT-* por colisao com a regra C1 — Contract Minimality, ja vigente em
//    @zion/shared/contracts. Ver relatorio da PHASE 14.)
// INVARIANTE CERT-C2 — Specification Driven:
//   Toda verificacao possui rastreabilidade direta para uma especificacao normativa — o campo
//   `specification` de cada CertificationCheck. Nenhum teste existe por implementacao, comportamento
//   observado, conveniencia ou expectativa implicita.
// INVARIANTE CERT-C3 — Fixtures Are Non-Normative:
//   Os fixtures (./fixtures) apenas exercitam contratos. Nao definem comportamento, nao complementam
//   especificacoes, nao criam semantica.
// INVARIANTE CERT-C4 — Deterministic Certification:
//   A mesma suite sobre a mesma implementacao produz EXATAMENTE o mesmo relatorio. Sem ordem
//   aleatoria (as suites correm em ordem fixa), sem geracao randomica, sem relogio, sem ambiente.
// ─────────────────────────────────────────────────────────────────────────────

export type {
  CertificationCheck,
  CertificationReport,
  CertificationSummary,
  SuiteName,
  SuiteResult,
};

// Ordem FIXA das suites (CERT-C4): nunca aleatoria.
const SUITES: readonly (() => SuiteResult)[] = [
  unitSuite,
  integrationSuite,
  goldenSuite,
  regressionSuite,
  propertySuite,
  performanceSuite,
  roundtripSuite,
];

export function certify(): CertificationReport {
  const suites: SuiteResult[] = SUITES.map((suite) => suite());

  // Os Diagnostics observados do pipeline sobre o fixture — transportados, nunca alterados (CERT-C1).
  const observed: readonly Diagnostic[] = collectDiagnostics([
    runPipeline(fixtureRequest).diagnostics,
  ]);

  const checks: readonly CertificationCheck[] = suites.flatMap((suite) => suite.checks);
  const passed = checks.filter((check) => check.passed).length;
  const summary: CertificationSummary = {
    total: checks.length,
    passed,
    failed: checks.length - passed,
    limitations: suites.filter((suite) => suite.limitation !== undefined).length,
  };

  return {
    suites,
    diagnostics: observed,
    conformant: summary.failed === 0,
    summary,
  };
}
