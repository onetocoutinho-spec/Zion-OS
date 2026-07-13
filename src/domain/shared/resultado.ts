// Result<T> — resultado de operações de domínio sem exceção no fluxo feliz.
//
// Toda fábrica/comportamento que possa violar uma invariante devolve Result<T>:
//   - ok(valor)      → sucesso
//   - falha(erro)    → ErroDominio (código estável + mensagem)
// A camada Application decide se converte falha em exceção/HTTP; o domínio não.

import type { ErroDominio } from "./erros-dominio.ts";

export type Result<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly erro: ErroDominio };

export function ok<T>(valor: T): Result<T> {
  return { ok: true, valor };
}

export function falha(erro: ErroDominio): Result<never> {
  return { ok: false, erro };
}

/** Açúcar para operações que não retornam valor (Result<void>). */
export function okVazio(): Result<void> {
  return { ok: true, valor: undefined };
}

/** Type guard: estreita para o ramo de sucesso. */
export function ehOk<T>(r: Result<T>): r is { ok: true; valor: T } {
  return r.ok;
}
