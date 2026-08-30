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

//
// E ACIMA DE TODAS, desde 28/08/2026, a tabela que a LOJISTA mantém em
// `/cliente/medidas` — ver `comAsDaLoja`. Esta lista é o que o software sabe;
// a dela é o que a loja sabe, e a loja é quem vende o sapato.

import { normalizarTamanho } from "../../publication/domain/normalizarTamanho";

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

/** Linha de tabela do cliente (rótulo → valor livre). */
export interface LinhaMedidaLite {
  rotulo: string;
  valor: string;
}

/** Tabela vinda do cliente (banco). */
export interface TabelaClienteLite {
  marca?: string;
  comoMedir?: string;
  linhas: LinhaMedidaLite[];
}

/** Renderiza as linhas de uma tabela do cliente (genérica: calçado, roupa…). */
function renderLinhas(linhas: LinhaMedidaLite[]): string {
  const corpo = linhas
    .filter((l) => l.rotulo || l.valor)
    .map((l) => `${l.rotulo}\t${l.valor}`);
  return ["Tamanho\tMedida", ...corpo].join("\n");
}

function numeroParaLinha(cm: number): string {
  return `${cm.toFixed(1).replace(".", ",")} cm`;
}

/** Converte uma tabela hardcoded (número → cm) em linhas rótulo/valor. */
function linhasDe(tab: Record<string, number>): LinhaMedidaLite[] {
  return Object.entries(tab)
    .sort((a, b) => primeiroNumero(a[0]) - primeiroNumero(b[0]))
    .map(([rotulo, cm]) => ({ rotulo, valor: numeroParaLinha(cm) }));
}

/** Nome de exibição por chave de marca. */
const NOMES_MARCA: Record<string, string> = {
  havaianas: "Havaianas",
  modare: "Modare",
  "beira rio": "Beira Rio",
  ipanema: "Ipanema",
  grendha: "Grendha",
  grendene: "Grendene",
  zaxy: "Zaxy",
  molekinho: "Molekinho",
  molekinha: "Molekinha",
  azaleia: "Azaleia",
  yvate: "Yvate",
  actvitta: "Actvitta",
  moleca: "Moleca",
  vizzano: "Vizzano",
};

/**
 * Modelos prontos (uma tabela por marca) que o cliente pode importar para a
 * própria conta e depois editar. É o "seed" editável do que hoje é hardcoded.
 */
export const MODELOS_PADRAO: {
  nome: string;
  marca: string;
  comoMedir: string;
  linhas: LinhaMedidaLite[];
}[] = Object.entries(TABELAS_MARCA).map(([chave, tab]) => ({
  nome: NOMES_MARCA[chave] ?? chave,
  marca: NOMES_MARCA[chave] ?? chave,
  comoMedir: COMO_MEDIR,
  linhas: linhasDe(tab),
}));

/**
 * Grade de referência (padrão BR) para marcas ainda sem tabela — INTEIRA.
 *
 * ===========================================================================
 * O CORTE EM 33 SAIU EM 28/08/2026
 * ===========================================================================
 *
 * Era `n >= 33 && n <= 45` — a metade ADULTA do `PADRAO_BR`, sem razão escrita.
 * O efeito, medido no catálogo do percurso T1: produto INFANTIL de marca que
 * este arquivo não conhece (Cartago, Olympikus, Zaxynina, Klin, Rider, Pegada,
 * Under Armour, Grendene Kids) caía na grade adulta, não achava a numeração 19
 * a 32, e a publicação era recusada por "nenhuma variação com tamanho
 * publicável".
 *
 * Recusar ali não protegia ninguém: a fonte da resposta é a MESMA — `PADRAO_BR`,
 * dos guias da Chinelaria — e ela cobre 21 a 45. Usar metade dela para marca
 * desconhecida e chamar a outra metade de desconhecida era arbitrário.
 *
 * O que NÃO mudou, e é o cuidado que importa: marca CONHECIDA continua usando a
 * tabela dela, inteira e sozinha. Completar a grade de uma marca com a
 * referência genérica é misturar grades — e a diferença entre a Modare (22,3 em
 * 34) e o padrão (22,5) é o milímetro que este módulo se recusa a inventar.
 */
const PADRAO_REFERENCIA: Record<string, number> = { ...PADRAO_BR };

/**
 * Mapa ESTRUTURADO numeração → comprimento do pé (cm) de uma marca — a
 * contraparte de `montarTabelaMedidas` (que devolve Markdown). Usado pela
 * publicação User Products para montar a guia de tamanhos do ML (FOOT_LENGTH).
 * Marca conhecida → tabela da marca; caso contrário → grade de referência BR.
 * As chaves seguem o formato canônico do `normalizarTamanho` (pares "33/34"
 * ou individuais "38"), então o join com as variações é direto.
 */
export function medidasDaMarca(
  marca: string,
  /**
   * As tabelas que A LOJISTA mantém em `/cliente/medidas`. Ver `comAsDaLoja`.
   */
  daLoja: readonly TabelaDaLoja[] = []
): Record<string, number> {
  const key = normalizarMarca(marca ?? "");
  return comAsDaLoja(TABELAS_MARCA[key] ?? PADRAO_REFERENCIA, marca, daLoja);
}

