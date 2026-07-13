// Resultado<T> do SDK — ok/erro sem exceção no fluxo feliz, carregando ErroConector.
//
// Intencionalmente INDEPENDENTE do Result<T> do Domain Layer: o SDK é uma camada
// de fronteira (anticorrupção) e não importa o domínio (Strangler Fig — paralelo
// e dormente). O mapeamento canônico↔domínio acontece na Application (PR futuro).

import type { ErroConector } from "./erros.ts";

export type Resultado<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly erro: ErroConector };

export function ok<T>(valor: T): Resultado<T> {
  return { ok: true, valor };
}

export function falha(erro: ErroConector): Resultado<never> {
  return { ok: false, erro };
}

export function ehOk<T>(r: Resultado<T>): r is { ok: true; valor: T } {
  return r.ok;
}
