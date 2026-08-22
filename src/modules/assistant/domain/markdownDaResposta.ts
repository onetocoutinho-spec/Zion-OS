// O markdown que o assistente escreve, virado em estrutura.
//
// Puro: texto entra, blocos saem. Nenhum HTML é produzido em lugar nenhum —
// quem desenha é React, a partir destes blocos. Isso não é preciosismo: um
// parser que devolve string de HTML precisa de `dangerouslySetInnerHTML`, e aí
// qualquer coisa que o modelo escreva vira execução. Devolvendo dados, o pior
// que pode acontecer é uma tabela feia.
//
// O subconjunto é pequeno de propósito. Não é "markdown"; é o que ESTE
// assistente escreve, e nós controlamos o prompt dele. Ampliar quando aparecer
// necessidade real é barato; carregar CommonMark inteiro para um chat de
// operação seria pagar por um problema que não temos.
//
// Sem dependência nova: o projeto tem sete, e essa economia é uma escolha.

export type Bloco =
  | { tipo: "paragrafo"; partes: readonly Trecho[] }
  | { tipo: "titulo"; nivel: 2 | 3; partes: readonly Trecho[] }
  | { tipo: "lista"; ordenada: boolean; itens: readonly (readonly Trecho[])[] }
  | { tipo: "tabela"; cabecalho: readonly string[]; linhas: readonly (readonly string[])[] }
  | { tipo: "codigo"; texto: string }
  | { tipo: "citacao"; partes: readonly Trecho[] };

/** Um pedaço de texto com ou sem ênfase. `codigo` é `assim`. */
export type Trecho =
  | { tipo: "texto"; texto: string }
  | { tipo: "forte"; texto: string }
  | { tipo: "codigo"; texto: string }
  /**
   * Um link — `[rótulo](destino)` ou uma URL https solta.
   *
   * Existe desde 22/08/2026 porque o permalink do anúncio publicado chegava
   * como TEXTO MORTO: "Está no ar: https://…" sem clique. `destino` só sai
   * daqui se `destinoPermitido` aceitar — o resto vira texto, não link.
   */
  | { tipo: "link"; texto: string; destino: string };

/**
 * Para onde um link do assistente pode apontar.
 *
 * Caminhos internos (`/cliente/...`) e https. Nada de `javascript:`, `data:`,
 * http puro ou host vazio: o texto vem do modelo, e o modelo lê conteúdo de
 * fora (títulos importados, PDFs). Um link é o único trecho que executa algo
 * no clique, então é o único que passa por uma lista.
 */
