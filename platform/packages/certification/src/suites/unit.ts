import type { Diagnostic, DiagnosticCode } from '@zion/shared';
import { collectDiagnostics, hasBlockingError } from '@zion/shared';
import {
  analyze,
  buildIR,
  createCursor,
  createTokenCursor,
  parse,
  tokenize,
  validate,
} from '@zion/compiler';
import { resolve } from '@zion/runtime';
import type { CertificationCheck } from '../report';
import { suiteOf } from '../report';
import type { SuiteResult } from '../report';
import {
  FIXTURE_SOURCE,
  fixtureConstruction,
  fixtureConstructionStuck,
  fixtureLexical,
  fixtureLexicalStuck,
  fixtureNodes,
  fixtureUnits,
  loc,
  stable,
} from '../fixtures';

function check(
  id: string,
  specification: string,
  passed: boolean,
  detail?: string,
): CertificationCheck {
  return { id, specification, passed, ...(detail === undefined ? {} : { detail }) };
}

function diagnostic(code: string, offset: number, severity: 'error' | 'warning'): Diagnostic {
  return {
    code: code as DiagnosticCode,
    severity,
    location: loc(offset),
    message: 'fixture',
    concept: 'fixture',
  };
}

// Unit Certification — observa componentes isolados contra as suas especificações (CERT-C1/C2).
export function unitSuite(): SuiteResult {
  const checks: CertificationCheck[] = [];

  // L1 — Progress (Compiler 002): um LexicalContract que nunca avança nao pode travar o Tokenizer.
  const stuckStream = tokenize(createCursor(FIXTURE_SOURCE, fixtureUnits), fixtureLexicalStuck);
  checks.push(
    check('unit.lexer.L1-progress', 'Compiler 002 · L1 Progress', stuckStream.tokens.length === 0),
  );

  // P2 — Progress (Compiler 003): um ConstructionContract que nunca avanca nao pode travar o Parser.
  const stream = tokenize(createCursor(FIXTURE_SOURCE, fixtureUnits), fixtureLexical);
  const stuckParse = parse(
    createTokenCursor(FIXTURE_SOURCE, stream.tokens),
    fixtureConstructionStuck,
  );
  checks.push(
    check('unit.parser.P2-progress', 'Compiler 003 · P2 Progress', stuckParse.nodes.length === 0),
  );

  // P1 — Deterministic Construction (Compiler 003).
  const parseA = parse(createTokenCursor(FIXTURE_SOURCE, stream.tokens), fixtureConstruction);
  const parseB = parse(createTokenCursor(FIXTURE_SOURCE, stream.tokens), fixtureConstruction);
  checks.push(
    check(
      'unit.parser.P1-deterministic',
      'Compiler 003 · P1 Deterministic Construction',
      stable(parseA) === stable(parseB),
    ),
  );

  // S1 — Monotonicity (Compiler 004): a analise nunca altera a representacao recebida.
  const before = stable(fixtureNodes);
  const model = analyze(fixtureNodes);
  checks.push(
    check(
      'unit.semantic.S1-monotonicity',
      'Compiler 004 · S1 Monotonicity',
      stable(fixtureNodes) === before,
    ),
  );

  // S2 — Determinism (Compiler 004).
  checks.push(
    check(
      'unit.semantic.S2-determinism',
      'Compiler 004 · S2 Determinism',
      stable(analyze(fixtureNodes)) === stable(model),
    ),
  );

  // M1 — Matter Opacity (S3): a Materia de base atomica opaca permanece `unresolved`.
  checks.push(
    check(
      'unit.semantic.M1-matter-opacity',
      'Ontologia D4 · M1 Matter Opacity · S3 Non-Inference',
      model.facts.every((facts) => facts.matter.resolved === false),
    ),
  );

  const ir = buildIR(fixtureNodes, model);

  // IR1 — Losslessness: a localizacao de origem permanece representavel no IR.
  checks.push(
    check(
      'unit.ir.IR1-losslessness-location',
      'Compiler 005 · IR1 Losslessness',
      ir.nodes.every((node) => node.location !== undefined),
    ),
  );

  // IR4 — No Evaluation: uma Operacao (Composite) nunca e avaliada — sem Valor terminal.
  const composite = ir.nodes.find((node) => node.symbol === 'd');
  checks.push(
    check(
      'unit.ir.IR4-no-evaluation',
      'Compiler 005 · IR4 No Evaluation',
      composite !== undefined &&
        composite.resolutions.every((resolution) => resolution.value === undefined),
    ),
  );

  // 5.5.1 — um Token Incompleto EXISTE: nao e removido do IR.
  checks.push(
    check(
      'unit.ir.incomplete-exists',
      'Ontologia 5.5.1',
      ir.nodes.some((node) => node.symbol === 'c'),
    ),
  );

  // V1 — Read Only: o Validator devolve a MESMA referencia de IR.
  const validated = validate(ir);
  checks.push(
    check('unit.validator.V1-read-only', 'Compiler 007 · V1 Read Only', validated.ir === ir),
  );

  // V3 — Deterministic Diagnostics.
  checks.push(
    check(
      'unit.validator.V3-deterministic',
      'Compiler 007 · V3 Deterministic Diagnostics',
      stable(validate(ir).diagnostics) === stable(validated.diagnostics),
    ),
  );

  // R1 — Runtime Independence: resolver nao altera a ValidatedIR.
  const irBefore = stable(validated);
  const resolvedA = resolve(validated, 'a' as never);
  checks.push(
    check(
      'unit.runtime.R1-independence',
      'Compiler 015 · R1 Runtime Independence',
      stable(validated) === irBefore,
    ),
  );

  // Resolucao (5.1): o Valor terminal declarado e devolvido tal como esta.
  checks.push(
    check(
      'unit.runtime.resolution-value',
      'Ontologia 5.1 · Compiler 015',
      resolvedA.resolution.kind === 'value' && resolvedA.resolution.value === 'VALUE_A',
    ),
  );

  // R3 — Deferred Evaluation: Operacao sem semantica normativa devolve `unevaluated`.
  checks.push(
    check(
      'unit.runtime.R3-deferred-evaluation',
      'Compiler 015 · R3 Deferred Evaluation',
      resolve(validated, 'd' as never).resolution.kind === 'unevaluated',
    ),
  );

  // D1 — Diagnostic Traceability: sem localizacao normativa, comunica ESTADO sem inventar Diagnostic.
  const unknown = resolve(validated, 'zzz' as never);
  checks.push(
    check(
      'unit.runtime.D1-traceability',
      'Compiler 001 · D1 Diagnostic Traceability',
      unknown.resolution.kind === 'unknown-symbol' && unknown.diagnostics.length === 0,
    ),
  );

  // Compiler 006 — a coleta ordena por Source Position, depois por codigo.
  const ordered = collectDiagnostics([
    [diagnostic('b.code', 5, 'warning')],
    [diagnostic('a.code', 1, 'warning')],
  ]);
  checks.push(
    check(
      'unit.diagnostics.ordering',
      'Compiler 006 · Propagacao de Diagnostics',
      ordered[0]?.location.span.start.offset === 1 && ordered[1]?.location.span.start.offset === 5,
    ),
  );

  // Compiler 006 — barreira: `error` bloqueia; `warning` nao.
  checks.push(
    check(
      'unit.diagnostics.barrier',
      'Compiler 006 · Politica de barreira',
      hasBlockingError([diagnostic('e', 0, 'error')]) &&
        !hasBlockingError([diagnostic('w', 0, 'warning')]),
    ),
  );

  return suiteOf('unit', checks);
}
