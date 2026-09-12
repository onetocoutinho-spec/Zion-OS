import type { SourceId } from './source-id';

// Compiler 001/002 — Source: entidade abstrata. A forma concreta das Source Units é diferida à Especificação da Linguagem.
export interface Source {
  readonly id: SourceId;
}
