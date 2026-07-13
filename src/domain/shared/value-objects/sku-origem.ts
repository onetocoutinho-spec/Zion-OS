// SkuOrigem — a chave PRIMÁRIA de conciliação da Zion (001 §Identidade).
//
// É o SKU como veio da Origem do Produto (fornecedor/fabricante/…). Normaliza
// para comparação estável (trim, colapsa espaços internos, caixa alta), mas
// preserva o valor normalizado como identidade. `ean` é apenas complementar
// (ver ean.ts) — nunca substitui o SKU.

import type { Result } from "../resultado.ts";
import { ok, falha } from "../resultado.ts";
import { erroDominio } from "../erros-dominio.ts";

export class SkuOrigem {
  readonly valor: string;

  private constructor(valor: string) {
    this.valor = valor;
  }

  static criar(bruto: string): Result<SkuOrigem> {
    if (typeof bruto !== "string") {
      return falha(erroDominio("sku_origem_invalido", "SKU de origem deve ser texto."));
    }
    const normalizado = bruto.trim().replace(/\s+/g, " ").toUpperCase();
    if (normalizado.length === 0) {
      return falha(erroDominio("sku_origem_invalido", "SKU de origem não pode ser vazio."));
    }
    return ok(new SkuOrigem(normalizado));
  }

  igualA(outro: SkuOrigem): boolean {
    return this.valor === outro.valor;
  }
}
