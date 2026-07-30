// Os fatos de um cadastro em conversa — e de onde cada um veio.
//
// A distinção que este módulo existe para manter:
//
//     INFORMADO pelo lojista  ≠  INFERIDO pela IA
//
// Se ele disse "custo R$ 47,80", isso é informado. Se o modelo concluiu
// "material sintético" olhando o nome, isso é inferido — e inferência não pode
// virar dado cadastral. Esta base já tem a cicatriz disso: a esteira gerava SKU
// e cor plausíveis e falsos, e a importação escreveu R$ 30 milhões de custo a
// partir de campo que era referência de modelo.
//
// Campos CRÍTICOS não aceitam inferência nem com confiança alta. Custo, SKU,
// EAN e peso ou vêm de quem sabe, ou ficam vazios — e vazio é uma resposta
// honesta que a próxima pergunta resolve.

/** De onde o valor veio. Ordem de confiança decrescente. */
export type Procedencia =
  /** O lojista disse, nesta conversa. */
  | "informado"
  /** Lido de um registro que já existia no catálogo. */
  | "catalogo"
  /** Derivado deterministicamente de outro fato (não é opinião). */
  | "derivado"
  /** Sugerido pela IA. NUNCA vale para campo crítico. */
  | "inferido";

export interface Fato<T = string> {
  valor: T;
  procedencia: Procedencia;
}

/**
 * Os campos que NÃO aceitam inferência.
 *
 * Dinheiro, identificadores e peso. Cada um deles, errado, produz um estrago
 * que não se descobre olhando a tela: preço abaixo do custo, produto trocado,
 * frete que não fecha.
 */
export const CAMPOS_CRITICOS = ["custo", "precoVenda", "sku", "ean", "pesoGramas"] as const;
export type CampoCritico = (typeof CAMPOS_CRITICOS)[number];

export function ehCritico(campo: string): campo is CampoCritico {
  return (CAMPOS_CRITICOS as readonly string[]).includes(campo);
}

/**
 * Aceita um fato — ou recusa, dizendo por quê.
 *
 * A recusa é o comportamento útil: ela devolve o campo para a fila de
 * perguntas em vez de deixar um valor inventado ocupando o lugar.
 */
export type Aceite<T> = { aceito: true; fato: Fato<T> } | { aceito: false; motivo: string };

export function aceitarFato<T>(
  campo: string,
  valor: T,
  procedencia: Procedencia
): Aceite<T> {
  if (valor === null || valor === undefined || valor === "") {
    return { aceito: false, motivo: "Valor vazio." };
  }
  if (procedencia === "inferido" && ehCritico(campo)) {
    return {
      aceito: false,
      motivo: `${campo} é dado sensível: preciso que você me diga, não posso deduzir.`,
    };
  }
  return { aceito: true, fato: { valor, procedencia } };
}

// ---------- dinheiro ----------

/**
 * Lê dinheiro em pt-BR. Devolve CENTAVOS INTEIROS.
 *
 * Centavos e não float: `0.1 + 0.2` não é `0.3` em binário, e custo é a base de
 * lucro, margem e piso. A conversão para reais acontece na borda, uma vez.
 *
 * As duas armadilhas que este parser existe para evitar, e as duas já
 * aconteceram em projetos assim:
 *
 *   "47,80"    lido como 4780      → cem vezes o custo
 *   "1.249,90" lido como 1.24990   → mil vezes menor
 *
 * A regra: a VÍRGULA é o decimal; o PONTO é separador de milhar — que é como se
 * escreve dinheiro no Brasil. Quando só há ponto, ele é tratado como decimal
 * apenas se sobrarem exatamente dois dígitos depois dele ("47.80"), porque essa
 * é a forma que teclado e planilha produzem.
 */
export function lerDinheiroEmCentavos(bruto: string): number | null {
  const limpo = bruto.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!limpo) return null;
  if (!/^\d[\d.,]*$/.test(limpo)) return null;

  let normalizado: string;
  if (limpo.includes(",")) {
    // Vírgula presente: ela é o decimal, e todo ponto é milhar.
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+\.\d{2}$/.test(limpo)) {
    // Só ponto, com exatamente dois dígitos depois: decimal de teclado.
    normalizado = limpo;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    // Só ponto, em grupos de três: milhar. "1.249" é mil duzentos e quarenta e
    // nove, não um vírgula duzentos e quarenta e nove.
    normalizado = limpo.replace(/\./g, "");
  } else if (limpo.includes(".")) {
    // AMBÍGUO, e dinheiro ambíguo não se adivinha. "1.2" pode ser R$ 1,20 ou
    // R$ 12,00 — a diferença é dez vezes, e nenhuma das duas leituras tem
    // evidência a favor. `null` devolve o campo para a fila de perguntas, que é
    // o mesmo princípio de "onde falta dado, o resultado é null".
    return null;
  } else {
    normalizado = limpo;
  }

  const n = Number(normalizado);
  if (!Number.isFinite(n) || n < 0) return null;
  // Arredonda no centavo: `47.80 * 100` dá 4779.999... em ponto flutuante.
  return Math.round(n * 100);
}

/** Centavos de volta para reais, na borda. */
export function centavosParaReais(centavos: number): number {
  return Math.round(centavos) / 100;
}

/** Como o valor aparece para quem confirma. */
export function escreverDinheiro(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}

// ---------- identificadores ----------

/**
 * Lê um identificador — SKU ou EAN.
 *
 * TEXTO, sempre. Nesta base 473 SKUs começam com zero, e `Number("01040533")`
 * viraria `1040533`, que não existe. A única normalização é tirar espaço das
 * pontas: qualquer outra pode mudar a identidade do que se está apontando.
 */
export function lerIdentificador(bruto: string): string | null {
  const t = bruto.trim();
  return t.length > 0 ? t : null;
}
