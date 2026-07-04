// Helpers puros da modelagem de produtos marketplace (v1.7):
// resumo de variante, gerador de grade (produto cartesiano) e cálculo de
// precificação por derivação. Sem dependências de rede — fáceis de testar.

import type {
  PrecificacaoVariante,
  ProdutoVariante,
  StatusMargem,
} from "./types";
import type { EixoVariacao } from "./constantes";

/** Rótulo curto de uma variante a partir dos eixos preenchidos. Ex.: "Preto / 36". */
export function resumoVariante(
  v: Partial<Pick<ProdutoVariante, "cor" | "tamanho" | "voltagem" | "sabor" | "aroma" | "modeloVariacao">>
): string {
  const partes = [v.cor, v.tamanho, v.voltagem, v.sabor, v.aroma, v.modeloVariacao]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  return partes.length > 0 ? partes.join(" / ") : "Padrão";
}

export type ValoresPorEixo = Partial<Record<EixoVariacao, string[]>>;

/**
 * Gera a grade (produto cartesiano) dos eixos informados.
 * Ex.: { cor: ["Preto","Avelã"], tamanho: ["34","35"] } →
 *   [{cor:"Preto",tamanho:"34"}, {cor:"Preto",tamanho:"35"}, {cor:"Avelã",tamanho:"34"}, ...]
 * Eixos sem valores são ignorados. Sem nenhum eixo → uma linha vazia (produto simples).
 */
export function gerarGrade(valores: ValoresPorEixo): Partial<Record<EixoVariacao, string>>[] {
  const eixosAtivos = (Object.entries(valores) as [EixoVariacao, string[]][])
    .map(([eixo, vals]) => [eixo, (vals ?? []).map((v) => v.trim()).filter(Boolean)] as const)
    .filter(([, vals]) => vals.length > 0);

  if (eixosAtivos.length === 0) return [{}];

  return eixosAtivos.reduce<Partial<Record<EixoVariacao, string>>[]>(
    (acc, [eixo, vals]) =>
      acc.flatMap((combinacao) => vals.map((valor) => ({ ...combinacao, [eixo]: valor }))),
    [{}]
  );
}

export interface EntradaPrecificacao {
  precoVenda: number;
  custoProduto: number;
  embalagem: number;
  impostoPercentual: number;
  taxaMarketplacePercentual: number;
  taxaFixa: number;
  comissaoGestorPercentual: number;
  outrosCustos: number;
}

export interface ResultadoPrecificacao {
  lucroBruto: number;
  lucroLiquido: number;
  margemLiquidaPercentual: number;
  precoMinimo: number;
  statusMargem: StatusMargem;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

/** Calcula lucro, margem, preço mínimo e saúde da margem de uma derivação. */
export function calcularPrecificacao(e: EntradaPrecificacao): ResultadoPrecificacao {
  const custoTotal = e.custoProduto + e.embalagem + e.outrosCustos;
  const somaPercentuais =
    (e.impostoPercentual + e.taxaMarketplacePercentual + e.comissaoGestorPercentual) / 100;

  const taxasVariaveis = e.precoVenda * somaPercentuais;
  const lucroBruto = e.precoVenda - e.custoProduto;
  const lucroLiquido = e.precoVenda - custoTotal - taxasVariaveis - e.taxaFixa;
  const margemLiquidaPercentual =
    e.precoVenda > 0 ? (lucroLiquido / e.precoVenda) * 100 : 0;

  // Preço em que o lucro líquido zera (break-even).
  const precoMinimo =
    somaPercentuais < 1 ? (custoTotal + e.taxaFixa) / (1 - somaPercentuais) : 0;

  let statusMargem: StatusMargem = "Saudável";
  if (lucroLiquido < 0) statusMargem = "Negativa";
  else if (margemLiquidaPercentual < 10) statusMargem = "Apertada";

  return {
    lucroBruto: arredondar(lucroBruto),
    lucroLiquido: arredondar(lucroLiquido),
    margemLiquidaPercentual: arredondar(margemLiquidaPercentual),
    precoMinimo: arredondar(precoMinimo),
    statusMargem,
  };
}

/** Aplica o cálculo sobre uma PrecificacaoVariante, devolvendo os campos derivados. */
export function recalcularPrecificacao(
  p: Pick<
    PrecificacaoVariante,
    | "precoVenda"
    | "custoProduto"
    | "embalagem"
    | "impostoPercentual"
    | "taxaMarketplacePercentual"
    | "taxaFixa"
    | "comissaoGestorPercentual"
    | "outrosCustos"
  >
): ResultadoPrecificacao {
  return calcularPrecificacao(p);
}
