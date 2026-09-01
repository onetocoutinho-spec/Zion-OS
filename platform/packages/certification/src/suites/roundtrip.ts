import { analyze, buildIR, validate } from '@zion/compiler';
import type { CertificationCheck, SuiteResult } from '../report';
import { suiteOf } from '../report';
import { fixtureNodes } from '../fixtures';

function check(id: string, specification: string, passed: boolean): CertificationCheck {
  return { id, specification, passed };
}

// Round-trip Certification — a preservacao dos fatos primarios atraves da projecao.
//
// LIMITACAO DOCUMENTADA (nunca inferida): o round-trip da Representation 004 — "forma externa ->
// fatos primarios -> forma externa" — NAO e executavel nesta plataforma:
//   - nao existe forma externa concreta: a Source e ABSTRATA (Compiler 001) e nenhuma Especificacao
//     da Linguagem existe, logo nao ha analisador para reconstruir fatos a partir de um artefato;
//   - os artefatos dos Generators sao TERMINAIS por G4 (Output Isolation): nenhuma saida pode
//     retornar ao pipeline, o que proibe justamente o percurso de volta.
// Certifica-se, portanto, o que a especificacao permite: a LOSSLESSNESS (IR1) — todo fato primario
// da representacao permanece representavel no IR.
export function roundtripSuite(): SuiteResult {
  const checks: CertificationCheck[] = [];
  const validated = validate(buildIR(fixtureNodes, analyze(fixtureNodes)));
  const representations = fixtureNodes.filter((node) => node.kind === 'representation');

  // IR1 — todo Simbolo da representacao permanece no IR.
  checks.push(
    check(
      'roundtrip.IR1-symbols-preserved',
      'Compiler 005 · IR1 Losslessness',
      representations.every((node) =>
        validated.ir.nodes.some((irNode) => irNode.symbol === node.symbol),
      ),
    ),
  );

  // IR1 — todo Contexto declarado permanece representavel no IR.
  const contextsPreserved = representations.every((node) => {
    const irNode = validated.ir.nodes.find((candidate) => candidate.symbol === node.symbol);
    if (irNode === undefined) return false;
    return node.entries.every((entry) =>
      irNode.resolutions.some((resolution) => resolution.context === entry.context),
    );
  });
  checks.push(
    check(
      'roundtrip.IR1-contexts-preserved',
      'Compiler 005 · IR1 Losslessness · P4',
      contextsPreserved,
    ),
  );

  // IR1 — a Destinacao declarada permanece no IR.
  const destinationsPreserved = representations
    .filter((node) => node.destination !== undefined)
    .every((node) => {
      const irNode = validated.ir.nodes.find((candidate) => candidate.symbol === node.symbol);
      return irNode?.destination?.consumer === node.destination?.consumer;
    });
  checks.push(
    check(
      'roundtrip.IR1-destination-preserved',
      'Compiler 005 · IR1 Losslessness · D3',
      destinationsPreserved,
    ),
  );

  // IR1 — a localizacao de origem permanece no IR.
  const locationsPreserved = representations.every((node) => {
    const irNode = validated.ir.nodes.find((candidate) => candidate.symbol === node.symbol);
    return irNode?.location.span.start.offset === node.location.span.start.offset;
  });
  checks.push(
    check(
      'roundtrip.IR1-location-preserved',
      'Compiler 005 · IR1 Losslessness',
      locationsPreserved,
    ),
  );

  return suiteOf(
    'roundtrip',
    checks,
    'O round-trip externo da Representation 004 nao e executavel: a Source e abstrata (sem forma ' +
      'concreta nem analisador) e os artefatos dos Generators sao terminais por G4. Certifica-se a ' +
      'losslessness (IR1), que e o que as especificacoes permitem verificar.',
  );
}
