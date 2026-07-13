// Referência de credencial — PONTEIRO, nunca o valor (003 §Segredos; R3 do audit).
//
// O SDK trafega apenas um `ref` (id no cofre/coluna server-only). O valor real
// (token, secret, service_role) NUNCA é tipado aqui, nunca vai ao navegador nem
// é retornado por API. A resolução do ponteiro é server-side (ver ResolvedorCredencial).

export const TIPOS_ESTRATEGIA_AUTH = ["oauth2", "api_key", "arquivo", "nenhuma"] as const;
export type TipoEstrategiaAuth = (typeof TIPOS_ESTRATEGIA_AUTH)[number];

export interface ReferenciaCredencial {
  readonly estrategia: TipoEstrategiaAuth;
  /** Ponteiro para o segredo no cofre server-side. NUNCA o segredo em si. */
  readonly ref: string;
}
