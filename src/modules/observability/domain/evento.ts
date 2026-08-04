// O que o sistema conta quando algo falha — e o que ele NUNCA conta.
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// Medido em 04/08/2026: 146 blocos `catch`, 50 `console.error`, e nenhuma das
// 9 rotas de API recebendo um erro do navegador. Todo destino era local — o
// console da lojista, o localStorage, o estado do React. O handoff daquele dia
// trata a consequência como método:
//
//     "a evidência que falta está no console do navegador da lojista.
//      Peça o console antes de ler código."
//
// Isso não é método. É o que sobra quando o sistema não fala.
//
// ===========================================================================
// A REGRA DE PRIVACIDADE, EM UM LUGAR
// ===========================================================================
//
// `consultaPeso.ts` já tinha decidido isto, e decidiu certo: "A frase do
// operador NÃO é gravada. Ele digita nome de fornecedor, código interno,
// observação comercial."
//
// Aqui a mesma regra enfrenta um risco que aquela não tinha: **mensagem de
// erro de banco carrega dado**. O Postgres devolve o valor junto com o
// defeito —
//
//     duplicate key value violates unique constraint "produtos_sku_key"
//     DETAIL: Key (sku)=(CHINELO-AZUL-38) already exists.
//
// — e quem escreve `catch (e) { registrar(e.message) }` não está pensando
// nisso. Por isso a redação NÃO é responsabilidade de quem chama: ela mora
// aqui, é pura, e é testada.
//
// É a lição de 04/08 aplicada ANTES de existir o segundo lugar: a regra da
// capa virou quatro versões porque cada chamador respondeu por si.
//
// A postura é lista de PERMISSÃO, não de bloqueio. Bloqueio erra por omissão —
// basta um formato de mensagem que ninguém previu. Permissão erra por excesso
// de zelo, que custa diagnóstico e não custa vazamento.

/** `erro` = a pessoa foi impedida. `aviso` = seguiu, com menos do que pediu. */
export type Severidade = "erro" | "aviso";

/**
 * A taxonomia é curta e fechada de propósito.
 *
 * É por `tipo` que se conta ("quantas consultas falharam esta semana"), e
 * contagem sobre texto livre não é contagem. Mensagem descreve UM caso; tipo
 * descreve a CLASSE. Quando faltar um tipo, acrescente aqui — é barato, e o
 * compilador encontra todos os pontos.
 */
export type TipoDeEvento =
  | "consulta_falhou"      // uma leitura não voltou (rede, RLS, schema)
  | "gravacao_falhou"      // uma escrita não aconteceu
  | "lote_parcial"         // parte do lote gravou, parte não
  | "integracao_falhou";   // o marketplace recusou ou não respondeu

export interface EventoNovo {
  tipo: TipoDeEvento;
  /** ONDE no código, não em que tela: `useLiveQuery`, `importarAnunciosML`. */
  origem: string;
  severidade: Severidade;
  mensagem: string;
  contexto?: Record<string, unknown>;
}

/** O evento pronto para viajar — redigido, truncado, contável. */
export interface EventoRedigido {
  tipo: TipoDeEvento;
  origem: string;
  severidade: Severidade;
  mensagem: string;
  contexto: Record<string, string | number | boolean>;
  repeticoes: number;
}

export const LIMITE_MENSAGEM = 300;
export const LIMITE_TEXTO_CONTEXTO = 120;
export const LIMITE_CHAVES_CONTEXTO = 12;

/**
 * Tira o DADO da mensagem, mantendo o DEFEITO.
 *
 * Os três padrões abaixo não são uma lista de tudo que pode vazar — são os que
 * carregam valor por construção. O que os une: em todos, o texto entre
 * delimitadores foi escrito por alguém, e o resto foi escrito por uma máquina.
 * O resto é o que diagnostica.
 */
export function redigirMensagem(bruta: string): string {
  const semDados = bruta
    // Postgres: `Key (sku)=(CHINELO-AZUL-38) already exists` — o valor mora
    // dentro do segundo parêntese, e é dado do lojista toda vez.
    .replace(/=\([^)]*\)/g, "=(…)")
    // Aspas duplas do Postgres carregam nome de constraint (útil) mas também
    // valor em várias mensagens. O nome do defeito sobrevive fora delas.
    .replace(/"[^"]{40,}"/g, '"…"')
    // E-mail identifica pessoa, e aparece em erro de auth.
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>");

  return semDados.length > LIMITE_MENSAGEM
    ? `${semDados.slice(0, LIMITE_MENSAGEM)}…`
    : semDados;
}

/**
 * Só escalares curtos entram no contexto.
 *
 * Objeto aninhado é por onde um registro inteiro entraria sem ninguém notar —
 * `contexto: { produto }` parece inocente e carrega nome, custo e observação.
 * Descartar em silêncio seria pior que recusar, então o que não passa vira uma
 * marca visível (`<omitido>`): quem lê o evento vê que havia algo ali.
 */
