// Tabelas de medidas de calçado (numeração → comprimento do pé em cm).
//
// A medida é FACTUAL — a IA não deve inventar. Resolvemos por prioridade:
//   1) override do produto (Produto.tabelaMedidasOverride) — a exceção;
//   2) tabela da MARCA (TABELAS_MARCA) — o normal;
//   3) padrão BR (PADRAO_BR) — fallback enquanto a marca não foi cadastrada.
//
// Fonte: guias da Chinelaria Leilane Neves (05_Guias_de_Medidas). Havaianas e
// Modare = números oficiais do cliente; demais = referência (confirmar no
// modelo). Vizzano/Moleca/Actvitta ainda pendentes → caem no padrão BR.

/** Padrão BR: numeração → comprimento do pé (cm). Referência de fallback. */
export const PADRAO_BR: Record<string, number> = {
  // Infantil
  "21": 14.0, "22": 14.5, "23": 15.0, "24": 15.5, "25": 16.0,
  "26": 16.7, "27": 17.3, "28": 18.0, "29": 18.7, "30": 19.3,
  "31": 20.0, "32": 20.7, "33": 21.5,
  // Adulto (alinhado ao guia "Azaleia/Yvate/Padrão BR")
  "34": 22.5, "35": 23.0, "36": 23.5, "37": 24.0, "38": 25.0,
  "39": 26.0, "40": 26.7, "41": 27.3, "42": 28.0, "43": 28.7,
  "44": 29.3, "45": 30.0,
};

// ---- Tabelas por marca (números da Chinelaria) ----

const HAVAIANAS: Record<string, number> = {
  // Adulto (pares · +1,3 cm por par)
  "33/34": 21.9, "35/36": 23.2, "37/38": 24.5, "39/40": 25.8,
  "41/42": 27.1, "43/44": 28.4, "45/46": 29.7, "47/48": 31.0,
  // Infantil
  "21/22": 14.1, "23/24": 15.4, "25/26": 16.7, "27/28": 18.0,
  "29/30": 19.3, "31/32": 20.6,
};

const MODARE: Record<string, number> = {
  // Individual · +0,7 cm por número (grupo Beira Rio)
  "34": 22.3, "35": 23.0, "36": 23.7, "37": 24.4, "38": 25.1, "39": 25.8, "40": 26.5,
};

const GRENDENE: Record<string, number> = {
  // Ipanema / Grendha / Zaxy (pares · referência)
  "33/34": 22.0, "35/36": 23.5, "37/38": 25.0, "39/40": 26.5, "41/42": 27.5, "43/44": 29.0,
};

const MOLEKINHO: Record<string, number> = {
  // Infantil (pares · referência)
  "25/26": 16.0, "27/28": 17.5, "29/30": 18.8, "31/32": 20.0, "33/34": 22.0, "35/36": 23.3,
};

const AZALEIA_YVATE: Record<string, number> = {
  // Individual · referência (sem guia oficial)
  "34": 22.5, "35": 23.0, "36": 23.5, "37": 24.0, "38": 25.0, "39": 26.0, "40": 26.7,
};

const ACTVITTA: Record<string, number> = {
  // Individual · guia do cliente (comp. palmilha)
  "37": 24.6, "38": 25.3, "39": 25.9, "40": 26.6, "41": 27.3,
  "42": 27.9, "43": 28.6, "44": 29.3, "45": 29.9,
};

const MOLECA: Record<string, number> = {
  // Individual · guia do cliente (comp. palmilha)
  "34": 23.0, "35": 23.5, "36": 24.0, "37": 24.5, "38": 25.0, "39": 25.5, "40": 26.0,
};

const VIZZANO: Record<string, number> = {
  // Individual · guia do cliente
  "33": 22.0, "34": 22.5, "35": 23.3, "36": 24.0, "37": 24.7,
  "38": 25.3, "39": 26.0, "40": 26.6, "41": 27.3,
};