export function destinoPermitido(destino: string): boolean {
  const d = destino.trim();
  if (d.startsWith("/") && !d.startsWith("//")) return true;
  try {
    const u = new URL(d);
    return u.protocol === "https:" && u.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Quebra uma linha em trechos com ênfase.
 *
 * A ordem importa: `código` é resolvido ANTES de **negrito**, porque um trecho
 * de código pode conter asteriscos e eles não são ênfase ali dentro. Link
 * explícito `[x](y)` vem antes da URL solta, senão a URL dentro dos parênteses
 * casaria sozinha.
 */
export function trechosDaLinha(linha: string): Trecho[] {
  const saida: Trecho[] = [];
  // Um passo só, alternando entre os padrões, para não reprocessar o que
  // já virou código.
  const padrao = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(https:\/\/[^\s<>()]+[^\s<>().,;:!?])/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = padrao.exec(linha)) !== null) {
    if (m.index > ultimo) {
      saida.push({ tipo: "texto", texto: linha.slice(ultimo, m.index) });
    }
    if (m[1] !== undefined) saida.push({ tipo: "codigo", texto: m[1] });
    else if (m[2] !== undefined) saida.push({ tipo: "forte", texto: m[2] });
    else if (m[3] !== undefined && m[4] !== undefined) {
      if (destinoPermitido(m[4])) saida.push({ tipo: "link", texto: m[3], destino: m[4] });
      else saida.push({ tipo: "texto", texto: m[0] });
    } else if (m[5] !== undefined) {
      if (destinoPermitido(m[5])) saida.push({ tipo: "link", texto: m[5], destino: m[5] });
      else saida.push({ tipo: "texto", texto: m[5] });
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linha.length) saida.push({ tipo: "texto", texto: linha.slice(ultimo) });
  return saida.length ? saida : [{ tipo: "texto", texto: linha }];
}

function celulas(linha: string): string[] {
  return linha
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** A linha `|---|---|` que separa cabeçalho de corpo numa tabela. */
function ehSeparadorDeTabela(linha: string): boolean {
  return /^\s*\|?[\s:-]*-[\s|:-]*\|?\s*$/.test(linha) && linha.includes("-");
}

/**
 * O texto inteiro, em blocos.
 *
 * Tolerante de propósito: markdown malformado vira parágrafo, nunca erro. O
 * texto está CHEGANDO enquanto isso roda (streaming) — metade de uma tabela é
 * o estado normal, não uma exceção, e explodir ali apagaria a resposta na cara
 * de quem está lendo.
 */
export function blocosDoMarkdown(texto: string): Bloco[] {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const blocos: Bloco[] = [];
  let i = 0;

  while (i < linhas.length) {
    const linha = linhas[i];

    if (!linha.trim()) {
      i++;
      continue;
    }

    // ``` código ```
    if (/^\s*```/.test(linha)) {
      const corpo: string[] = [];
      i++;
      while (i < linhas.length && !/^\s*```/.test(linhas[i])) {
        corpo.push(linhas[i]);
        i++;
      }
      i++; // fecha
      blocos.push({ tipo: "codigo", texto: corpo.join("\n") });
      continue;
    }

    // ## título
    const titulo = /^(#{2,3})\s+(.*)$/.exec(linha);
    if (titulo) {
      blocos.push({
        tipo: "titulo",
        nivel: titulo[1].length === 2 ? 2 : 3,
        partes: trechosDaLinha(titulo[2]),
      });
      i++;
      continue;
    }

    // > citação
    if (/^\s*>\s?/.test(linha)) {
      const corpo: string[] = [];
      while (i < linhas.length && /^\s*>\s?/.test(linhas[i])) {
        corpo.push(linhas[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocos.push({ tipo: "citacao", partes: trechosDaLinha(corpo.join(" ")) });
      continue;
    }

    // | tabela |
    if (linha.trim().startsWith("|") && ehSeparadorDeTabela(linhas[i + 1] ?? "")) {
      const cabecalho = celulas(linha);
      i += 2;
      const corpo: string[][] = [];
      while (i < linhas.length && linhas[i].trim().startsWith("|")) {
        corpo.push(celulas(linhas[i]));
        i++;
      }
      blocos.push({ tipo: "tabela", cabecalho, linhas: corpo });
      continue;
    }

    // - lista  /  1. lista
    const marcador = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(linha);
    if (marcador) {
      const ordenada = /\d/.test(marcador[1]);
      const itens: Trecho[][] = [];
      while (i < linhas.length) {
        const m = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(linhas[i]);
        if (!m || /\d/.test(m[1]) !== ordenada) break;
        itens.push(trechosDaLinha(m[2]));
        i++;
      }
      blocos.push({ tipo: "lista", ordenada, itens });
      continue;
    }

    // parágrafo: junta até a linha em branco
    const corpo: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !/^\s*(#{2,3}\s|>|```|\||[-*]\s|\d+\.\s)/.test(linhas[i])) {
      corpo.push(linhas[i].trim());
      i++;
    }
    if (corpo.length === 0) {
      // Nenhuma regra casou e o parágrafo não avançou. Consumir a linha crua
      // evita o laço infinito — que é o único jeito de este parser travar a aba.
      corpo.push(linhas[i].trim());
      i++;
    }
    blocos.push({ tipo: "paragrafo", partes: trechosDaLinha(corpo.join(" ")) });
  }

  return blocos;
}