export function sanitizarContexto(
  bruto: Record<string, unknown> | undefined
): Record<string, string | number | boolean> {
  if (!bruto) return {};
  const limpo: Record<string, string | number | boolean> = {};
  for (const [chave, valor] of Object.entries(bruto)) {
    if (Object.keys(limpo).length >= LIMITE_CHAVES_CONTEXTO) break;
    if (typeof valor === "number" || typeof valor === "boolean") {
      limpo[chave] = valor;
    } else if (typeof valor === "string") {
      limpo[chave] = redigirMensagem(valor).slice(0, LIMITE_TEXTO_CONTEXTO);
    } else if (valor === null || valor === undefined) {
      // Ausência É informação — "veio nulo" costuma ser o defeito.
      limpo[chave] = valor === null ? "null" : "undefined";
    } else {
      limpo[chave] = "<omitido>";
    }
  }
  return limpo;
}

/**
 * A chave pela qual dois eventos são O MESMO, para efeito de contagem.
 *
 * Deliberadamente NÃO inclui a mensagem: uma consulta que falha em laço produz
 * mensagens que variam no detalhe e descrevem um defeito só. Incluir a mensagem
 * derrotaria a agregação exatamente no caso em que ela é necessária.
 */
export function chaveDeAgregacao(e: Pick<EventoNovo, "tipo" | "origem" | "severidade">): string {
  return `${e.tipo}|${e.origem}|${e.severidade}`;
}

/** Um evento cru vira um evento que pode ser gravado. */
export function prepararEvento(e: EventoNovo): EventoRedigido {
  return {
    tipo: e.tipo,
    origem: e.origem,
    severidade: e.severidade,
    mensagem: redigirMensagem(e.mensagem),
    contexto: sanitizarContexto(e.contexto),
    repeticoes: 1,
  };
}

/**
 * Junta os eventos de uma janela, somando as repetições.
 *
 * Preserva a PRIMEIRA mensagem de cada chave, não a última: a primeira é a que
 * aconteceu antes de o sistema entrar no estado degradado, e é ela que explica
 * como ele entrou.
 */
export function agregar(eventos: readonly EventoRedigido[]): EventoRedigido[] {
  const porChave = new Map<string, EventoRedigido>();
  for (const e of eventos) {
    const chave = chaveDeAgregacao(e);
    const existente = porChave.get(chave);
    if (existente) existente.repeticoes += e.repeticoes;
    else porChave.set(chave, { ...e });
  }
  return [...porChave.values()];
}

export const TIPOS_DE_EVENTO: readonly TipoDeEvento[] = [
  "consulta_falhou",
  "gravacao_falhou",
  "lote_parcial",
  "integracao_falhou",
];

/** Teto de repetições numa linha só — acima disso o número já não informa mais. */
export const LIMITE_REPETICOES = 100_000;

/**
 * Revalida um evento que chegou PELA REDE, e devolve `null` se ele não serve.
 *
 * Mora no domínio, e não na rota, por dois motivos. O primeiro é o de sempre:
 * regra em dois lugares vira duas regras. O segundo é específico — esta é a
 * única fronteira do sistema onde um cliente autenticado qualquer pode fazer
 * o Zion gravar uma linha. Se a redação não rodasse de novo aqui, uma mensagem
 * postada crua entraria crua, e o cuidado do lado do navegador seria decorativo.
 *
 * Recusar é sempre preferível a corrigir: um evento a menos custa diagnóstico,
 * um evento inventado custa confiança no que a tabela diz.
 */
export function validarEventoRecebido(bruto: unknown): EventoRedigido | null {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const e = bruto as Record<string, unknown>;

  const tipo = TIPOS_DE_EVENTO.find((t) => t === e.tipo);
  if (!tipo) return null;
  if (typeof e.origem !== "string" || !e.origem.trim()) return null;

  const contexto =
    e.contexto && typeof e.contexto === "object" && !Array.isArray(e.contexto)
      ? (e.contexto as Record<string, unknown>)
      : undefined;

  const preparado = prepararEvento({
    tipo,
    origem: e.origem.trim().slice(0, 120),
    severidade: e.severidade === "aviso" ? "aviso" : "erro",
    mensagem: typeof e.mensagem === "string" ? e.mensagem : "",
    contexto,
  });

  const repeticoes =
    typeof e.repeticoes === "number" && Number.isFinite(e.repeticoes)
      ? Math.max(1, Math.min(Math.trunc(e.repeticoes), LIMITE_REPETICOES))
      : 1;

  return { ...preparado, repeticoes };
}

/** A mensagem de um erro desconhecido, sem deixar `[object Object]` passar. */
export function mensagemDoErro(bruto: unknown): string {
  if (bruto instanceof Error) return bruto.message;
  if (typeof bruto === "string") return bruto;
  try {
    return JSON.stringify(bruto) ?? String(bruto);
  } catch {
    return String(bruto);
  }
}
