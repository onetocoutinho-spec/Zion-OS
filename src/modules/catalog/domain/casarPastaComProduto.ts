// Qual produto é a pasta de fotos que a pessoa acabou de escolher.
//
// ===========================================================================
// POR QUE SAIU DA TELA
// ===========================================================================
//
// Esta função morava dentro de `cliente/imagens/page.tsx`, e ali ela era
// inalcançável por teste: componente de página não se chama de um `node:test`.
// Ela decide para qual produto vão as fotos de uma pasta inteira — errar
// significa a foto de uma cama aparecer no anúncio de outra —, e uma decisão
// desse tamanho não pode viver num lugar onde ninguém consegue apontar uma
// prova.
//
// ===========================================================================
// DUAS FORMAS DE CASAR, E ELAS NÃO VALEM O MESMO
// ===========================================================================
//
// CÓDIGO   a pasta contém o SKU ou o código do ERP. É identidade: ou é aquele
//          produto, ou não é. Não tem "quase".
//
// NOME     palavras em comum entre a pasta e o nome do produto. É parecença, e
//          parecença erra — ainda mais num catálogo de móveis, onde "Cama -
//          BELLA", "Cama - NAZARÉ" e "Cama Box" dividem a palavra que mais
//          aparece.
//
// Código vence nome sempre, e a confiança volta junto do resultado para a tela
// poder mostrar o quanto aquilo é um palpite. Antes ela mostrava só "casou" ou
// "não casou", e um casamento de 35% parecia igual a um de 100%.

/** Uma parecença abaixo disto não casa: vira "não casou", que é o erro seguro. */
export const CORTE_DE_PARECENCA = 0.34;

export interface ProdutoParaCasar {
  id: string;
  nome: string;
  sku?: string;
  codErp?: string;
}

export interface Casamento {
  produtoId: string | null;
  /** 0 a 1. Por código é sempre 1 — identidade não tem grau. */
  confianca: number;
  via: "codigo" | "nome" | null;
}

const norm = (s: string): string =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Só letras e números, para comparar código com nome de pasta. */
const soAlfanum = (s: string): string => norm(s).replace(/[^a-z0-9]/g, "");

const palavrasDe = (s: string): Set<string> =>
  new Set(
    norm(s)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2)
  );

/**
 * Um código curto demais casa por acaso.
 *
 * "A1" aparece dentro de qualquer coisa. Quatro caracteres é o mínimo em que a
 * coincidência deixa de ser provável — e um código de verdade tem mais.
 */
const CODIGO_MINIMO = 4;

function casaPorCodigo(pasta: string, p: ProdutoParaCasar): boolean {
  const alvo = soAlfanum(pasta);
  for (const codigo of [p.sku, p.codErp]) {
    const c = soAlfanum(codigo ?? "");
    if (c.length >= CODIGO_MINIMO && alvo.includes(c)) return true;
  }
  return false;
}

export function casarPastaComProduto(
  pasta: string,
  produtos: readonly ProdutoParaCasar[]
): Casamento {
  // Identidade primeiro. Um código na pasta encerra a pergunta, e nenhuma
  // parecença de nome deveria discutir com ele.
  for (const p of produtos) {
    if (casaPorCodigo(pasta, p)) return { produtoId: p.id, confianca: 1, via: "codigo" };
  }

  const alvo = palavrasDe(pasta);
  if (alvo.size === 0) return { produtoId: null, confianca: 0, via: null };

  let melhor: string | null = null;
  let melhorScore = 0;
  for (const p of produtos) {
    const palavras = palavrasDe(p.nome);
    let comuns = 0;
    for (const w of alvo) if (palavras.has(w)) comuns++;
    const score = comuns / Math.max(alvo.size, palavras.size, 1);
    if (score > melhorScore) {
      melhorScore = score;
      melhor = p.id;
    }
  }

  return melhorScore >= CORTE_DE_PARECENCA
    ? { produtoId: melhor, confianca: melhorScore, via: "nome" }
    : { produtoId: null, confianca: melhorScore, via: null };
}
