// Modelo de preço — puro, sem rede, sem React.
//
// A margem mínima é escolha do lojista (migração 029). As taxas vêm de
// `custosML`, que agora usa a TABELA OFICIAL do Mercado Livre:
//
//   comissão → % por tipo de anúncio (Clássico 14% / Premium 19% em Moda)
//   envio    → matriz peso × faixa de preço, por reputação. Incide SEMPRE.
//
// Histórico das correções, para ninguém refazer o caminho errado:
//   1ª versão: comissão 30% (11 pontos fictícios), custo fixo R$ 1,15 em todo
//              preço, frete R$ 14,15 fixo acima de R$ 79. Tudo chute.
//   2ª versão: comissão real, mas com um "custo fixo por faixa de preço" que
//              não existe, e frete tratado como desconhecido.
//   agora:     a tabela oficial. Não há mais custo desconhecido quando se sabe
//              o peso — e o peso está em `produto_variantes` desde a migração 001.
//
// O que ainda pode faltar é o PESO da variante. Aí sim o resultado é null:
// estimar o envio sem peso faria o piso parecer menor do que é, e o lojista
// venderia no prejuízo sem saber.

import {
  COMISSAO_MODA,
  LIMIAR_FRETE_GRATIS,
  REPUTACAO_PADRAO,
  TETOS_PRECO,
  comissaoDoAnuncio,
  custoDeEnvio,
  pesoCobravelGramas,
  type ComissaoPorTipo,
  type Embalagem,
  type ReputacaoEnvio,
} from "./custosML.ts";

export { LIMIAR_FRETE_GRATIS, COMISSAO_MODA, REPUTACAO_PADRAO };
export type { Embalagem, ComissaoPorTipo, ReputacaoEnvio };
export { ROTULO_REPUTACAO } from "./tabelaEnvioML.ts";

/** Tudo o que decide quanto uma venda custa. */
export interface ModeloTaxas {
  /** Comissão da categoria, por tipo de anúncio. */
  comissao: ComissaoPorTipo;
  /** "Clássico" ou "Premium" — vem do canal do cliente. */
  tipoAnuncio: string;
  /** Reputação do lojista: escolhe qual das três tabelas de envio vale. */
  reputacao: ReputacaoEnvio;
  /** Medidas da variante. null = sem peso, e o envio vira pendência. */
  embalagem: Embalagem | null;
}

/**
 * O padrão: categoria Moda, canal Premium (o default de `canaisMarketplace`) e
 * reputação verde — que é o que o ML aplica a quem não tem reputação ainda.
 */
export const TAXAS_PADRAO: ModeloTaxas = {
  comissao: COMISSAO_MODA,
  tipoAnuncio: "Premium",
  reputacao: REPUTACAO_PADRAO,
  embalagem: null,
};

/** O piso que a Zion assumia pelo lojista. Vira apenas o valor inicial dele. */
export const MARGEM_MINIMA_PADRAO = 5;
export const MARGEM_MINIMA_PERMITIDA = 0;
export const MARGEM_MAXIMA_PERMITIDA = 60;

const SEM_PESO =
  "Falta o peso e as medidas da embalagem para calcular o envio deste produto.";

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

/** A comissão em % que vale para este modelo. */
export function comissaoPercentual(taxas: ModeloTaxas = TAXAS_PADRAO): number {
  return comissaoDoAnuncio(taxas.tipoAnuncio, taxas.comissao);
}

/** O custo de envio para um preço, ou null quando falta o peso. */
export function envioDoModelo(
  preco: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): number | null {
  if (!taxas.embalagem) return null;
  return custoDeEnvio(pesoCobravelGramas(taxas.embalagem), preco, taxas.reputacao);
}

export interface CustoDaVenda {
  comissao: number;
  /** null quando falta o peso da embalagem. */
  envio: number | null;
  /** null quando alguma parcela é desconhecida — nunca um total parcial. */
  total: number | null;
  /** O que falta para fechar a conta. null quando o total é confiável. */
  pendencia: string | null;
}

/** Quanto o marketplace leva desta venda. Puro. */
export function custoDaVenda(
  preco: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): CustoDaVenda {
  if (preco <= 0) return { comissao: 0, envio: 0, total: 0, pendencia: null };

  const comissao = arredondar((preco * comissaoPercentual(taxas)) / 100);
  const envio = envioDoModelo(preco, taxas);
  if (envio === null) {
    return { comissao, envio: null, total: null, pendencia: SEM_PESO };
  }
  return { comissao, envio, total: arredondar(comissao + envio), pendencia: null };
}

