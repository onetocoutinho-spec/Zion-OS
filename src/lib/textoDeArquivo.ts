// Decodificação de arquivo de texto — puro, sem File API, sem rede.
//
// POR QUE ISTO EXISTE:
// `file.text()` do navegador decodifica SEMPRE como UTF-8. O Excel no Windows
// exporta CSV em Windows-1252 por padrão, e é o formato que sai da maioria dos
// ERPs brasileiros. Resultado: todo acento vira o caractere de substituição
// (U+FFFD, o "" preto), e o nome corrompido segue direto para o título do
// anúncio no marketplace.
//
// Isso não é cosmético. "Tênis" virando "T?nis" é um título publicado errado,
// e o lojista só descobre depois de o anúncio estar no ar.

/** O caractere que o decodificador coloca no lugar do byte que não entendeu. */
const SUBSTITUICAO = "�";

export type EncodingDetectado = "utf-8" | "windows-1252";

export interface TextoDecodificado {
  texto: string;
  encoding: EncodingDetectado;
  /** true quando sobrou caractere corrompido mesmo depois da escolha. */
  temCorrupcao: boolean;
}

/**
 * Decodifica bytes de um arquivo de texto escolhendo o encoding certo.
 *
 * A regra é a que o padrão permite decidir com certeza: UTF-8 é auto-validante.
 * Uma sequência de bytes válida em UTF-8 quase nunca é acidental — então se o
 * conteúdo decodifica em UTF-8 sem erro, é UTF-8. Se não decodifica, é
 * praticamente certo que seja Windows-1252 (superset do Latin-1), o padrão do
 * Excel brasileiro.
 *
 * Nunca lança: um arquivo ilegível vira texto com marcas de corrupção e a
 * flag ligada, para quem chamou poder avisar em vez de gravar lixo em silêncio.
 */
export function decodificarTexto(bytes: ArrayBuffer | Uint8Array): TextoDecodificado {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  // BOM de UTF-8: decide sozinho, sem heurística.
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    const texto = new TextDecoder("utf-8").decode(buf);
    return { texto, encoding: "utf-8", temCorrupcao: texto.includes(SUBSTITUICAO) };
  }

  // `fatal: true` faz o decodificador LANÇAR em vez de mascarar com "".
  // É essa exceção que distingue os dois casos.
  try {
    const texto = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return { texto, encoding: "utf-8", temCorrupcao: false };
  } catch {
    const texto = new TextDecoder("windows-1252").decode(buf);
    return { texto, encoding: "windows-1252", temCorrupcao: texto.includes(SUBSTITUICAO) };
  }
}

/**
 * Um texto já decodificado carrega marca de corrupção?
 *
 * Serve para o que JÁ ESTÁ no banco: os produtos gravados antes desta correção
 * não podem ser reparados adivinhando o byte original — a informação se perdeu
 * na decodificação. O que dá para fazer é DETECTAR e avisar.
 */
export function pareceCorrompido(texto: string): boolean {
  return texto.includes(SUBSTITUICAO);
}

/** Quantos itens de uma lista têm texto corrompido. Puro. */
export function contarCorrompidos(textos: readonly (string | null | undefined)[]): number {
  return textos.filter((t) => typeof t === "string" && pareceCorrompido(t)).length;
}
