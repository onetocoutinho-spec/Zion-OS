// O que cada coluna da planilha significa — puro, sem rede, sem React.
//
// POR QUE ESTE MÓDULO EXISTE
//
// A importação de custos detectava as colunas sozinha e gravava direto. Numa
// planilha real de lojista isso escreveu 87 custos que não eram custos: eram as
// REFERÊNCIAS de modelo. Um chinelo ficou com R$ 30.277.872,00 de custo, com
// selo de "confiança alta". A planilha tinha linhas com as colunas deslocadas —
// o que caiu embaixo de CUSTO foi a coluna REFERENCIA — e nada no caminho
// perguntou nada a ninguém.
//
// Detectar melhor não resolve. Cada cliente traz a planilha do ERP dele, com
// nomes de coluna, ordem e defeitos próprios; qualquer regra nova acerta a
// planilha de hoje e erra a de amanhã, do mesmo jeito silencioso.
//
// O que resolve é a ordem das coisas: **mostrar o que se entendeu, e só gravar
// depois que alguém confirmar**. A detecção vira SUGESTÃO, e a sugestão errada
// custa um clique em vez de um estrago.
//
// Este módulo produz três coisas, todas puras:
//   1. a sugestão de papel para cada coluna;
//   2. a prévia — as primeiras linhas como o sistema as leria;
//   3. os sinais de alerta, que é onde a planilha deslocada se denuncia.

/** O que uma coluna representa. "ignorar" é resposta legítima. */
export type PapelColuna = "sku" | "ean" | "nome" | "custo" | "precoVenda" | "ignorar";

export const PAPEIS: readonly PapelColuna[] = ["sku", "ean", "nome", "custo", "precoVenda", "ignorar"];

export const NOME_DO_PAPEL: Record<PapelColuna, string> = {
  sku: "SKU / código",
  ean: "EAN / código de barras",
  nome: "Nome do produto",
  custo: "Custo",
  precoVenda: "Preço de venda",
  ignorar: "Ignorar",
};

/** Cabeçalho original → papel. Colunas ausentes do mapa são ignoradas. */
export type Mapeamento = Record<string, PapelColuna>;

/**
 * Tira o parêntese do FIM do cabeçalho, quando sobra nome depois.
 *
 * "CMV (R$)" e "Preço atual (R$)" são as duas colunas de dinheiro da planilha
 * real de 31/07/2026, e nenhuma das duas casava: normalizadas viravam `cmv_r` e
 * `preco_atual_r`, e nenhuma regra reconhece isso. O parêntese final de um
 * cabeçalho é UNIDADE ou anotação — "(R$)", "(kg)", "(un)" — não é o nome da
 * coluna. Quem escreve planilha põe ali a unidade, não a identidade.
 *
 * Só do fim, e só quando sobra alguma coisa: "(R$)" sozinha continua "(R$)" e
 * segue para "ignorar", em vez de virar coluna sem nome.
 *
 * NÃO afeta a importação de PESO, que tem normalizador próprio em
 * `./importacaoPeso` — e é lá que mora a recusa de "coluna de peso sem unidade
 * no cabeçalho". Se as duas dividissem esta função, tirar o "(kg)" apagaria
 * exatamente a informação que aquela recusa existe para exigir.
 */
function semUnidadeNoFim(h: string): string {
  const cortado = h.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return cortado === "" ? h : cortado;
}

