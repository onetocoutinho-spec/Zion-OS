// Tabelas de medidas de calçado (numeração → comprimento do pé em cm).
//
// A medida é FACTUAL — a IA não deve inventar. Resolvemos assim, por ordem de
// prioridade:
//   1) override do produto (Produto.tabelaMedidasOverride) — a exceção;
//   2) tabela da MARCA (TABELAS_MARCA) — o normal;
//   3) padrão BR (PADRAO_BR) — fallback enquanto a marca não foi cadastrada.
//
// ⚠️ Os números de PADRAO_BR são uma REFERÊNCIA aproximada do mercado BR
// (cada numeração ≈ +0,67 cm). Substitua/complemente com as tabelas REAIS dos
// fornecedores em TABELAS_MARCA para ter precisão por marca.

/** Padrão BR: numeração → comprimento do pé (cm). Ponto de partida. */
export const PADRAO_BR: Record<string, number> = {
  // Infantil
  "16": 10.7, "17": 11.3, "18": 12.0, "19": 12.7, "20": 13.3,
  "21": 14.0, "22": 14.7, "23": 15.3, "24": 16.0, "25": 16.7,
  "26": 17.3, "27": 18.0, "28": 18.7, "29": 19.3, "30": 20.0,
  "31": 20.7, "32": 21.3,
  // Adulto
  "33": 22.0, "34": 22.7, "35": 23.3, "36": 24.0, "37": 24.7,
  "38": 25.3, "39": 26.0, "40": 26.7, "41": 27.3, "42": 28.0,
  "43": 28.7, "44": 29.3, "45": 30.0,
};

/**
 * Tabelas reais por marca (chave = marca normalizada). Preencher com os dados
 * dos fornecedores. Aceita qualquer chave de numeração que apareça nas
 * variações (inclusive pareada, ex.: "37/38").
 *
 * Exemplo de formato (valores ilustrativos — troque pelos reais):
 *   havaianas: { "37/38": 25.0, "39/40": 26.3, "41/42": 27.6, "43/44": 28.9 },
 */
export const TABELAS_MARCA: Record<string, Record<string, number>> = {
  // preencher conforme as tabelas dos fornecedores
};

export const COMO_MEDIR =
  "Como medir: descalço, pise sobre uma folha em pé e marque do calcanhar até a ponta do dedo maior. Meça em cm e compare com a tabela — na dúvida entre dois números, escolha o maior.";

/** Normaliza a marca para casar com as chaves de TABELAS_MARCA. */
function normalizarMarca(m: string): string {
  return m
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Ordena numerações de forma amigável (numérica quando possível). */
function ordenarTamanhos(ts: string[]): string[] {
  return [...new Set(ts.map((t) => t.trim()).filter(Boolean))].sort((a, b) => {
    const na = parseFloat(a.replace(",", "."));
    const nb = parseFloat(b.replace(",", "."));
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

export interface ResultadoTabela {
  tabela: string;
  comoMedir: string;
  /** true se veio de override ou de tabela de marca (dado confiável). */
  confiavel: boolean;
  fonte: "override" | "marca" | "padrao" | "vazio";
}

/**
 * Monta a tabela de medidas para os tamanhos informados, na ordem de
 * prioridade override → marca → padrão BR.
 */
export function montarTabelaMedidas(opts: {
  marca?: string;
  tamanhos: string[];
  override?: string;
}): ResultadoTabela {
  const override = (opts.override ?? "").trim();
  if (override) {
    return { tabela: override, comoMedir: COMO_MEDIR, confiavel: true, fonte: "override" };
  }

  const tamanhos = ordenarTamanhos(opts.tamanhos);
  if (tamanhos.length === 0) {
    return { tabela: "", comoMedir: COMO_MEDIR, confiavel: false, fonte: "vazio" };
  }

  const marcaTab = TABELAS_MARCA[normalizarMarca(opts.marca ?? "")] ?? null;
  const fonte: "marca" | "padrao" = marcaTab ? "marca" : "padrao";

  const linhas = tamanhos.map((t) => {
    const cm = (marcaTab && marcaTab[t] != null ? marcaTab[t] : PADRAO_BR[t]) ?? null;
    const val = cm != null ? `${cm.toFixed(1).replace(".", ",")} cm` : "—";
    return `${t}\t${val}`;
  });

  const tabela = ["Numeração\tComprimento do pé", ...linhas].join("\n");
  return { tabela, comoMedir: COMO_MEDIR, confiavel: fonte === "marca", fonte };
}
