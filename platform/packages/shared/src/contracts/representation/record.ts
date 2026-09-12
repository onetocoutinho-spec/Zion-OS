import type { Symbol } from '../ontology/symbol';
import type { Destination } from '../ontology/destination';
import type { RepresentationEntry } from './entry';

// Representation 001 — os fatos primários de um Símbolo (P1): as suas Entradas por Contexto (D1)
// e a Destinação (D3) quando declarada. Nome estrutural neutro (não semântico); não carrega fato
// derivado nem localização de origem.
export interface RepresentationRecord {
  readonly symbol: Symbol;
  readonly entries: readonly RepresentationEntry[];
  readonly destination?: Destination;
}