function normalizar(h: string): string {
  const semAcento = semUnidadeNoFim(h)
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join("");
  return semAcento.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const REGRAS: readonly { papel: Exclude<PapelColuna, "ignorar">; testa: (n: string) => boolean }[] = [
  // Preço ANTES de custo: "preco_de_custo" cairia em "preco" se a ordem fosse
  // outra, e um preço de venda lido como custo inverte a margem inteira.
  // `cmv` é Custo da Mercadoria Vendida, e é como o contador e o ERP dela
  // escrevem custo. Não é sigla ambígua no varejo brasileiro — e sem ela a
  // planilha de reprecificação de 31/07/2026 lia zero colunas de dinheiro.
  { papel: "custo", testa: (n) => n.startsWith("custo") || ["cmv", "cost", "preco_custo", "preco_de_custo", "valor_custo", "custounit"].includes(n) },
  { papel: "precoVenda", testa: (n) => n.startsWith("preco_de_venda") || ["preco", "preco_venda", "valor_venda", "venda", "preco_atual"].includes(n) },
  { papel: "ean", testa: (n) => ["ean", "gtin", "ean13", "barcode"].includes(n) || n.startsWith("codigo_barras") || n.startsWith("cod_barras") },
  { papel: "sku", testa: (n) => n === "sku" || n.startsWith("sku") || ["codigo", "cod", "seller_sku", "codigo_sku", "cod_erp", "codigo_erp", "sku_erp", "referencia"].includes(n) },
  { papel: "nome", testa: (n) => ["nome", "produto", "descricao", "titulo", "item"].includes(n) || n.startsWith("nome") || n.startsWith("produto") || n.startsWith("descricao") },
];

/**
 * A sugestão inicial. Cada papel é atribuído no máximo uma vez — a primeira
 * coluna que casa fica com ele, as seguintes viram "ignorar" e a pessoa
 * escolhe. Duas colunas disputando "custo" em silêncio é como se erra caro.
 */
export function sugerirMapeamento(headers: readonly string[]): Mapeamento {
  const mapa: Mapeamento = {};
  const tomados = new Set<PapelColuna>();
  for (const h of headers) {
    const n = normalizar(h);
    const regra = REGRAS.find((r) => !tomados.has(r.papel) && r.testa(n));
    if (regra) {
      mapa[h] = regra.papel;
      tomados.add(regra.papel);
    } else {
      mapa[h] = "ignorar";
    }
  }
  return mapa;
}

/** O cabeçalho que recebeu um papel, se houver. */
export function colunaDoPapel(mapa: Mapeamento, papel: PapelColuna): string | undefined {
  return Object.keys(mapa).find((h) => mapa[h] === papel);
}

/**
 * Número de planilha brasileira, ou null quando não há número.
 *
 * null e 0 são coisas diferentes: 0 é um valor, null é "esta célula não tem
 * número nenhum" — e é isso que revela a coluna trocada por texto.
 */
export function parseNumero(s: string): number | null {
  const t = (s ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!t) return null;
  let normalizado: string;
  if (t.includes(",")) {
    normalizado = t.replace(/\./g, "").replace(",", ".");
  } else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) {
    // Zero à esquerda não é agrupamento de milhar: "0.850" é 0,85, não 850.
    normalizado = t.replace(/\./g, "");
  } else {
    normalizado = t;
  }
  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** Os dígitos de um texto, concatenados: "Modare 7142.106" → "7142106". */
export function digitosDe(s: string): string {
  return ((s ?? "").match(/\d+/g) ?? []).join("");
}

export interface LinhaDaPrevia {
  /** Número da linha na planilha, contando o cabeçalho como 1. */
  numero: number;
  chave: string;
  nome: string;
  custo: number | null;
  precoVenda: number | null;
  /** O texto cru da célula de custo — é ele que denuncia a coluna trocada. */
  custoCru: string;
}

/** As primeiras linhas como o sistema as leria, do jeito que estão. */
export function montarPrevia(
  linhas: readonly Record<string, string>[],
  mapa: Mapeamento,
  quantas = 8
): LinhaDaPrevia[] {
  const cSku = colunaDoPapel(mapa, "sku");
  const cEan = colunaDoPapel(mapa, "ean");
  const cNome = colunaDoPapel(mapa, "nome");
  const cCusto = colunaDoPapel(mapa, "custo");
  const cPreco = colunaDoPapel(mapa, "precoVenda");

  return linhas.slice(0, quantas).map((row, i) => ({
    numero: i + 2, // +1 pelo cabeçalho, +1 porque planilha conta do 1
    chave: (cSku && row[cSku]?.trim()) || (cEan && row[cEan]?.trim()) || "",
    nome: (cNome && row[cNome]?.trim()) || "",
    custoCru: (cCusto && row[cCusto]) ?? "",
    custo: cCusto ? parseNumero(row[cCusto] ?? "") : null,
    precoVenda: cPreco ? parseNumero(row[cPreco] ?? "") : null,
  }));
}

/**
 * O valor da célula de custo é, na verdade, a referência do modelo?
 *
 * A assinatura do estrago de 28/07: "Papete Slide Modare 7208.101" com custo
 * "7208.101", "Chinelo Cartago 11840 Atlanta" com custo "11840".
 *
 * Compara o TEXTO CRU, não os dígitos. Comparar dígitos parece mais esperto e
 * é pior: um custo legítimo de R$ 17,16 num produto "Babuche Boaonda 1716 John"
 * tem exatamente os mesmos dígitos que a referência, e viraria alarme falso.
 * O texto cru separa os dois — "17,16" não aparece no nome, "11840" aparece.
 *
 * Exige 4 dígitos ou mais: com menos, o número no nome costuma ser numeração
 * de calçado ("Tênis 45") e bateria com qualquer custo de dois dígitos.
 */
export function ehReferenciaDisfarcada(custoCru: string, nome: string): boolean {
  const valor = (custoCru ?? "").trim();
  if (digitosDe(valor).length < 4) return false;
  return (nome ?? "").includes(valor);
}

export type TipoAlerta =
  | "sem_custo"
  | "sem_identificacao"
  | "custo_nao_numerico"
  | "custo_acima_do_preco"
  | "custo_igual_a_referencia";

export interface Alerta {
  tipo: TipoAlerta;
  /** Quantas linhas da planilha inteira exibem o problema. */
  linhas: number;
  mensagem: string;
  /** true quando gravar assim é quase certamente errado. */
  grave: boolean;
}

/**
 * O que a planilha denuncia sobre si mesma.
 *
 * Roda sobre TODAS as linhas, não só as da prévia: o deslocamento de colunas
 * costuma atingir uma parte do arquivo, e olhar só as oito primeiras deixaria
 * passar. Nenhum destes sinais é chute — cada um é uma contradição interna do
 * próprio arquivo.
 */
export function sinaisDaPlanilha(
  linhas: readonly Record<string, string>[],
  mapa: Mapeamento
): Alerta[] {
  const alertas: Alerta[] = [];
  const cCusto = colunaDoPapel(mapa, "custo");
  const cNome = colunaDoPapel(mapa, "nome");
  const cPreco = colunaDoPapel(mapa, "precoVenda");
  const temChave = Boolean(colunaDoPapel(mapa, "sku") || colunaDoPapel(mapa, "ean") || cNome);

  if (!cCusto) {
    alertas.push({
      tipo: "sem_custo",
      linhas: 0,
      grave: true,
      mensagem: "Nenhuma coluna foi marcada como Custo. Escolha qual é antes de continuar.",
    });
  }
  if (!temChave) {
    alertas.push({
      tipo: "sem_identificacao",
      linhas: 0,
      grave: true,
      mensagem:
        "Nenhuma coluna identifica o produto. Marque o SKU, o EAN ou o nome — sem isso não há como saber de qual produto é cada custo.",
    });
  }
  if (!cCusto) return alertas;

  let naoNumerico = 0;
  let acimaDoPreco = 0;
  let igualAReferencia = 0;

  for (const row of linhas) {
    const cru = row[cCusto] ?? "";
    if (!cru.trim()) continue; // célula vazia é ausência, não erro
    const custo = parseNumero(cru);
    if (custo === null) {
      naoNumerico++;
      continue;
    }
    if (cPreco) {
      const preco = parseNumero(row[cPreco] ?? "");
      // Vender abaixo do custo acontece; o dobro do preço de venda em custo,
      // em massa, é coluna trocada.
      if (preco !== null && preco > 0 && custo > preco * 2) acimaDoPreco++;
    }
    if (cNome && ehReferenciaDisfarcada(cru, row[cNome] ?? "")) igualAReferencia++;
  }

  if (igualAReferencia > 0) {
    alertas.push({
      tipo: "custo_igual_a_referencia",
      linhas: igualAReferencia,
      grave: true,
      mensagem:
        `Em ${igualAReferencia} linha(s) o valor de Custo é o mesmo código de modelo que aparece no nome do produto. ` +
        "Isso é referência, não dinheiro — normalmente significa que as colunas estão deslocadas nessas linhas.",
    });
  }
  if (acimaDoPreco > 0) {
    alertas.push({
      tipo: "custo_acima_do_preco",
      linhas: acimaDoPreco,
      grave: acimaDoPreco > linhas.length / 10,
      mensagem:
        `Em ${acimaDoPreco} linha(s) o custo é mais que o dobro do preço de venda. ` +
        "Confira se a coluna de Custo é mesmo essa.",
    });
  }
  if (naoNumerico > 0) {
    alertas.push({
      tipo: "custo_nao_numerico",
      linhas: naoNumerico,
      grave: naoNumerico > linhas.length / 2,
      mensagem:
        `${naoNumerico} linha(s) têm texto na coluna de Custo, e serão ignoradas. ` +
        "Se forem muitas, a coluna escolhida provavelmente não é a de custo.",
    });
  }
  return alertas;
}

/** Dá para gravar? Alerta grave trava; alerta leve só informa. */
export function podeImportar(alertas: readonly Alerta[]): boolean {
  return !alertas.some((a) => a.grave);
}
