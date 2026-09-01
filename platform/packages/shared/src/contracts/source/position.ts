// Compiler 001/002 — Position: índice sobre o fluxo de Source Units opacas.
// A Source é abstrata; não se assume representação textual (linha/coluna).
export interface Position {
  readonly offset: number;
}
