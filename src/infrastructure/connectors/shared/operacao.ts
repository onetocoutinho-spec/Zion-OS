// Operação de escrita idempotente (003 §C3 / §Regras 2).
//
// Toda escrita (aplicar/publicar/atualizar/pausar/propagar) carrega uma
// idempotency_key canônica: mesma chave ⇒ mesmo efeito, sem duplicar. A chave é
// construída de forma DETERMINÍSTICA (sem relógio/aleatório) a partir das partes
// que identificam a intenção lógica.

import type { ErroConector } from "./erros.ts";

export const TIPOS_OPERACAO = [
  "publicar",
  "atualizar_preco_estoque",
  "pausar",
  "propagar",
  "importar",
  "webhook",
] as const;
export type TipoOperacao = (typeof TIPOS_OPERACAO)[number];

export type IdempotencyKey = string;

export interface OperacaoAplicar {
  readonly tipo: TipoOperacao;
  readonly idempotencyKey: IdempotencyKey;
  /** Payload canônico da operação (referencia entidades por id/sku; sem segredo). */
  readonly payload: Record<string, unknown>;
}

export interface ResultadoOperacao {
  readonly ok: boolean;
  readonly idempotencyKey: IdempotencyKey;
  /** Id no sistema externo (ex.: MLB123), quando aplicável. */
  readonly idExterno?: string | null;
  /** true quando a chave já havia sido processada (no-op idempotente). */
  readonly repetida?: boolean;
  readonly erro?: ErroConector;
}

/**
 * Constrói uma idempotency_key canônica e estável a partir de partes.
 * Cada parte é percent-encoded para que o separador nunca colida.
 */
export function chaveIdempotencia(partes: ReadonlyArray<string>): IdempotencyKey {
  return partes.map((parte) => encodeURIComponent(parte.trim())).join("|");
}
