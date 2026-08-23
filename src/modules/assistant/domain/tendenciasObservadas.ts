// O QUE SE OBSERVOU NAS APROVAÇÕES — tendência, não regra.
//
// O `pattern-detector` do adaptive-intelligence já aprende com decisões de
// CADASTRO. Conteúdo e imagem não entravam: aprovar um título, recusar uma
// imagem com "fundo branco", aprovar a v3 de uma linhagem — nada disso
// deixava sinal. (Auditoria do Copilot, trilha 6 / LATER.)
//
// Aqui: as decisões do Copilot (journal `decisoes`, contexto "copilot") viram
// frases curtas que o gerador recebe como "a loja COSTUMA…". Nunca como
// regra — regra é o que a loja ESCREVEU no perfil. E só o que se repete:
// um feedback isolado é um caso, não uma preferência.
//
// Puro.

export interface DecisaoObservada {
  campo: string;
  valorNovo: string;
  valorAnterior: string | null;
  metadados?: Readonly<Record<string, unknown>> | null;
}

/** Quantas vezes algo precisa se repetir para virar tendência. */
export const MINIMO_DE_REPETICOES = 2;
const MAXIMO_DE_FRASES = 5;

const PARADAS = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "com", "para", "por", "um", "uma", "no", "na", "kit", "par",
]);

function normalizar(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function maisFrequentes(valores: readonly string[], minimo: number, teto: number): { valor: string; vezes: number }[] {
  const contagem = new Map<string, number>();
  for (const v of valores) {
    const n = normalizar(v);
    if (!n) continue;
    contagem.set(n, (contagem.get(n) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .filter(([, vezes]) => vezes >= minimo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, teto)
    .map(([valor, vezes]) => ({ valor, vezes }));
}

/**
 * As tendências, em frases. Entram: feedbacks repetidos de imagem, slots de
 * imagem aprovados, tamanho médio dos títulos aprovados, palavras que se
 * repetem nos títulos aprovados.
 */
export function tendenciasObservadas(decisoes: readonly DecisaoObservada[]): string[] {
  const frases: string[] = [];

  // Feedback de imagem que se repete: "fundo branco" três vezes é preferência.
  const feedbacks = decisoes.filter((d) => d.campo === "imagem:feedback").map((d) => d.valorNovo);
  for (const f of maisFrequentes(feedbacks, MINIMO_DE_REPETICOES, 3)) {
    frases.push(`Nas imagens, a loja já pediu "${f.valor}" ${f.vezes} vezes — comece por aí.`);
  }

  // Slots aprovados: a loja aprova mais capa do que infográfico, por exemplo.
  const slots = decisoes.filter((d) => d.campo.startsWith("imagem:aprovada:")).map((d) => d.campo.slice("imagem:aprovada:".length));
  const slotTop = maisFrequentes(slots, MINIMO_DE_REPETICOES, 1)[0];
  if (slotTop) frases.push(`A loja já aprovou ${slotTop.vezes} imagens do tipo "${slotTop.valor}".`);

  // Títulos aprovados: tamanho e palavras recorrentes.
  const titulos = decisoes.filter((d) => d.campo === "tituloAnuncio").map((d) => d.valorNovo).filter(Boolean);
  if (titulos.length >= MINIMO_DE_REPETICOES) {
    const media = Math.round(titulos.reduce((t, x) => t + x.length, 0) / titulos.length);
    frases.push(`Os ${titulos.length} títulos que a loja aprovou têm em média ${media} caracteres.`);
    const palavras = titulos.flatMap((t) => normalizar(t).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !PARADAS.has(w)));
    const top = maisFrequentes(palavras, Math.max(MINIMO_DE_REPETICOES, Math.ceil(titulos.length / 2)), 4);
    if (top.length > 0) frases.push(`Palavras que se repetem nos títulos aprovados: ${top.map((p) => p.valor).join(", ")}.`);
  }

  // Descrições aprovadas: só a contagem — o texto é longo demais para virar frase.
  const descricoes = decisoes.filter((d) => d.campo === "descricaoAnuncio").length;
  if (descricoes >= MINIMO_DE_REPETICOES) frases.push(`A loja já aprovou ${descricoes} descrições propostas pelo assistente.`);

  return frases.slice(0, MAXIMO_DE_FRASES);
}

/** O bloco de prompt. Vazio sem tendência — e "sem tendência" não vira palpite. */
export function blocoDasTendencias(frases: readonly string[]): string[] {
  if (frases.length === 0) return [];
  return ["O QUE SE OBSERVOU NAS APROVAÇÕES DESTA LOJA (tendência, não regra — o perfil escrito manda):", ...frases.map((f) => `- ${f}`)];
}
