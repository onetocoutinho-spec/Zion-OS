// Port: Logger.
//
// Observabilidade da orquestração, sem acoplar a Application a um logger concreto.
// Contrato mínimo; nunca registrar segredo/PII (política herdada de 000/003).

export interface Logger {
  info(mensagem: string, contexto?: Record<string, unknown>): void;
  aviso(mensagem: string, contexto?: Record<string, unknown>): void;
  erro(mensagem: string, contexto?: Record<string, unknown>): void;
}
