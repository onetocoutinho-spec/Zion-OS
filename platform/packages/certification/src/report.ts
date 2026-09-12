import type { Diagnostic } from '@zion/shared';

// As sete categorias de certificação. Cada uma permanece ISOLADA no seu próprio módulo.
export type SuiteName =
  'unit' | 'integration' | 'golden' | 'regression' | 'property' | 'performance' | 'roundtrip';

// Uma verificação. CERT-C2 (Specification Driven): `specification` é obrigatória — toda verificação
// existe porque uma especificação normativa exige aquele comportamento, nunca por conveniência.
export interface CertificationCheck {
  readonly id: string;
  readonly specification: string;
  readonly passed: boolean;
  readonly detail?: string;
}

// O resultado de uma categoria. `limitation` documenta explicitamente quando a especificação é
// insuficiente para certificar um comportamento — nunca se infere o comportamento ausente.
export interface SuiteResult {
  readonly suite: SuiteName;
  readonly checks: readonly CertificationCheck[];
  readonly passed: boolean;
  readonly limitation?: string;
}

export interface CertificationSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly limitations: number;
}

export interface CertificationReport {
  readonly suites: readonly SuiteResult[];
  readonly diagnostics: readonly Diagnostic[];
  readonly conformant: boolean;
  readonly summary: CertificationSummary;
}

// Utilitário interno (não exportado pela API pública do pacote).
export function suiteOf(
  suite: SuiteName,
  checks: readonly CertificationCheck[],
  limitation?: string,
): SuiteResult {
  return {
    suite,
    checks,
    passed: checks.every((check) => check.passed),
    ...(limitation === undefined ? {} : { limitation }),
  };
}
