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

// Golden Certification — o artefato esperado de cada Generator.
//
// CERT-C2 (Specification Driven): o "golden" aqui e DERIVADO DA ESPECIFICACAO, nunca de um blob
// observado. Fixar a saida observada seria "teste baseado em comportamento observado", que a CERT-C2
// proibe. Cada expectativa abaixo existe porque a Compiler 008-013 exige aquele conteudo:
//   - o Valor resolvido e emitido tal como declarado (nunca reinterpretado);
//   - o Simbolo e transcrito para o dialeto do alvo de forma reversivel (P1);
//   - o Token Incompleto e OMITIDO (nunca emitido com Valor inventado).
export function goldenSuite(): SuiteResult {
  const checks: CertificationCheck[] = [];
  const validated = validate(buildIR(fixtureNodes, analyze(fixtureNodes)));

  // Compiler 012 — JSON: projecao estrutural fiel; Valor repassado.
  const json = generateJson(validated);
  const parsed = JSON.parse(json.artifact) as {
    tokens: { symbol: string; resolutions: { value?: unknown }[] }[];
  };
  const jsonA = parsed.tokens.find((token) => token.symbol === 'a');
  checks.push(
    check(
      'golden.json.value',
      'Compiler 012 · Valor repassado',
      jsonA?.resolutions[0]?.value === 'VALUE_A',
    ),
  );
  checks.push(
    check(
      'golden.json.incomplete-omitted',
      'Compiler 012 · Incompleto omitido',
      parsed.tokens.find((t) => t.symbol === 'c')?.resolutions.length === 0,
    ),
  );

  // Compiler 008 — CSS: dialeto CSS, transcricao reversivel, Valor repassado.
  const css = generateCss(validated).artifact;
  checks.push(
    check(
      'golden.css.value',
      'Compiler 008 · dialeto e Valor',
      css.includes(':root { --a: VALUE_A; }'),
    ),
  );
  checks.push(
    check(
      'golden.css.context-mode',
      'Compiler 008 · Valor por Contexto',
      css.includes('[data-context="dark"] :root { --e: E_DARK; }'),
    ),
  );
  checks.push(
    check(
      'golden.css.incomplete-omitted',
      'Compiler 008 · Incompleto omitido',
      !css.includes('--c'),
    ),
  );

  // Compiler 011 — Documentation: face `.` do Simbolo; Incompletude exibida como ESTADO.
  const doc = generateDocumentation(validated).artifact;
  checks.push(
    check('golden.documentation.symbol', 'Compiler 011 · face `.`', doc.includes('## a')),
  );
  checks.push(
    check(
      'golden.documentation.incomplete-state',
      'Ontologia 5.5.1 · estado exibido',
      doc.includes('Incompleto'),
    ),
  );
  checks.push(
    check(
      'golden.documentation.matter-unresolved',
      'M1 Matter Opacity',
      doc.includes('Materia: unresolved'),
    ),
  );

  // Compiler 010 — TypeScript: valores por Contexto.
  const ts = generateTypeScript(validated).artifact;
  checks.push(
    check(
      'golden.typescript.value',
      'Compiler 010 · valores por Contexto',
      ts.includes('"a@invariant": "VALUE_A"'),
    ),
  );

  // Compiler 009 — React: expoe os valores; nao define componentes.
  const react = generateReact(validated).artifact;
  checks.push(
    check(
      'golden.react.value',
      'Compiler 009 · valores por Contexto',
      react.includes('zionTokens') && react.includes('"a@invariant": "VALUE_A"'),
    ),
  );

  // Compiler 013 — Figma: face `/` e um modo por Contexto.
  const figma = JSON.parse(generateFigma(validated).artifact) as {
    variables: { name: string; modes: Record<string, unknown> }[];
  };
  const figmaE = figma.variables.find((variable) => variable.name === 'e');
  checks.push(
    check(
      'golden.figma.modes',
      'Compiler 013 · um modo por Contexto',
      figmaE?.modes['dark'] === 'E_DARK' && figmaE?.modes['light'] === 'E_LIGHT',
    ),
  );

  return suiteOf('golden', checks);
}