/** Uma tabela como o cadastro dela guarda: rótulo do tamanho + "24,5 cm". */
export interface TabelaDaLoja {
  marca: string;
  linhas: readonly { rotulo: string; valor: string }[];
}

/**
 * A TABELA DA LOJISTA COMPLETA A NOSSA — medido em 28/08/2026.
 *
 * ===========================================================================
 * O QUE ESTAVA ACONTECENDO
 * ===========================================================================
 *
 * `medidasDaMarca` lia só `TABELAS_MARCA`, a lista embutida aqui. A lojista tem
 * um editor de tabelas em `/cliente/medidas`, tem 14 tabelas gravadas em
 * `tabelas_medidas`, e NENHUMA delas chegava à publicação: elas alimentavam o
 * briefing dos agentes e mais nada.
 *
 * O efeito, nos 674 anúncios de calçado publicáveis desta base: 30 recusados
 * por "nenhuma variação com tamanho publicável + medida da marca" — todos por
 * tamanho FORA da faixa da tabela embutida.
 *
 *     Molekinho  19 a 24   a tabela embutida começa em 25/26  (bebê)
 *     Ipanema    25 e 26   começa em 33/34                    (infantil)
 *     Yvate      41 a 43   termina em 40
 *     Beira Rio  41        termina em 40
 *     Modare     33        começa em 34
 *
 * Nenhuma dessas medidas está no software, e NÃO É PARA ESTAR: centímetro de
 * calçado é o que a compradora usa para decidir o pé, e inventar aqui é a
 * mesma falta que `medidaDoTamanho` recusa quando escolhe entre 35 e 36.
 *
 * O que dá para fazer — e é o que faltava — é deixar a resposta dela chegar. Com
 * isto, a lojista abre a tabela da Molekinho, acrescenta 19 a 24, e publica. Sem
 * isto, ela edita a tabela, salva, e nada muda: a parede não tem maçaneta.
 *
 * ===========================================================================
 * COMPLETA, NÃO SUBSTITUI
 * ===========================================================================
 *
 * A dela entra por cima da nossa, rótulo a rótulo — acrescenta o que falta e
 * corrige o que ela discorda. Substituir apagaria os tamanhos que ela não
 * repetiu na dela, e sumir com tamanho publicável não é o que alguém quer ao
 * editar uma tabela.
 *
 * Rótulo ilegível ou valor sem número é IGNORADO, não vira zero: zero seria um
 * pé de 0 cm no anúncio.
 */
export function comAsDaLoja(
  base: Record<string, number>,
  marca: string,
  daLoja: readonly TabelaDaLoja[]
): Record<string, number> {
  const key = normalizarMarca(marca ?? "");
  if (!key || daLoja.length === 0) return base;

  const juntas = { ...base };
  // A PRIMEIRA RESPOSTA DELA VENCE, e o desempate precisa ser dito.
  //
  // `TabelaMedida.marca` e livre e o editor permite varias tabelas da mesma
  // marca. Sobrescrevendo, quem vencia era a ULTIMA — e a ordem vem do banco,
  // sem `order by`: o anuncio publicaria um comprimento hoje e outro amanha sem
  // ninguem ter editado nada. `fichaDoCadastro` decidiu o mesmo para o mesmo
  // tipo de dado; duas politicas para uma pergunta so e como as duas divergem.
  const postos = new Set();
  let mudou = false;
  for (const t of daLoja) {
    if (normalizarMarca(t.marca ?? "") !== key) continue;
    for (const l of t.linhas ?? []) {
      const rotulo = normalizarTamanho(l.rotulo);
      if (!rotulo.ok || postos.has(rotulo.valor)) continue;
      const cm = cmDaLinha(l.valor);
      if (cm === undefined) continue;
      juntas[rotulo.valor] = cm;
      postos.add(rotulo.valor);
      mudou = true;
    }
  }
  return mudou ? juntas : base;
}

/**
 * A faixa em que um comprimento de pe humano cabe, em centimetros.
 *
 * O menor calcado infantil brasileiro fica perto de 9 cm; o maior adulto, perto
 * de 33. Os limites sao largos de proposito: recusar uma medida legitima seria
 * travar publicacao, e este modulo existe para nao fazer isso.
 */
const CM_MINIMO = 5;
const CM_MAXIMO = 40;

/**
 * "24,5 cm" → 24.5. `undefined` fora da faixa de um pe — e nunca zero.
 *
 * O EDITOR DELA E TEXTO LIVRE ("uma por linha, no formato rotulo = valor") e a
 * importacao de planilha ADIVINHA a coluna do valor. Uma linha colada como
 * `34 = 34 - 22,3 cm`, ou uma planilha cuja coluna escolhida e a da numeracao,
 * faz o primeiro numero ser 34 — e 34 cm iria para a guia de tamanhos do ML
 * como comprimento do pe. `0,223 m` viraria 0,223 cm.
 *
 * Este e o modulo que se recusa a escolher entre 35 e 36 porque isso "inventa
 * 0,7 cm". Aceitar 34 cm calado e a mesma falta, uma ordem de grandeza maior.
 *
 * Fora da faixa, a linha e IGNORADA e o tamanho continua sem medida — entao a
 * recusa do bundle nomeia o rotulo e ela ve qual linha corrigir. Silencio aqui
 * seria pior que a recusa la.
 */
