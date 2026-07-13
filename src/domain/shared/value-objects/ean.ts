// Ean — código de barras GTIN (8/12/13/14 dígitos), COMPLEMENTAR ao SKU.
//
// Valida o dígito verificador GTIN. No agregado, a ausência de EAN é
// representada por `null` (o EAN nunca é obrigatório); por isso a fábrica
// exige um valor e a ausência é modelada fora daqui.

import type { Result } from "../resultado.ts";
import { ok, falha } from "../resultado.ts";
import { erroDominio } from "../erros-dominio.ts";

const TAMANHOS_VALIDOS = new Set([8, 12, 13, 14]);

export class Ean {
  readonly valor: string;

  private constructor(valor: string) {
    this.valor = valor;
  }

  static criar(bruto: string): Result<Ean> {
    const limpo = typeof bruto === "string" ? bruto.trim() : "";
    if (!/^\d+$/.test(limpo) || !TAMANHOS_VALIDOS.has(limpo.length)) {
      return falha(erroDominio("ean_invalido", "EAN deve ter 8, 12, 13 ou 14 dígitos numéricos."));
    }
    if (!digitoVerificadorValido(limpo)) {
      return falha(erroDominio("ean_invalido", "Dígito verificador do EAN inválido."));
    }
    return ok(new Ean(limpo));
  }

  igualA(outro: Ean): boolean {
    return this.valor === outro.valor;
  }
}

/** Algoritmo GTIN: soma ponderada (3/1 a partir do dígito à esquerda do verificador). */
function digitoVerificadorValido(codigo: string): boolean {
  const digitos = codigo.split("").map((d) => Number(d));
  const verificador = digitos[digitos.length - 1];
  const corpo = digitos.slice(0, -1);

  let soma = 0;
  // Da direita para a esquerda no corpo: peso 3 na primeira posição, alternando com 1.
  for (let i = 0; i < corpo.length; i++) {
    const posicaoDaDireita = corpo.length - 1 - i;
    const peso = posicaoDaDireita % 2 === 0 ? 3 : 1;
    soma += corpo[i] * peso;
  }
  const esperado = (10 - (soma % 10)) % 10;
  return esperado === verificador;
}