/** Soma das taxas, ou null quando falta o peso. */
export function custoDasTaxas(
  preco: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): number | null {
  return custoDaVenda(preco, taxas).total;
}

/** Lucro em reais, ou null quando as taxas não fecham. */
export function lucroLiquido(
  custo: number,
  preco: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): number | null {
  if (preco <= 0) return 0;
  const total = custoDasTaxas(preco, taxas);
  if (total === null) return null;
  return arredondar(preco - custo - total);
}

/** Margem líquida em % sobre o preço, ou null quando as taxas não fecham. */
export function margemLiquida(
  custo: number,
  preco: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): number | null {
  if (preco <= 0) return 0;
  const lucro = lucroLiquido(custo, preco, taxas);
  if (lucro === null) return null;
  return Math.round((lucro / preco) * 1000) / 10;
}

export type ResultadoPrecoMinimo =
  | { ok: true; preco: number }
  /** comissão + margem ≥ 100%: não existe preço que satisfaça. */
  | { ok: false; motivo: "margem_impossivel" }
  /** Falta o peso da embalagem — o envio não é estimável. */
  | { ok: false; motivo: "sem_peso"; pendencia: string };

/**
 * O menor preço que ainda entrega a margem escolhida pelo lojista.
 *
 * O envio depende do PREÇO (a matriz tem faixas por preço), e o preço é
 * justamente o que se quer descobrir. Então cada faixa de preço gera um
 * candidato — resolvendo preco = (custo + envio_da_faixa) / (1 − comissão −
 * margem) — e vale o primeiro que cai DENTRO da própria faixa.
 */
export function precoMinimo(
  custo: number,
  margemDesejada: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): ResultadoPrecoMinimo {
  const divisor = 1 - comissaoPercentual(taxas) / 100 - margemDesejada / 100;
  if (divisor <= 0) return { ok: false, motivo: "margem_impossivel" };
  if (!taxas.embalagem) return { ok: false, motivo: "sem_peso", pendencia: SEM_PESO };

  let anterior = 0;
  for (const teto of TETOS_PRECO) {
    // Um preço qualquer DENTRO da faixa serve para consultar o custo de envio
    // dela — dentro da faixa o valor é constante.
    const amostra = Number.isFinite(teto) ? teto : anterior + 1;
    const envio = envioDoModelo(amostra, taxas);
    if (envio === null) return { ok: false, motivo: "sem_peso", pendencia: SEM_PESO };

    const candidato = (custo + envio) / divisor;
    if (candidato <= teto) {
      // Nunca abaixo do piso da própria faixa: se o cálculo cair antes dela, é
      // porque a faixa anterior não coube — o preço é o começo desta.
      return { ok: true, preco: arredondar(Math.max(candidato, anterior)) };
    }
    anterior = teto;
  }
  // A última faixa é aberta, então o laço acima sempre resolve. Inalcançável.
  return { ok: false, motivo: "margem_impossivel" };
}

/** Atalho para quem só quer o número e trata a ausência como desconhecida. */
export function precoMinimoOuNull(
  custo: number,
  margemDesejada: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): number | null {
  const r = precoMinimo(custo, margemDesejada, taxas);
  return r.ok ? r.preco : null;
}

/** Puro: a margem escolhida é utilizável? */
export function margemValida(margem: number, taxas: ModeloTaxas = TAXAS_PADRAO): boolean {
  if (!Number.isFinite(margem)) return false;
  if (margem < MARGEM_MINIMA_PERMITIDA || margem > MARGEM_MAXIMA_PERMITIDA) return false;
  return comissaoPercentual(taxas) / 100 + margem / 100 < 1;
}

export type SaudeMargem = "Saudável" | "Atenção" | "Risco" | "Prejuízo" | "—";

/**
 * A saúde é medida contra a margem que O LOJISTA escolheu. Margem desconhecida
 * não vira veredito: "—" é honesto, "Saudável" seria mentira.
 */
export function classificarMargem(
  margem: number | null,
  margemMinima: number
): SaudeMargem {
  if (margem === null) return "—";
  if (margem < 0) return "Prejuízo";
  if (margem < margemMinima) return "Risco";
  if (margem < margemMinima * 2) return "Atenção";
  return "Saudável";
}
