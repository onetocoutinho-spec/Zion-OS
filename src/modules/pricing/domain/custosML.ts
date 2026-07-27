// Os custos do Mercado Livre — puro, sem rede.
//
// A tabela oficial (tabelaEnvioML.ts) corrigiu duas coisas que este arquivo
// afirmava antes e estavam erradas:
//
//   ✗ "existe um custo fixo por faixa de preço, cobrado só abaixo de R$ 79"
//   ✓ existe UM custo de envio, cobrado em TODAS as vendas, que é uma matriz
//     peso × faixa de preço. Abaixo de R$ 79 ele é pequeno; a partir de R$ 79
//     ele salta, porque é quando o frete grátis passa a ser do vendedor.
//
//   ✗ "não existe tabela pública estável de frete, então devolvemos null"
//   ✓ existe, é pública, e está encodada. O que varia é a REPUTAÇÃO do lojista,
//     que escolhe entre três tabelas — e vendedor sem reputação usa a verde,
//     por regra do próprio ML.
//
// Os valores R$ 5,50 / R$ 6,00 que estavam em TABELA_CUSTO_FIXO eram estimativa
// de terceiros, não a fonte. Foram removidos.

import {
  TABELA_ENVIO,
  TETOS_PESO_G,
  TETOS_PRECO,
  PRECO_TETO_METADE,
  REPUTACAO_PADRAO,
  type ReputacaoEnvio,
} from "./tabelaEnvioML.ts";

export {
  TABELA_ENVIO,
  TETOS_PESO_G,
  TETOS_PRECO,
  REPUTACAO_PADRAO,
  ROTULO_REPUTACAO,
  type ReputacaoEnvio,
} from "./tabelaEnvioML.ts";

/**
 * Preço a partir do qual o frete grátis passa a ser custeado pelo VENDEDOR.
 * Não é o ponto em que o custo começa — é onde ele salta.
 */
export const LIMIAR_FRETE_GRATIS = 79;

/**
 * Divisor de cubagem (cm³ → gramas equivalentes).
 *
 * 6000 é o divisor de praxe no mercado brasileiro. A página oficial diz que o
 * custo vem "das medidas e peso" sem publicar o divisor — por isso é parâmetro,
 * não número embutido no cálculo.
 */
export const DIVISOR_CUBAGEM_PADRAO = 6000;

/** Medidas da embalagem. Já existem em `ProdutoVariante` (peso em kg, resto cm). */
export interface Embalagem {
  pesoGramas: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
}

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * O peso que o ML cobra: o MAIOR entre o peso real e o cubado.
 *
 * Quem vende volumoso e leve — caixa de chinelo é exatamente isso — paga pelo
 * volume, não pela balança. Medida faltando conta como zero: sem dimensão não
 * há cubagem e o peso real prevalece, nunca o contrário, para não inflar o
 * frete por falta de dado.
 */
export function pesoCobravelGramas(
  e: Embalagem,
  divisorCubagem: number = DIVISOR_CUBAGEM_PADRAO
): number {
  if (divisorCubagem <= 0) return Math.max(0, e.pesoGramas);
  const volume = e.alturaCm * e.larguraCm * e.comprimentoCm;
  const cubado = volume > 0 ? (volume / divisorCubagem) * 1000 : 0;
  return arredondar(Math.max(0, e.pesoGramas, cubado));
}

/** Índice da faixa cujo teto cobre o valor. -1 quando nenhuma cobre. */
function faixa(valor: number, tetos: readonly number[]): number {
  return tetos.findIndex((teto) => valor <= teto);
}

/**
 * Custo de envio de uma unidade. Puro.
 *
 * Incide SEMPRE — a página oficial é explícita: "se aplica a todas as vendas,
 * mesmo que o comprador pague pelo envio".
 *
 * Devolve null só para entrada inválida (peso ou preço negativo). Fora disso a
 * matriz cobre de R$ 0 a infinito e de 0 g a mais de 150 kg.
 */
export function custoDeEnvio(
  pesoGramas: number,
  preco: number,
  reputacao: ReputacaoEnvio = REPUTACAO_PADRAO
): number | null {
  if (!Number.isFinite(pesoGramas) || pesoGramas < 0) return null;
  if (!Number.isFinite(preco) || preco < 0) return null;
  if (preco === 0) return 0;

  const iPeso = faixa(pesoGramas, TETOS_PESO_G);
  const iPreco = faixa(preco, TETOS_PRECO);
  if (iPeso < 0 || iPreco < 0) return null;

  const bruto = TABELA_ENVIO[reputacao][iPeso][iPreco];
  // Rodapé da tabela: abaixo de R$ 19 o envio custa no máximo metade do preço.
  // Sem isso, um item de R$ 8 pagaria R$ 5,65 de envio — mais da metade dele.
  const teto = preco < PRECO_TETO_METADE ? preco / 2 : Infinity;
  return arredondar(Math.min(bruto, teto));
}

/**
 * Comissão do marketplace por tipo de anúncio, em %.
 *
 * `tipoAnuncio` já existe em `canais_marketplace` (default "Premium" em
 * `canaisMarketplace.ts`). Os valores são da categoria Moda (Roupa & Calçado);
 * outras categorias têm faixas próprias, por isso isto é um mapa por categoria
 * e não duas constantes soltas.
 */
export interface ComissaoPorTipo {
  classico: number;
  premium: number;
}

/** Moda / Roupa & Calçado — a categoria do cliente atual. */
export const COMISSAO_MODA: ComissaoPorTipo = { classico: 14, premium: 19 };

export function comissaoDoAnuncio(
  tipoAnuncio: string | null | undefined,
  comissao: ComissaoPorTipo = COMISSAO_MODA
): number {
  // O default espelha `canaisMarketplace.paraApp`: sem tipo, o canal é Premium.
  return tipoAnuncio === "Clássico" ? comissao.classico : comissao.premium;
}
