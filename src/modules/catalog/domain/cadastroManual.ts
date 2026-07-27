// Cadastro manual de produto — o que o lojista digita, e só isso.
//
// O `Produto` tem mais de 20 campos, e a maioria é escrituração operacional da
// Zion: statusSeo, statusDescricao, prioridade, confiancaCusto. Pedir isso a
// quem só quer cadastrar um chinelo é transformar um cadastro de dois minutos
// numa planilha. O lojista informa o que ELE sabe; o resto nasce com o mesmo
// padrão que a importação por CSV já usa — os dois caminhos produzem produtos
// indistinguíveis daqui para a frente.
//
// Puro: sem rede, sem React, sem Supabase.

import type { Marketplace, Produto } from "../../../lib/types";
import {
  margemLiquida,
  precoMinimoOuNull,
  MARGEM_MINIMA_PADRAO,
  TAXAS_PADRAO,
  type ModeloTaxas,
} from "../../pricing/domain/modeloPreco.ts";

/** Exatamente o que se pede a quem está cadastrando. Nada além. */
export interface RascunhoProduto {
  nome: string;
  sku: string;
  /** Obrigatório: sem preço não existe anúncio publicável. */
  precoVenda: string;
  custo: string;
  estoque: string;
  marca: string;
  categoria: string;
  cor: string;
  tamanho: string;
  marketplace: Marketplace;
}

export const RASCUNHO_VAZIO: RascunhoProduto = {
  nome: "",
  sku: "",
  precoVenda: "",
  custo: "",
  estoque: "",
  marca: "",
  categoria: "",
  cor: "",
  tamanho: "",
  marketplace: "Mercado Livre",
};

/** Aceita "1.234,56", "1234.56", "R$ 89,90". Devolve 0 quando não é número. */
export function paraNumero(v: string): number {
  if (!v) return 0;
  let s = String(v).trim().replace(/[^\d,.-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export interface ProblemaCampo {
  campo: keyof RascunhoProduto;
  texto: string;
}

/**
 * O que impede salvar. Devolve TODOS os problemas de uma vez — corrigir um por
 * vez, salvando e errando de novo, é o jeito mais rápido de perder alguém.
 *
 * `skusExistentes` recebe os SKUs já cadastrados: SKU repetido quebra a
 * conciliação com o ERP e com o marketplace, então é bloqueio, não aviso.
 */
export function validarRascunho(
  r: RascunhoProduto,
  skusExistentes: readonly string[] = []
): ProblemaCampo[] {
  const problemas: ProblemaCampo[] = [];

  if (!r.nome.trim()) {
    problemas.push({ campo: "nome", texto: "Dê um nome ao produto." });
  }

  const sku = r.sku.trim();
  if (!sku) {
    problemas.push({ campo: "sku", texto: "O SKU identifica o produto no seu estoque e no marketplace." });
  } else if (skusExistentes.some((s) => s.trim().toLowerCase() === sku.toLowerCase())) {
    problemas.push({ campo: "sku", texto: `Já existe um produto com o SKU ${sku}.` });
  }

  const preco = paraNumero(r.precoVenda);
  if (preco <= 0) {
    problemas.push({ campo: "precoVenda", texto: "Informe o preço de venda — sem ele o anúncio não vai ao ar." });
  }

  if (r.custo.trim() && paraNumero(r.custo) < 0) {
    problemas.push({ campo: "custo", texto: "O custo não pode ser negativo." });
  }
  if (r.estoque.trim() && paraNumero(r.estoque) < 0) {
    problemas.push({ campo: "estoque", texto: "O estoque não pode ser negativo." });
  }

  return problemas;
}

export interface AvisoPreco {
  precoMinimo: number;
  margemAtual: number;
}

/**
 * O preço digitado fica abaixo do piso do lojista? Aviso, nunca bloqueio:
 * vender no prejuízo pode ser estratégia (queima de estoque, isca). Quem decide
 * é quem vende — mas ninguém decide o que não vê.
 */
export function avisoDePreco(
  r: RascunhoProduto,
  margemMinima: number = MARGEM_MINIMA_PADRAO,
  taxas: ModeloTaxas = TAXAS_PADRAO
): AvisoPreco | null {
  const custo = paraNumero(r.custo);
  const preco = paraNumero(r.precoVenda);
  if (custo <= 0 || preco <= 0) return null; // sem custo não há o que comparar
  const piso = precoMinimoOuNull(custo, margemMinima, taxas);
  // Piso indefinido (sem peso da embalagem) não vira aviso: acusar preço baixo
  // sem saber o custo de envio seria assustar por dado que falta A NÓS.
  if (piso === null || preco >= piso) return null;
  const margemAtual = margemLiquida(custo, preco, taxas);
  if (margemAtual === null) return null;
  return { precoMinimo: piso, margemAtual };
}

/**
 * Converte o rascunho no Produto completo.
 *
 * Os defaults são OS MESMOS da importação por CSV, de propósito: um produto
 * cadastrado à mão e um importado precisam se comportar igual na esteira, nas
 * auditorias e nos filtros. Divergir aqui criaria duas classes de produto.
 */
export function montarProduto(
  r: RascunhoProduto,
  clienteId: string,
  cliente: string,
  margemMinima: number = MARGEM_MINIMA_PADRAO,
  taxas: ModeloTaxas = TAXAS_PADRAO
): Omit<Produto, "id"> {
  const custo = paraNumero(r.custo);
  const precoVenda = paraNumero(r.precoVenda);
  const piso = precoMinimoOuNull(custo, margemMinima, taxas);

  return {
    clienteId,
    cliente,
    nome: r.nome.trim(),
    marca: r.marca.trim(),
    modelo: "",
    categoria: r.categoria.trim(),
    sku: r.sku.trim(),
    cor: r.cor.trim(),
    tamanho: r.tamanho.trim(),
    custo,
    precoVenda,
    estoque: Math.max(0, Math.round(paraNumero(r.estoque))),
    marketplace: r.marketplace,
    statusCadastro: "Não iniciado",
    statusSeo: "Pendente",
    statusDescricao: "Pendente",
    statusImagens: "Pendente",
    statusPrecificacao: "Pendente",
    prioridade: "Média",
    observacoes: "Cadastrado pelo lojista no portal.",
    // ?? undefined: campo ausente é honesto sobre o que ainda não se sabe;
    // gravar 0 afirmaria "sem margem", que é outra coisa.
    precoMinimo: piso ?? undefined,
    margem: margemLiquida(custo, precoVenda, taxas) ?? undefined,
    // Custo digitado pelo próprio lojista: a fonte mais confiável que existe.
    confiancaCusto: custo > 0 ? "alta" : "",
  } as Omit<Produto, "id">;
}
