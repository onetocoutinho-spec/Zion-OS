// A estratégia de busca no catálogo — pura, e por isso provável.
//
// A REGRA QUE ATRAVESSA TUDO, e ela vem dos dados reais desta base:
//
//     busca exata NÃO significa identidade única
//
// Medido no banco em 2026-07-29: 117 SKUs duplicados, 112 EANs duplicados, 2
// modelos repetidos, e NENHUMA constraint UNIQUE. Um `sku = "01040533"` pode
// casar exatamente e devolver sete variantes.
//
// Por isso o desfecho de uma busca nunca é "o produto": é `encontrado` (um só),
// `ambiguo` (vários, e quem decide é a pessoa) ou `nada`. Pegar `results[0]`
// aqui reproduziria o incidente de matching que motivou esta regra inteira.
//
// A FORÇA DO IDENTIFICADOR decide a ORDEM da tentativa, não a confiança no
// resultado. SKU exato é um jeito melhor de PROCURAR que nome parecido — e
// continua não autorizando ação nenhuma sozinho.
//
// ONDE CADA COISA VIVE (confirmado no schema, não suposto):
//
//   referência (linguagem do lojista) -> produtos.modelo          73/73
//   SKU                              -> produto_variantes.sku    479/684
//   EAN/GTIN                         -> produto_variantes.ean     444/684
//   nome, marca                      -> produtos                  73/73
//
// Não existem colunas `referencia` nem `gtin` neste banco. Criá-las para
// satisfazer o vocabulário da conversa seria inventar schema.

/** Onde procurar. `auto` deixa a estratégia decidir a ordem. */
export type CampoDeBusca = "auto" | "nome" | "sku" | "referencia" | "ean";

/** Como o resultado foi achado — evidência, não confiança numérica. */
export type TipoDeCasamento =
  | "sku_exato"
  | "ean_exato"
  | "modelo_exato"
  | "modelo_e_marca"
  | "nome_e_marca"
  | "candidato_textual";

/** Uma tentativa concreta de busca, já mapeada para o schema real. */
export interface Tentativa {
  /** A coluna real. `modelo` é a referência; não existe coluna `referencia`. */
  coluna: "sku" | "ean" | "modelo" | "nome";
  /** Igualdade textual para identificador; contém para descoberta. */
  modo: "exato" | "contem";
  termo: string;
  casamento: TipoDeCasamento;
}

/**
 * O que uma linha do banco devolve — produto e variante SEPARADOS.
 *
 * Achatar os dois perderia a informação que a próxima vertical precisa: um
 * modelo é do produto e vale para a família; um SKU é da variante e vale para
 * uma unidade da grade.
 */
export interface LinhaEncontrada {
  produtoId: string;
  nome: string;
  marca: string | null;
  modelo: string | null;
  varianteId?: string | null;
  sku?: string | null;
  ean?: string | null;
  cor?: string | null;
  tamanho?: string | null;
}

export interface Achado extends LinhaEncontrada {
  /** PRODUTO quando a busca resolveu no pai; VARIANTE quando na grade. */
  tipo: "produto" | "variante";
  casamento: TipoDeCasamento;
}

export type ResultadoDaBusca =
  | { desfecho: "encontrado"; achado: Achado; total: 1 }
  | {
      desfecho: "ambiguo";
      /** Os candidatos, cortados em `LIMITE_DE_CANDIDATOS`. */
      candidatos: readonly Achado[];
      /** O total REAL, mesmo quando maior que a lista. */
      total: number;
      mensagem: string;
    }
  | { desfecho: "nada"; mensagem: string };

/**
 * Quantos candidatos atravessam.
 *
 * Oito é o que uma pessoa consegue ler e escolher. Um modelo com 84 variantes
 * devolve 8 e o TOTAL — mandar 84 objetos ao modelo estouraria contexto sem
 * ajudar ninguém a decidir.
 */
export const LIMITE_DE_CANDIDATOS = 8;

/** Só dígitos, para reconhecer FORMATO — nunca para converter. */
const SO_DIGITOS = /^\d+$/;

/**
 * Parece um EAN?
 *
 * FORMATO, não identidade: 13 dígitos significam "vale tentar buscar por EAN",
 * jamais "este produto tem este EAN". A busca que falhar simplesmente não
 * encontra, e é isso.
 */
export function pareceEan(termo: string): boolean {
  const t = termo.trim();
  return SO_DIGITOS.test(t) && (t.length === 13 || t.length === 12 || t.length === 8);
}

/**
 * Parece uma referência de modelo?
 *
 * Nesta base o modelo tem a forma `22591.408` — dígitos com um ponto. Nome de
 * produto e marca não têm essa forma, então ela é um sinal barato e específico.
 */
export function pareceModelo(termo: string): boolean {
  return /^\d{3,6}[.\-/]\d{1,4}$/.test(termo.trim());
}

/**
 * As tentativas, na ordem em que devem ser feitas.
 *
 * A ordem é por FORÇA DE BUSCA. Ela decide o que tentar primeiro, e não o
 * quanto confiar no que vier: um `sku_exato` com sete resultados continua
 * ambíguo.
 *
 * O termo NUNCA é convertido. `"01040533"` viaja como texto por todo o
 * caminho — nesta base 473 SKUs começam com zero, e `Number("01040533")`
 * viraria `1040533`, que não existe.
 */
