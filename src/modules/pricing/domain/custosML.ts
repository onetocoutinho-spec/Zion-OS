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
  reputacaoDoLevelId,
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

/**
 * O tipo do anúncio em português, venha ele do ML ou da configuração da loja.
 *
 * Existe porque as duas fontes falam dialetos diferentes: `canais_marketplace`
 * guarda "Premium"/"Clássico", e o Mercado Livre devolve `gold_pro` /
 * `gold_special` no `listing_type_id`. Até 24/08/2026 só o primeiro dialeto
 * chegava aqui, porque o segundo era descartado na importação — e alimentar
 * `comissaoDoAnuncio` com o código cru faria `gold_special` cair no default e
 * ser cobrado como Premium: 19% sobre um anúncio que paga 14%.
 *
 * O mapeamento é o mesmo já registrado em `diagnosticoNoServidor.ts` e em
 * `mlPayload.ts`. Uma terceira versão dele divergiria das outras duas.
 *
 * `null` = NÃO RECONHEÇO. Um tipo novo que o ML crie amanhã não pode virar
 * "clássico" em silêncio, porque quem lê a resposta decide preço com ela.
 */
export function nomeDoTipoDeAnuncio(bruto: string | null | undefined): "Clássico" | "Premium" | null {
  const t = (bruto ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t === "clássico" || t === "classico" || t === "gold_special") return "Clássico";
  if (t === "premium" || t === "gold_pro") return "Premium";
  return null;
}

/**
 * O tipo de anúncio DE UM PRODUTO, a partir dos anúncios dele no ML.
 *
 * Um produto de calçado tem um anúncio por numeração — dezesseis, no caso que
 * motivou isto. Eles quase sempre compartilham o tipo, mas nada no ML obriga.
 *
 * Quando DIVERGEM, a resposta é `null`, e não "o do primeiro" nem "o mais
 * comum": esse produto não tem UMA comissão, e escolher uma delas produziria
 * um número com cara de exato sobre uma pergunta que não tem resposta única. O
 * `null` faz a procedência cair para "tabela", que é a frase honesta.
 *
 * Anúncio sem tipo lido é ignorado — ausência de leitura não é divergência.
 */
export function tipoUnicoDosAnuncios(tipos: readonly (string | null | undefined)[]): string | null {
  const conhecidos = new Set<string>();
  for (const t of tipos) {
    const nome = nomeDoTipoDeAnuncio(t);
    if (nome) conhecidos.add(nome);
  }
  return conhecidos.size === 1 ? [...conhecidos][0] : null;
}

export function comissaoDoAnuncio(
  tipoAnuncio: string | null | undefined,
  comissao: ComissaoPorTipo = COMISSAO_MODA
): number {
  // O default espelha `canaisMarketplace.paraApp`: sem tipo, o canal é Premium.
  //
  // E ele também é a direção SEGURA quando o tipo não é reconhecido: premium é
  // a comissão MAIOR, então supor premium faz a margem parecer pior do que é.
  // O contrário — inflar a margem — é o defeito que este modelo mais repetiu.
  return nomeDoTipoDeAnuncio(tipoAnuncio) === "Clássico" ? comissao.classico : comissao.premium;
}
