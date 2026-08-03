// Deixar a foto quadrada sem inventar pixel.
//
// ===========================================================================
// O CASO
// ===========================================================================
//
// Medido na conta da Chinelaria em 02/08/2026, pelo `max_size` do próprio ML:
//
//     993x1200 · 961x1200 · 896x1152 · 559x699 · 552x684
//
// Não são fotos pequenas: são fotos EM PÉ. O Mercado Livre pede a capa quadrada
// e com pelo menos 1200 de lado, e tira exposição de quem não cumpre. Uma foto
// 993x1200 já tem os 1200 — falta só a lateral.
//
// ===========================================================================
// A REGRA: COMPLETAR, NUNCA CORTAR NEM ESTICAR
// ===========================================================================
//
// `fit: "contain"` põe a imagem inteira dentro do quadrado e completa o resto
// com branco. As três alternativas foram descartadas, e por quê:
//
//   cover   corta as bordas. Numa foto de sapato, corta o sapato.
//   fill    estica. Um chinelo esticado é um chinelo que não existe, e a
//           compradora decide a compra por ele.
//   ampliar inventa pixel. Uma foto 699x344 esticada para 1200 fica borrada, e
//           borrada é exatamente o que o ML está punindo.
//
// Por isso esta função RECUSA o que não tem tamanho: sem 1200 em nenhum lado,
// não há o que completar — há o que fotografar de novo.

import sharp from "sharp";

/** O lado que o Mercado Livre exige na capa. */
export const LADO_ALVO = 1200;

export type ResultadoDoQuadrado =
  | { ok: true; imagem: Buffer; de: string; para: string }
  | { ok: false; motivo: string };

/**
 * Devolve a mesma foto, quadrada, com o vazio preenchido de branco.
 *
 * Recusa em três casos, e cada recusa é uma proteção:
 *
 *  · já é quadrada e grande — não há trabalho, e reprocessar só degradaria o
 *    JPEG mais uma vez;
 *  · o maior lado é menor que 1200 — ampliar inventa pixel;
 *  · não dá para ler a imagem — melhor recusar que subir lixo para o anúncio.
 */
export async function quadrarCapa(original: Buffer): Promise<ResultadoDoQuadrado> {
  let largura = 0;
  let altura = 0;
  try {
    const m = await sharp(original).metadata();
    largura = m.width ?? 0;
    altura = m.height ?? 0;
  } catch {
    return { ok: false, motivo: "Não consegui ler esta imagem." };
  }
  if (!largura || !altura) return { ok: false, motivo: "A imagem não tem dimensões legíveis." };

  const de = `${largura}x${altura}`;
  if (largura === altura && largura >= LADO_ALVO) {
    return { ok: false, motivo: `A capa já está ${de} — dentro do padrão. Nada a fazer.` };
  }

  const maior = Math.max(largura, altura);
  if (maior < LADO_ALVO) {
    return {
      ok: false,
      motivo: `A capa tem ${de}: o maior lado precisa ter ao menos ${LADO_ALVO} pixels. Ampliar inventaria pixel e ficaria borrada — esta precisa de foto nova.`,
    };
  }

  try {
    const imagem = await sharp(original)
      // `contain` completa; nunca corta e nunca estica.
      .resize({
        width: LADO_ALVO,
        height: LADO_ALVO,
        fit: "contain",
        background: { r: 255, g: 255, b: 255 },
      })
      // Achatar sobre branco: PNG com transparência viraria fundo preto no ML.
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 90 })
      .toBuffer();
    return { ok: true, imagem, de, para: `${LADO_ALVO}x${LADO_ALVO}` };
  } catch {
    return { ok: false, motivo: "Falhou ao converter a imagem." };
  }
}

/**
 * A URL da MAIOR variação de uma foto, dentre as que o ML lista.
 *
 * O ML devolve `variations[]` com tamanho e URL de cada uma. Adivinhar pelo
 * sufixo da URL NÃO funciona — medido em 02/08/2026: `-F` é a maior numa imagem
 * e é 492x245 em outra, enquanto `-B` é a maior nessa segunda.
 *
 * Sem `size` legível, a variação é ignorada: escolher a primeira seria escolher
 * no escuro.
 */
export function maiorVariacao(
  variacoes: readonly { size?: string; secure_url?: string; url?: string }[]
): { url: string; size: string } | null {
  let melhor: { url: string; size: string; area: number } | null = null;
  for (const v of variacoes ?? []) {
    const url = (v.secure_url || v.url || "").trim();
    const m = /^\s*(\d+)\s*[xX]\s*(\d+)\s*$/.exec(v.size ?? "");
    if (!url || !m) continue;
    const area = Number(m[1]) * Number(m[2]);
    if (!melhor || area > melhor.area) melhor = { url, size: `${m[1]}x${m[2]}`, area };
  }
  return melhor ? { url: melhor.url, size: melhor.size } : null;
}
