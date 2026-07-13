// Validação de dados OBRIGATÓRIOS do produto canônico (pré-conciliação).
//
// Regra estrutural apenas (não é regra de negócio de domínio): sku_origem e nome
// são obrigatórios; EAN é complementar (opcional). A validação de FORMA de VOs
// (SKU/EAN/dinheiro) e a coerência de negócio ficam no domínio, na criação.

import type { ProdutoCanonicoIntake } from "../types/intake-command.ts";

export interface ErroValidacao {
  readonly campo: string;
  readonly mensagem: string;
}

export function validarProduto(produto: ProdutoCanonicoIntake): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  const sku = produto.identidade?.skuOrigem;
  if (!sku || sku.trim() === "") {
    erros.push({ campo: "sku_origem", mensagem: "SKU de origem é obrigatório." });
  }

  if (!produto.nome || produto.nome.trim() === "") {
    erros.push({ campo: "nome", mensagem: "Nome é obrigatório." });
  }

  return erros;
}

export function ehValido(produto: ProdutoCanonicoIntake): boolean {
  return validarProduto(produto).length === 0;
}
