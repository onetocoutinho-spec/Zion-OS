import type {
  ASTNode,
  Context,
  SourceId,
  SourceLocation,
  Symbol,
  Token,
  TokenKind,
} from '@zion/shared';
import type { ConstructionContract, LexicalContract, PipelineRequest } from '@zion/compiler';
import { advance, advanceTokens, peek, peekToken } from '@zion/compiler';

// ─────────────────────────────────────────────────────────────────────────────
// CERT-C3 — Fixtures Are Non-Normative.
//   Os fixtures deste módulo existem APENAS para exercitar contratos. Eles:
//     - não definem comportamento;
//     - não complementam especificações;
//     - não criam semântica.
//   Qualquer alteração aqui JAMAIS altera o significado da arquitetura. Nenhum valor, kind, operador
//   ou símbolo abaixo possui autoridade normativa: são estímulos, não norma.
// ─────────────────────────────────────────────────────────────────────────────

const sym = (value: string): Symbol => value as Symbol;
const ctx = (value: string): Context => value as Context;
const kind = (value: string): TokenKind => value as TokenKind;

export const FIXTURE_SOURCE = 'fixture' as SourceId;

export function loc(offset: number): SourceLocation {
  return { source: FIXTURE_SOURCE, span: { start: { offset }, end: { offset: offset + 1 } } };
}

// Representação de estímulo: cobre as três formas ontológicas de Conteúdo, Contexto, Destinação,
// Referência resolúvel, Referência pendente e Operação.
export const fixtureNodes: readonly ASTNode[] = [
  {
    kind: 'representation',
    symbol: sym('a'),
    entries: [{ content: { kind: 'atomic', payload: 'VALUE_A' } }],
    location: loc(0),
  },
  {
    kind: 'representation',
    symbol: sym('b'),
    entries: [{ content: { kind: 'reference', reference: { target: sym('a') } } }],
    location: loc(1),
  },
  {
    kind: 'representation',
    symbol: sym('c'),
    entries: [{ content: { kind: 'reference', reference: { target: sym('missing') } } }],
    location: loc(2),
  },
  {
    kind: 'representation',
    symbol: sym('d'),
    entries: [
      {
        content: { kind: 'composite', operator: 'op', operands: [{ kind: 'atomic', payload: 1 }] },
      },
    ],
    location: loc(3),
  },
  {
    kind: 'representation',
    symbol: sym('e'),
    entries: [
      { context: ctx('dark'), content: { kind: 'atomic', payload: 'E_DARK' } },
      { context: ctx('light'), content: { kind: 'atomic', payload: 'E_LIGHT' } },
    ],
    destination: { consumer: 'FixtureConsumer' as Destination['consumer'] },
    location: loc(4),
  },
];

type Destination = NonNullable<Extract<ASTNode, { kind: 'representation' }>['destination']>;

// ── Contratos de estímulo (não normativos) ───────────────────────────────────

export interface FixtureUnit {
  readonly kind: string;
}

export const fixtureUnits: readonly FixtureUnit[] = [{ kind: 'x' }, { kind: 'y' }];

// LexicalContract de estímulo: mapeia cada Source Unit a um Token e avança uma unidade.
export const fixtureLexical: LexicalContract<FixtureUnit> = {
  step: (cursor) => {
    const unit = peek(cursor);
    if (unit === undefined) return { kind: 'skip', next: advance(cursor, 1) };
    const token: Token = { kind: kind(unit.kind), location: loc(cursor.offset) };
    return { kind: 'token', token, next: advance(cursor, 1) };
  },
};

// LexicalContract que NUNCA avança — existe para exercitar a invariante L1 (Progress).
export const fixtureLexicalStuck: LexicalContract<FixtureUnit> = {
  step: (cursor) => ({ kind: 'skip', next: cursor }),
};

// ConstructionContract de estímulo: constrói um nó da representação por Token.
export const fixtureConstruction: ConstructionContract = {
  step: (cursor) => {
    const token = peekToken(cursor);
    if (token === undefined) return { kind: 'skip', next: advanceTokens(cursor, 1) };
    const node: ASTNode = {
      kind: 'representation',
      symbol: sym(token.kind),
      entries: [{ content: { kind: 'atomic', payload: token.kind } }],
      location: token.location,
    };
    return { kind: 'node', node, next: advanceTokens(cursor, 1) };
  },
};

// ConstructionContract que NUNCA avança — existe para exercitar a invariante P2 (Progress).
export const fixtureConstructionStuck: ConstructionContract = {
  step: (cursor) => ({ kind: 'skip', next: cursor }),
};

export const fixtureRequest: PipelineRequest<FixtureUnit> = {
  source: FIXTURE_SOURCE,
  units: fixtureUnits,
  lexical: fixtureLexical,
  construction: fixtureConstruction,
};

// Comparação estrutural determinística (CERT-C4): sem relógio, sem aleatoriedade, sem ambiente.
export function stable(value: unknown): string {
  return JSON.stringify(value);
}