function cmDaLinha(valor: string | undefined | null): number | undefined {
  const m = /(\d+(?:[.,]\d+)?)/.exec(String(valor ?? ""));
  if (!m) return undefined;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) && n >= CM_MINIMO && n <= CM_MAXIMO ? n : undefined;
}

/**
 * A medida (cm) de um tamanho na tabela da marca — aceitando o número DENTRO
 * do par.
 *
 * ===========================================================================
 * O CASO QUE ORIGINOU (DES-004)
 * ===========================================================================
 *
 * Um anúncio Zaxy aprovado não publicava. A tabela da Zaxy é do grupo Grendene
 * e numera em PARES — `33/34`, `35/36`, `37/38`. O cadastro da lojista diz
 * `37`. `tabela["37"]` é `undefined`, a variação era pulada, `variacoes` ficava
 * vazio e a rota respondia 422.
 *
 * E ELA ESTAVA CERTA EM RECUSAR o que fazia antes. O que faltava não era
 * afrouxar: era ler o par.
 *
 * ===========================================================================
 * A ASSIMETRIA É O CORAÇÃO DISTO
 * ===========================================================================
 *
 * Número dentro de par → LÊ. `37/38` CONTÉM o 37, e a medida do par é a medida
 * daquele sapato. Isso é leitura, não palpite.
 *
 * Par contra tabela individual → RECUSA. Se o cadastro diz `35/36` e a tabela
 * tem `35 = 23,0` e `36 = 23,7`, escolher qualquer um inventa 0,7 cm no que a
 * compradora usa para decidir o pé.
 *
 * E NADA de aproximação: sem vizinho mais próximo, sem interpolação. Se a
 * tabela da Modare começa no 34, o 33 continua sem medida — porque a marca não
 * publica um 33. Aproximar seria pôr na guia um número que ninguém mediu.
 */
export function medidaDoTamanho(
  tabela: Record<string, number>,
  token: string
): number | undefined {
  const t = (token ?? "").trim();
  if (!t) return undefined;

  // 1) chave exata sempre vence — inclusive quando o cadastro já traz o par.
  const exato = tabela[t];
  if (exato !== undefined) return exato;

  // 2) o token é um inteiro? só então vale procurar dentro dos pares.
  if (!/^\d+$/.test(t)) return undefined;

  // 3) varre os pares `A/B` da tabela. Se o token for A ou B, a medida do par
  //    é a dele. Um par que aparecer duas vezes contendo o mesmo número seria
  //    tabela inconsistente — o primeiro em ordem de chave vence, e a ordem é
  //    estável porque as chaves são ordenadas antes de varrer.
  for (const chave of Object.keys(tabela).sort()) {
    const partes = chave.split("/");
    if (partes.length !== 2) continue;
    if (partes[0].trim() === t || partes[1].trim() === t) return tabela[chave];
  }
  return undefined;
}

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
  /** Tabelas cadastradas pelo cliente (têm prioridade sobre as hardcoded). */
  tabelasCliente?: TabelaClienteLite[];
}): ResultadoTabela {
  const override = (opts.override ?? "").trim();
  if (override) {
    return { tabela: override, comoMedir: COMO_MEDIR, confiavel: true, oficial: true, fonte: "override" };
  }

  const marcaKey = normalizarMarca(opts.marca ?? "");

  // 1) Tabela do próprio cliente, casada pela marca.
  const doCliente =
    marcaKey !== ""
      ? (opts.tabelasCliente ?? []).find(
          (t) => t.linhas.length > 0 && t.marca && normalizarMarca(t.marca) === marcaKey
        )
      : undefined;
  if (doCliente) {
    return {
      tabela: renderLinhas(doCliente.linhas),
      comoMedir: (doCliente.comoMedir ?? "").trim() || COMO_MEDIR,
      confiavel: true,
      oficial: true,
      fonte: "marca",
    };
  }

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
    // `COMO_MEDIR` fala em pisar numa folha A4 e medir o pé descalço. Sair daqui
    // com esse texto era mandar instrução de calçado para um produto que a
    // linha de cima acabou de concluir que NÃO é calçado — e o caso vazio é
    // justamente onde cai um móvel. Tabela vazia e instrução vazia dizem a
    // mesma coisa, que é "não sei medir isto"; a instrução de pé dizia outra.
    return { tabela: "", comoMedir: "", confiavel: false, oficial: false, fonte: "vazio" };
  }
  return {
    tabela: renderTabela(PADRAO_REFERENCIA),
    comoMedir: COMO_MEDIR,
    confiavel: false,
    oficial: false,
    fonte: "padrao",
  };
}