/** Marca (normalizada) → tabela. Vizzano/Moleca/Actvitta pendentes (padrão BR). */
export const TABELAS_MARCA: Record<string, Record<string, number>> = {
  havaianas: HAVAIANAS,
  modare: MODARE,
  "beira rio": MODARE, // mesmo grupo
  ipanema: GRENDENE,
  grendha: GRENDENE,
  grendene: GRENDENE,
  zaxy: GRENDENE,
  molekinho: MOLEKINHO,
  molekinha: MOLEKINHO,
  azaleia: AZALEIA_YVATE,
  yvate: AZALEIA_YVATE,
  actvitta: ACTVITTA,
  moleca: MOLECA,
  vizzano: VIZZANO,
};

/** Marcas com números oficiais do cliente (as demais são referência). */
const MARCAS_OFICIAIS = new Set([
  "havaianas",
  "modare",
  "beira rio",
  "actvitta",
  "moleca",
  "vizzano",
]);

export const COMO_MEDIR =
  "Como medir: descalço, pise numa folha A4 com o calcanhar na parede e marque a ponta do dedo maior; meça em cm. Meça os dois pés e use o MAIOR. Na dúvida entre dois números, escolha o MAIOR — deixe 0,5 a 1 cm de folga.";

/** Normaliza a marca para casar com as chaves de TABELAS_MARCA. */
function normalizarMarca(m: string): string {
  return m
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Primeiro número inteiro do rótulo de numeração (para ordenar). */
function primeiroNumero(s: string): number {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : 9999;
}

/** Renderiza a grade COMPLETA de uma tabela (numeração → cm), ordenada. */
function renderTabela(tab: Record<string, number>): string {
  const linhas = Object.entries(tab)
    .sort((a, b) => primeiroNumero(a[0]) - primeiroNumero(b[0]))
    .map(([k, v]) => `${k}\t${v.toFixed(1).replace(".", ",")} cm`);
  return ["Numeração\tComprimento do pé", ...linhas].join("\n");
}

/** Grade adulto de referência (padrão BR) para marcas ainda sem tabela. */
const PADRAO_REFERENCIA: Record<string, number> = Object.fromEntries(
  Object.entries(PADRAO_BR).filter(([k]) => {
    const n = Number(k);
    return n >= 33 && n <= 45;
  })
);

/** Parece grade de calçado? (evita montar tabela para não-calçado.) */
function ehCalcado(tamanhos: string[]): boolean {
  return tamanhos.some((t) => {
    const n = primeiroNumero(t);
    return n >= 15 && n <= 48;
  });
}

export interface ResultadoTabela {
  tabela: string;
  comoMedir: string;
  /** Veio de override ou de tabela de marca (dado confiável). */
  confiavel: boolean;
  /** Marca com números oficiais do cliente (não só referência). */
  oficial: boolean;
  fonte: "override" | "marca" | "padrao" | "vazio";
}

/**
 * Monta a tabela de medidas, na ordem de prioridade override → marca →
 * padrão BR. Mostra a grade COMPLETA da marca (não depende da numeração —
 * às vezes suja — das variações; ela costuma vir com "BR", faixas etc.).
 */
export function montarTabelaMedidas(opts: {
  marca?: string;
  tamanhos: string[];
  override?: string;
}): ResultadoTabela {
  const override = (opts.override ?? "").trim();
  if (override) {
    return { tabela: override, comoMedir: COMO_MEDIR, confiavel: true, oficial: true, fonte: "override" };
  }

  const marcaKey = normalizarMarca(opts.marca ?? "");
  const marcaTab = TABELAS_MARCA[marcaKey] ?? null;
  if (marcaTab) {
    return {
      tabela: renderTabela(marcaTab),
      comoMedir: COMO_MEDIR,
      confiavel: true,
      oficial: MARCAS_OFICIAIS.has(marcaKey),
      fonte: "marca",
    };
  }

  // Marca sem tabela ainda (ex.: Vizzano/Moleca/Actvitta): grade padrão BR.
  if (!ehCalcado(opts.tamanhos)) {
    return { tabela: "", comoMedir: COMO_MEDIR, confiavel: false, oficial: false, fonte: "vazio" };
  }
  return {
    tabela: renderTabela(PADRAO_REFERENCIA),
    comoMedir: COMO_MEDIR,
    confiavel: false,
    oficial: false,
    fonte: "padrao",
  };
}
