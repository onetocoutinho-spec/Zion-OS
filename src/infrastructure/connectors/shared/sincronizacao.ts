// Sincronização (003 §C2 / §Regras 6): pull incremental por padrão, full sob demanda.

export const MODOS_SYNC = ["incremental", "completo"] as const;
export type ModoSync = (typeof MODOS_SYNC)[number];

export interface OpcoesSync {
  readonly modo: ModoSync;
  /** Marca d'água para o incremental (ISO). Ausente no modo completo. */
  readonly desde?: string;
}

export interface ResumoSync {
  readonly lidos: number;
  readonly novos: number;
  readonly atualizados: number;
  readonly erros: number;
}
