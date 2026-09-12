// A foto de capa cumpre o padrão do Mercado Livre?
//
// ===========================================================================
// O CASO
// ===========================================================================
//
// O painel da lojista, em 02/08/2026, em dezenas de anúncios:
//
//     "Perdendo exposição — A foto de capa não cumpre os requisitos."
//
// O ML não diz o tamanho no painel nem no `sub_status`. Mas manda `max_size`
// em toda foto de toda resposta de `/items`, e nós descartávamos o campo.
//
// ===========================================================================
// POR QUE NÃO DÁ PARA ADIVINHAR PELA URL
// ===========================================================================
//
// Tentei, e estava errado. Medido no CDN do ML no mesmo dia:
//
//     Papete Modare     -F = 492x245     -B = 800x800    ← -F NÃO é a maior
//     Sapatilha Modare  -F = 185x90      -B = 800x800
//     Havaianas Slim    -F = 1200x1200   -B = 800x800    ← aqui -F é a maior
//
// O sufixo da URL não indica qual variante é a maior, e a URL que o Zion
// guarda (`-O`) é sempre uma redução de 500px. Qualquer auditoria baseada em
// sufixo produz número errado — a primeira versão desta análise produziu.
//
// `max_size` é o ML falando. É a única fonte que não exige palpite.

/** O mínimo que o ML pede para a capa render zoom e não perder exposição. */
export const LADO_MINIMO_DA_CAPA = 1200;

/**
 * A fronteira entre capa QUE PRECISA DE CONSERTO e capa já consertada.
 *
 * ===========================================================================
 * POR QUE NÃO É `LADO_MINIMO_DA_CAPA` — medido em 20/08/2026
 * ===========================================================================
 *
 * `aplicar-capa` ganhou uma trava para pular anúncio cuja capa já está boa, e
 * ela comparava com 1200. Nunca disparou, e o efeito foi acumulativo: cada
 * rodada empilhava outra cópia da mesma foto nos anúncios já certos. Quatro
 * anúncios do Papete Marrom foram de 4 fotos para 7.
 *
 * A causa: mandamos 1200x1200 e o ML SERVE `991x1200` — ele recorta a borda
 * branca lateral que o quadrado acrescenta. Então a nossa própria capa correta
 * nunca alcança 1200 no menor lado.
 *
 * 1200 é o IDEAL — o tamanho em que o ML rende zoom. Não é o que separa capa
 * boa de capa ruim: as travadas desta conta têm `492x245` e `465x189` (menor
 * lado 245 e 189); as consertadas têm 991. A fronteira real está entre esses
 * dois grupos, e 500 é o mínimo que o próprio ML exige para aceitar a imagem.
 *
 * Confundir o ideal com o mínimo fez a trava nunca fechar. São dois números com
 * papéis diferentes, e agora cada um tem nome.
 */
export const LADO_ACEITAVEL_DA_CAPA = 500;

export interface CapaMedida {
  largura: number;
  altura: number;
  quadrada: boolean;
  grandeOSuficiente: boolean;
}

/**
 * Lê `"1200x1200"` como o ML escreve. `null` quando ele não informou.
 *
 * `null` significa NÃO SEI, e nunca "está fora do padrão": acusar a capa de
 * uma lojista com base em campo ausente é inventar defeito.
 */
export function lerMaxSize(maxSize: string | null | undefined): CapaMedida | null {
  const m = /^\s*(\d+)\s*[xX]\s*(\d+)\s*$/.exec(maxSize ?? "");
  if (!m) return null;
  const largura = Number(m[1]);
  const altura = Number(m[2]);
  if (!largura || !altura) return null;
  return {
    largura,
    altura,
    quadrada: largura === altura,
    grandeOSuficiente: largura >= LADO_MINIMO_DA_CAPA && altura >= LADO_MINIMO_DA_CAPA,
  };
}

export interface ResumoDasCapas {
  /** Capas cujo tamanho o ML informou. As outras não entram em conta nenhuma. */
  medidas: number;
  /** O ML não informou o tamanho — não sabemos, e não é acusação. */
  semTamanho: number;
  /** Quadrada E com pelo menos 1200 de lado. */
  noPadrao: number;
  foraDoPadrao: number;
  /** Os anúncios fora do padrão, do menor para o maior, com a medida. */
  piores: { mlb: string; tamanho: string }[];
}

export interface AnuncioComCapa {
  mlb: string;
  fotoCapaMaxSize?: string;
}

/** Quantos exemplos listar — o suficiente para agir, sem virar despejo. */
const PIORES_LISTADOS = 12;

export function resumirCapas(anuncios: readonly AnuncioComCapa[]): ResumoDasCapas {
  let medidas = 0;
  let semTamanho = 0;
  let noPadrao = 0;
  const fora: { mlb: string; tamanho: string; area: number }[] = [];

  for (const a of anuncios) {
    const c = lerMaxSize(a.fotoCapaMaxSize);
    if (!c) {
      semTamanho++;
      continue;
    }
    medidas++;
    if (c.quadrada && c.grandeOSuficiente) {
      noPadrao++;
    } else {
      fora.push({
        mlb: a.mlb,
        tamanho: `${c.largura}x${c.altura}`,
        area: c.largura * c.altura,
      });
    }
  }

  fora.sort((x, y) => x.area - y.area || x.mlb.localeCompare(y.mlb));
  return {
    medidas,
    semTamanho,
    noPadrao,
    foraDoPadrao: fora.length,
    piores: fora.slice(0, PIORES_LISTADOS).map(({ mlb, tamanho }) => ({ mlb, tamanho })),
  };
}
