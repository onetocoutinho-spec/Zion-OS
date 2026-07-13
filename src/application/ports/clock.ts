// Port: Clock.
//
// O domínio recebe timestamps PRONTOS (agora: string ISO) — ele não lê o relógio.
// A Application obtém o instante por este Port e injeta no domínio, mantendo os
// use cases determinísticos e testáveis (um Clock fake devolve um instante fixo).

export interface Clock {
  /** Instante atual como string ISO 8601. */
  agora(): string;
}
