// Dinheiro — Value Object monetário.
//
// Representa o valor internamente em CENTAVOS (inteiro) para evitar erros de
// ponto flutuante em somas/comparações de preço e custo. Imutável. Moeda única
// nesta versão (BRL); o campo fica explícito para evolução futura.

import type { Result } from "../resultado.ts";
import { ok, falha } from "../resultado.ts";
import { erroDominio } from "../erros-dominio.ts";

export type Moeda = "BRL";

export class Dinheiro {
  readonly centavos: number;
  readonly moeda: Moeda;

  private constructor(centavos: number, moeda: Moeda) {
    this.centavos = centavos;
    this.moeda = moeda;
  }

  /** Cria a partir de um valor em reais (ex.: 129.9). Rejeita negativo/ inválido. */
  static criar(valorEmReais: number, moeda: Moeda = "BRL"): Result<Dinheiro> {
    if (!Number.isFinite(valorEmReais)) {
      return falha(erroDominio("valor_monetario_invalido", "Valor monetário deve ser um número finito."));
    }
    if (valorEmReais < 0) {
      return falha(erroDominio("valor_monetario_invalido", "Valor monetário não pode ser negativo."));
    }
    const centavos = Math.round(valorEmReais * 100);
    return ok(new Dinheiro(centavos, moeda));
  }

  static zero(moeda: Moeda = "BRL"): Dinheiro {
    return new Dinheiro(0, moeda);
  }

  /** Valor em reais (ex.: 12990 centavos → 129.9). */
  get valor(): number {
    return this.centavos / 100;
  }

  maiorQue(outro: Dinheiro): boolean {
    return this.centavos > outro.centavos;
  }

  menorQue(outro: Dinheiro): boolean {
    return this.centavos < outro.centavos;
  }

  igualA(outro: Dinheiro): boolean {
    return this.centavos === outro.centavos && this.moeda === outro.moeda;
  }
}
