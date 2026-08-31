import type { Symbol } from '../ontology/symbol';
import type { Matter } from '../ontology/matter';
import type { Resolution } from '../ontology/resolution';
import type { Destination } from '../ontology/destination';
import type { SourceLocation } from '../source/source-location';

// Compiler 005 — IRNode: um Símbolo resolvido.
//
// REGRA FORMAL (composição do IRNode):
//   A IR SHALL conter exclusivamente fatos cuja existência já esteja normativamente estabelecida
//   pela especificação congelada E cujo contrato já exista até a fase corrente.
//   É PROIBIDO antecipar propriedades, campos ou placeholders destinados a fases futuras.
//
// Aplicação nesta fase: incluídos apenas fatos com contrato já existente (Símbolo P1, Matéria D4,
// Resolução 5.1/5.5, Destinação D3), todos preservados/produzidos pela IR segundo a Compiler 005.
// Posição (T2), Escopo, Cadeia de Resolução e Dependência — que a Compiler 005 também estabelece —
// estão AUSENTES por ainda não possuírem contrato; entrarão quando a sua fase o definir. Sem placeholders.
// Matéria opcional por REGRA M1 (Matter Opacity): ausente = `unresolved` — ausência legítima de
// informação normativa (a Matéria de uma base atômica opaca não é derivável exclusivamente da Ontologia),
// nunca erro. Losslessness (IR1): o estado não resolvido permanece representável no IR.
// `location` é obrigatória por LOSSLESSNESS (IR1): a localização de origem é fato presente na
// representação (RepresentationNode.location) e deve permanecer representável no IR. É também o que
// permite ao Validator emitir Diagnostics posicionados (Compiler 001). Não é opcional — C1 não se aplica:
// todo IRNode provém de um RepresentationNode, que sempre a possui.
export interface IRNode {
  readonly symbol: Symbol;
  readonly matter?: Matter;
  readonly resolutions: readonly Resolution[];
  readonly destination?: Destination;
  readonly location: SourceLocation;
}