export function tentativasPara(termo: string, campo: CampoDeBusca): Tentativa[] {
  const t = termo.trim();
  if (!t) return [];

  if (campo === "sku") return [{ coluna: "sku", modo: "exato", termo: t, casamento: "sku_exato" }];
  if (campo === "ean") return [{ coluna: "ean", modo: "exato", termo: t, casamento: "ean_exato" }];
  if (campo === "referencia") {
    return [{ coluna: "modelo", modo: "exato", termo: t, casamento: "modelo_exato" }];
  }
  if (campo === "nome") {
    return [{ coluna: "nome", modo: "contem", termo: t, casamento: "candidato_textual" }];
  }

  // ---- auto ----
  const tentativas: Tentativa[] = [];
  if (pareceEan(t)) {
    tentativas.push({ coluna: "ean", modo: "exato", termo: t, casamento: "ean_exato" });
  }
  if (pareceModelo(t)) {
    tentativas.push({ coluna: "modelo", modo: "exato", termo: t, casamento: "modelo_exato" });
  }
  // SKU exato para qualquer termo sem espaço: o SKU desta base é alfanumérico
  // com zeros, e não há como distingui-lo de outros códigos pelo formato.
  if (!/\s/.test(t)) {
    tentativas.push({ coluna: "sku", modo: "exato", termo: t, casamento: "sku_exato" });
    // Modelo por igualdade também: "7178.102" já entrou acima, mas códigos sem
    // ponto podem ser modelo nesta base.
    if (!pareceModelo(t)) {
      tentativas.push({ coluna: "modelo", modo: "exato", termo: t, casamento: "modelo_exato" });
    }
  }
  // Descoberta, sempre por último: é a mais fraca e a que nunca identifica.
  tentativas.push({ coluna: "nome", modo: "contem", termo: t, casamento: "candidato_textual" });
  return tentativas;
}

/** Uma linha vira `Achado`, com o tipo derivado de ONDE o casamento ocorreu. */
export function comoAchado(linha: LinhaEncontrada, casamento: TipoDeCasamento): Achado {
  // SKU e EAN vivem na VARIANTE; modelo e nome, no produto. O tipo sai daí, não
  // de um palpite sobre a linha.
  const naVariante = casamento === "sku_exato" || casamento === "ean_exato";
  return {
    ...linha,
    tipo: naVariante && linha.varianteId ? "variante" : "produto",
    casamento,
  };
}

/**
 * O desfecho, a partir do que o banco devolveu.
 *
 * UM resultado -> `encontrado`. VÁRIOS -> `ambiguo`, sempre. Nunca o primeiro.
 * Isto é o coração da vertical: com 117 SKUs duplicados nesta base, escolher
 * sozinho é escolher errado uma vez em cada tantas.
 */
export function classificar(
  linhas: readonly LinhaEncontrada[],
  casamento: TipoDeCasamento,
  termo: string
): ResultadoDaBusca {
  if (linhas.length === 0) {
    return {
      desfecho: "nada",
      mensagem: `Não encontrei nada com "${termo}" no seu catálogo.`,
    };
  }
  if (linhas.length === 1) {
    return { desfecho: "encontrado", achado: comoAchado(linhas[0], casamento), total: 1 };
  }
  return {
    desfecho: "ambiguo",
    candidatos: linhas.slice(0, LIMITE_DE_CANDIDATOS).map((l) => comoAchado(l, casamento)),
    total: linhas.length,
    mensagem:
      `Encontrei ${linhas.length} resultados para "${termo}". ` +
      "Diga qual você quer — eu não escolho por você.",
  };
}

/**
 * O que o modelo recebe. Compacto e sem metadata técnica.
 *
 * `casamento` atravessa porque é o que distingue "achei por SKU exato" de
 * "esse é um candidato textual" — e essa distinção é o que impede o modelo de
 * tratar semelhança como identidade.
 */
export function paraOModelo(r: ResultadoDaBusca): unknown {
  if (r.desfecho === "nada") return { desfecho: "nada", mensagem: r.mensagem };
  if (r.desfecho === "encontrado") {
    return { desfecho: "encontrado", achado: enxuto(r.achado) };
  }
  return {
    desfecho: "ambiguo",
    total: r.total,
    mostrando: r.candidatos.length,
    mensagem: r.mensagem,
    candidatos: r.candidatos.map(enxuto),
    aviso: "Mais de um resultado. PERGUNTE ao lojista qual, sem escolher.",
  };
}

function enxuto(a: Achado) {
  return {
    produtoId: a.produtoId,
    ...(a.varianteId ? { varianteId: a.varianteId } : {}),
    tipo: a.tipo,
    nome: a.nome,
    ...(a.marca ? { marca: a.marca } : {}),
    ...(a.modelo ? { referencia: a.modelo } : {}),
    ...(a.sku ? { sku: a.sku } : {}),
    ...(a.ean ? { ean: a.ean } : {}),
    ...(a.cor ? { cor: a.cor } : {}),
    ...(a.tamanho ? { tamanho: a.tamanho } : {}),
    casamento: a.casamento,
  };
}
