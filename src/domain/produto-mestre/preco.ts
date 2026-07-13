// Preco — precificação por CANAL (001: PRECO por variante/canal).
//
// Guarda o preço e o piso (preço mínimo). A regra "abaixo do piso não publica"
// (001 §9) é exposta por `publicavel`; quem decide publicar (Marketplace Engine,
// fora deste PR) consulta essa propriedade. Imutável.

import type { Result } from "../shared/resultado.ts";
import { ok } from "../shared/resultado.ts";
import type { Canal } from "../shared/value-objects/canal.ts";
import type { Dinheiro } from "../shared/value-objects/dinheiro.ts";

export interface DadosPreco {
  readonly canal: Canal;
  readonly preco: Dinheiro;
  readonly precoMinimo: Dinheiro;
}

export class Preco {
  readonly canal: Canal;
  readonly preco: Dinheiro;
  readonly precoMinimo: Dinheiro;

  private constructor(canal: Canal, preco: Dinheiro, precoMinimo: Dinheiro) {
    this.canal = canal;
    this.preco = preco;
    this.precoMinimo = precoMinimo;
  }

  static definir(dados: DadosPreco): Result<Preco> {
    // preco e precoMinimo já são Dinheiro válidos (>= 0). Nada mais a validar aqui.
    return ok(new Preco(dados.canal, dados.preco, dados.precoMinimo));
  }

  /** 001 §9: só é publicável quando o preço é >= piso. */
  get publicavel(): boolean {
    return !this.preco.menorQue(this.precoMinimo);
  }
}
