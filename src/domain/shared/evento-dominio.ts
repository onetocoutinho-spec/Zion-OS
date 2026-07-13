// EventoDominio — base de evento de domínio (PR-001).
//
// IMPORTANTE: este PR NÃO implementa o Event Bus (isso é o PR-003). Aqui o
// agregado apenas REGISTRA eventos em memória (ver produto-mestre.ts →
// puxarEventos()). O formato segue o envelope canônico do 004 para que, quando
// o outbox existir, a Application apenas encaminhe — sem retrabalho no domínio.
//
// O `occurred_at` é injetado (string ISO) — o domínio não lê o relógio.

export interface EventoDominio<TPayload = Record<string, unknown>> {
  readonly tipo: string;
  readonly versao_schema: number;
  /** Chave de ordenação/partição no bus (ex.: produto_mestre_id). */
  readonly chave_particao: string;
  readonly occurred_at: string;
  readonly payload: TPayload;
}
