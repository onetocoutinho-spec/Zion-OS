// O que os campos novos do ML dizem sobre o catálogo.
//
// ===========================================================================
// DE ONDE ISTO VEIO
// ===========================================================================
//
// O inventário de 02/08/2026 mostrou que o ML devolve 61 campos por anúncio e
// que o Zion pedia 14. Dos 47 ignorados, sete grupos respondiam perguntas que
// estavam abertas naquele momento:
//
//   health           a NOTA do ML — é ela que decide exposição. Passamos duas
//                    horas tentando deduzir por tamanho de foto o que ele
//                    entrega pronto
//   catalog_listing  "os dados não correspondem ao produto original"
//   sold_quantity    o catálogo do Zion não tinha NENHUM dado de venda
//   last_updated     testa a hipótese da edição em massa nos 155 em revisão
//   listing_type_id  clássico vs premium — muda a comissão
//   parent_item_id   a estrutura de família (o MLB órfão do Papete)
//   descriptions     SE existe descrição
//
// ===========================================================================
// A REGRA QUE ATRAVESSA TODAS AS CONTAS AQUI
// ===========================================================================
//
// Ausência nunca vira zero. Um anúncio com `health: null` não é um anúncio com
// saúde zero — é um anúncio cuja saúde o ML não informou. Somar os dois daria
// um número menor que a verdade e mandaria a lojista consertar o que talvez
// esteja bom.

export interface AnuncioParaSaude {
  mlb: string;
  status: string;
  saude?: number | null;
  doCatalogo?: boolean | null;
  vendidos?: number | null;
  temDescricao?: boolean;
  tipoDeAnuncio?: string;
  atualizadoEmML?: string;
}

/** Abaixo disto o ML considera o anúncio incompleto o bastante para punir. */
export const SAUDE_BAIXA = 0.8;

export interface RetratoDoCatalogo {
  /** Anúncios cuja saúde o ML informou. Só eles entram nas contas de saúde. */
  comSaude: number;
  saudeMedia: number;
  /** Os piores, com a nota — para a lojista saber por onde começar. */
  piores: { mlb: string; saude: number }[];
  /** Atrelados ao catálogo do ML: é onde "não corresponde ao original" cabe. */
  doCatalogo: number;
  /** No ar e com ZERO venda. Ocupam espaço e não trabalham. */
  noArSemVenda: number;
  vendidosTotal: number;
  /** Sem descrição nenhuma no ML. */
  semDescricao: number;
  /** Por tipo de anúncio (`gold_special`, `gold_pro`…) — muda a comissão. */
  porTipo: { tipo: string; anuncios: number }[];
  /**
   * Os dias em que mais anúncios foram alterados.
   *
   * Se os 155 em revisão foram todos mexidos no mesmo dia, a hipótese da
   * edição em massa deixa de ser hipótese.
   */
  alteradosPorDia: { dia: string; anuncios: number }[];
}

const PIORES = 8;
const DIAS = 5;

function contar<T>(itens: readonly T[], chave: (t: T) => string): { k: string; n: number }[] {
  const c = new Map<string, number>();
  for (const i of itens) {
    const k = chave(i);
    if (!k) continue;
    c.set(k, (c.get(k) ?? 0) + 1);
  }
  return [...c.entries()]
    .map(([k, n]) => ({ k, n }))
    .sort((x, y) => y.n - x.n || x.k.localeCompare(y.k));
}

export function retratarCatalogo(anuncios: readonly AnuncioParaSaude[]): RetratoDoCatalogo {
  const ativo = (a: AnuncioParaSaude) => (a.status || "").trim().toLowerCase() === "active";

  const comSaude = anuncios.filter((a) => typeof a.saude === "number");
  const soma = comSaude.reduce((t, a) => t + (a.saude as number), 0);

  const piores = comSaude
    .filter((a) => (a.saude as number) < SAUDE_BAIXA)
    .map((a) => ({ mlb: a.mlb, saude: a.saude as number }))
    .sort((x, y) => x.saude - y.saude || x.mlb.localeCompare(y.mlb))
    .slice(0, PIORES);

  return {
    comSaude: comSaude.length,
    // Arredondado a 2 casas: a média é para ordenar trabalho, não para
    // contabilidade, e 0.8431372549 na tela não ajuda ninguém.
    saudeMedia: comSaude.length > 0 ? Math.round((soma / comSaude.length) * 100) / 100 : 0,
    piores,
    doCatalogo: anuncios.filter((a) => a.doCatalogo === true).length,
    // `vendidos === 0` é uma AFIRMAÇÃO do ML; `null` é ausência. Só o primeiro
    // conta como "não vendeu".
    noArSemVenda: anuncios.filter((a) => ativo(a) && a.vendidos === 0).length,
    vendidosTotal: anuncios.reduce((t, a) => t + (typeof a.vendidos === "number" ? a.vendidos : 0), 0),
    semDescricao: anuncios.filter((a) => a.temDescricao === false).length,
    porTipo: contar(anuncios, (a) => (a.tipoDeAnuncio ?? "").trim()).map(({ k, n }) => ({
      tipo: k,
      anuncios: n,
    })),
    alteradosPorDia: contar(anuncios, (a) => (a.atualizadoEmML ?? "").slice(0, 10))
      .slice(0, DIAS)
      .map(({ k, n }) => ({ dia: k, anuncios: n })),
  };
}
