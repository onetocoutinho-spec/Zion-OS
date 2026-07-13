// Resultado<T> da Application — orquestração devolve ok/erro sem lançar.
//
// A Application NÃO tem regra de negócio: quando uma invariante do domínio falha,
// ela apenas ENVOLVE o ErroDominio (deDominio). Erros que são da própria
// orquestração (ex.: agregado não encontrado no repositório) usam erroApp.

import type { ErroDominio } from "../../domain/shared/erros-dominio.ts";

export interface ErroApp {
  readonly codigo: string;
  readonly mensagem: string;
  /** "dominio" = veio de uma invariante; "aplicacao" = da orquestração. */
  readonly origem: "dominio" | "aplicacao";
}

export type Resultado<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly erro: ErroApp };

export function ok<T>(valor: T): Resultado<T> {
  return { ok: true, valor };
}

export function falha(erro: ErroApp): Resultado<never> {
  return { ok: false, erro };
}

export function erroApp(codigo: string, mensagem: string): ErroApp {
  return { codigo, mensagem, origem: "aplicacao" };
}

/** Envolve um erro de domínio como erro de aplicação, preservando o código. */
export function deDominio(erro: ErroDominio): ErroApp {
  return { codigo: erro.codigo, mensagem: erro.message, origem: "dominio" };
}

export function ehOk<T>(r: Resultado<T>): r is { ok: true; valor: T } {
  return r.ok;
}
