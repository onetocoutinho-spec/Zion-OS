import type { ValidatedIR } from '@zion/shared';
import { analyze, buildIR, validate } from '@zion/compiler';
import { generateCss } from '@zion/generator-css';
import { generateDocumentation } from '@zion/generator-documentation';
import { generateFigma } from '@zion/generator-figma';
import { generateJson } from '@zion/generator-json';
import { generateReact } from '@zion/generator-react';
import { generateTypeScript } from '@zion/generator-typescript';
import type { CertificationCheck, SuiteResult } from '../report';
import { suiteOf } from '../report';
import { fixtureNodes } from '../fixtures';

function check(id: string, specification: string, passed: boolean): CertificationCheck {
  return { id, specification, passed };
}

const GENERATORS: readonly [string, (validated: ValidatedIR) => { artifact: string }][] = [
  ['css', generateCss],
  ['documentation', generateDocumentation],
  ['figma', generateFigma],
  ['json', generateJson],
  ['react', generateReact],
  ['typescript', generateTypeScript],
];

// Property Certification — propriedades universais verificadas sobre um conjunto de entradas
// ENUMERADO DETERMINISTICAMENTE.
//
// CERT-C4 (Deterministic Certification) proibe geracao randomica: por isso esta suite NAO usa
// property-based testing aleatorio. Ela enumera entradas fixas e verifica que a propriedade vale
// para TODAS — a mesma garantia universal, sem aleatoriedade.
export function propertySuite(): SuiteResult {
  const checks: CertificationCheck[] = [];
  const validated = validate(buildIR(fixtureNodes, analyze(fixtureNodes)));

  // Propriedade (Compiler 001 · Determinism): para TODO Generator, mesma IR => artefato identico.
  const deterministic = GENERATORS.every(
    ([, generator]) => generator(validated).artifact === generator(validated).artifact,
  );
  checks.push(
    check('property.generators.determinism', 'Compiler 001 · Determinism', deterministic),
  );

  // Propriedade (G1 Projection Only): para TODO Generator, gerar nao altera a ValidatedIR.
  const snapshot = JSON.stringify(validated);
  for (const [, generator] of GENERATORS) generator(validated);
  checks.push(
    check(
      'property.generators.G1-no-mutation',
      'G1 Projection Only',
      JSON.stringify(validated) === snapshot,
    ),
  );

  // Propriedade (G2/G4 Isolation): para TODO Generator, a saida independe de outros Generators
  // terem sido invocados antes — os artefatos sao terminais e isolados.
  const isolated = GENERATORS.every(([, generator]) => {
    const alone = generator(validated).artifact;
    GENERATORS.forEach(([, other]) => other(validated));
    return generator(validated).artifact === alone;
  });
  checks.push(
    check('property.generators.G2-G4-isolation', 'G2 Independence · G4 Output Isolation', isolated),
  );

  // Propriedade (Ontologia P3): TODO Simbolo emitido existe no IR — nenhum e inventado.
  const symbols = new Set(validated.ir.nodes.map((node) => String(node.symbol)));
  const jsonTokens = (
    JSON.parse(generateJson(validated).artifact) as { tokens: { symbol: string }[] }
  ).tokens;
  checks.push(
    check(
      'property.generators.P3-no-invented-symbol',
      'Ontologia P3',
      jsonTokens.every((token) => symbols.has(token.symbol)),
    ),
  );

  // Propriedade (S1/R1/V1): para TODA entrada enumerada, a analise nao altera a representacao.
  const before = JSON.stringify(fixtureNodes);
  analyze(fixtureNodes);
  buildIR(fixtureNodes, analyze(fixtureNodes));
  checks.push(
    check(
      'property.pipeline.no-input-mutation',
      'S1 Monotonicity · IR2 No New Facts',
      JSON.stringify(fixtureNodes) === before,
    ),
  );

  return suiteOf('property', checks);
}
