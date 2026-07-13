// Limites de taxa por conector (003 §Regras 4).
//
// Cada conector declara seus limites; o runtime (Engine/jobs — fora deste PR)
// agenda respeitando-os (req/s, tamanho de lote, concorrência). Valores
// conservadores por padrão — cada provedor sobrescreve conforme sua API.

export interface Limites {
  readonly requisicoesPorSegundo: number;
  readonly tamanhoMaximoLote: number;
  readonly concorrenciaMaxima: number;
}

export const LIMITES_CONSERVADORES: Limites = {
  requisicoesPorSegundo: 1,
  tamanhoMaximoLote: 20,
  concorrenciaMaxima: 1,
};

export function limitesValidos(limites: Limites): boolean {
  return (
    limites.requisicoesPorSegundo > 0 &&
    limites.tamanhoMaximoLote > 0 &&
    limites.concorrenciaMaxima > 0
  );
}
