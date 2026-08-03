// As infrações da CONTA, lidas do Mercado Livre — domínio puro.
//
// POR QUE ESTE ARQUIVO EXISTE
// ---------------------------
// Em 31/07/2026 o ML cancelou 6 anúncios por infração de propriedade
// intelectual, por detecção automática e sem revelar o motivo. A lojista
// descobriu abrindo o painel dele. O Zion não sabia que existiam.
//
// É a única categoria em que o erro custa a CONTA, não a venda do dia — e até
// hoje o único sinal que tínhamos era `sub_status: forbidden`, que só enxerga
// anúncio que AINDA está no catálogo importado. Infração de anúncio já apagado
// da conta era invisível.
//
// A rota certa não foi adivinhada. Ela foi lida na documentação e depois
// MEDIDA sem token, em 03/08/2026, para separar "existe" de "inventei":
//
//   GET /marketplace/moderations/infractions/{userId}   -> 403 PolicyAgent
//   GET /moderations/infractions/{userId}               -> 403 PolicyAgent
//   GET /moderations/last_moderation/{elementId}-ITM    -> 403 PolicyAgent
//   GET /users/{userId}/infractions                     -> 404 resource not found
//
// 403 é o gateway reconhecendo o caminho e a política barrando; 404 é caminho
// que não existe. As três primeiras existem; a quarta era invenção de uma fonte
// secundária. Adivinhar endpoint do ML custou duas tardes em 02–03/08, e esta
// medida de trinta segundos é a alternativa.

/** O que o ML devolve em cada linha de `infractions` (campos documentados). */
interface InfracaoBruta {
  id?: unknown;
  date_created?: unknown;
  user_id?: unknown;
  related_item_id?: unknown;
  element_id?: unknown;
  element_type?: unknown;
  site_id?: unknown;
  filter_subgroup?: unknown;
  reason?: unknown;
  remedy?: unknown;
}

export interface Infracao {
  id: string;
  /** YYYY-MM-DD, como o ML devolve. Vazio quando não veio. */
  dataCriacao: string;
  /** O anúncio associado (MLB), quando existe. */
  itemRelacionado: string;
  /** O elemento moderado — pode ser o próprio item, uma pergunta ou review. */
  elementoId: string;
  /** ITM, QUE ou REV. Vazio quando não veio. */
  tipoElemento: string;
  subgrupo: string;
  /** POR QUE. É a informação que faltou em 31/07. */
  motivo: string;
  /** O QUE FAZER. O ML diz, e nós descartávamos junto com o resto. */
  remedio: string;
}

/**
 * O resultado da leitura — incluindo o que ela NÃO conseguiu ver.
 *
 * `formatoInesperado` não é zelo: a documentação avisa que a resposta vem
 * `null` quando não há infração, em vez de lista vazia. Tratar `null` como
 * "deu erro" mostraria alarme onde está tudo certo; tratar QUALQUER coisa
 * inesperada como "zero infrações" afirmaria segurança sem ter olhado. Os dois
 * casos são separados aqui de propósito.
 */
export interface LeituraDeInfracoes {
  infracoes: Infracao[];
  /** O `paging.total` do ML. -1 = não informou. */
  total: number;
  /** `true` quando o corpo veio `null` — que o ML documenta como "nenhuma". */
  nenhumaDeclarada: boolean;
  /** Descrição do que chegou, quando não era nem lista nem `null`. */
  formatoInesperado: string | null;
}

function texto(v: unknown): string {
  // `String(v)` e não `v.trim()`: em 02/08/2026 `family_id` chegou como NÚMERO,
  // o `.trim()` estourou dentro do mapeador, e a tela acusou o Mercado Livre de
  // ter recusado campos que ele nunca recusou. Culpar a fonte por defeito
  // próprio manda procurar no lugar errado.
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function inteiro(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return -1;
}

/** Traduz o corpo de `/moderations/infractions/{userId}` sem inventar nada. */
export function lerInfracoes(corpo: unknown): LeituraDeInfracoes {
  const vazio = (extra: Partial<LeituraDeInfracoes> = {}): LeituraDeInfracoes => ({
    infracoes: [],
    total: -1,
    nenhumaDeclarada: false,
    formatoInesperado: null,
    ...extra,
  });

  // `null` É a resposta documentada para "nenhuma infração". Não é falha, e
  // dizer que é faria a tela gritar todo dia numa conta limpa.
  if (corpo === null) return vazio({ nenhumaDeclarada: true, total: 0 });
  if (corpo === undefined) return vazio({ formatoInesperado: "resposta sem corpo" });

  // O ML pode devolver a lista solta ou embrulhada em `{ infractions, paging }`.
  // Os dois são aceitos porque a documentação mostra o embrulho e nenhuma
  // execução real confirmou qual chega — e o custo de aceitar os dois é uma
  // linha, contra uma leitura zerada em produção.
  const raiz = corpo as { infractions?: unknown; paging?: { total?: unknown } };
  const lista = Array.isArray(corpo) ? corpo : Array.isArray(raiz.infractions) ? raiz.infractions : null;

  if (lista === null) {
    return vazio({
      formatoInesperado: `esperava lista ou null, veio ${typeof corpo}${
        typeof corpo === "object" ? ` com as chaves [${Object.keys(raiz).join(", ")}]` : ""
      }`,
    });
  }

  const infracoes = (lista as InfracaoBruta[]).map((i) => ({
    id: texto(i.id),
    dataCriacao: texto(i.date_created),
    itemRelacionado: texto(i.related_item_id),
    elementoId: texto(i.element_id),
    tipoElemento: texto(i.element_type),
    subgrupo: texto(i.filter_subgroup),
    motivo: texto(i.reason),
    remedio: texto(i.remedy),
  }));

  return {
    infracoes,
    // Sem `?? infracoes.length`: o total do ML e o tamanho da página são coisas
    // diferentes, e igualá-los é como a importação afirmava completude nos 500.
    total: inteiro(raiz.paging?.total),
    nenhumaDeclarada: false,
    formatoInesperado: null,
  };
}

/**
 * O `MODERATION_REFERENCE_ID` de `last_moderation`: id do elemento + sufixo.
 *
 * A documentação define o formato como `element_id + "-" + element_type`, com
 * ITM para item, QUE para pergunta e REV para review. Quando o ML não disse o
 * tipo, o padrão é ITM — é o único tipo que a nossa leitura produz hoje, e
 * chutar QUE numa lista que só tem anúncio seria pior que assumir o conhecido.
 */
export function referenciaDeModeracao(elementoId: string, tipoElemento: string): string {
  const id = elementoId.trim();
  if (!id) return "";
  const tipo = tipoElemento.trim().toUpperCase() || "ITM";
  return `${id}-${tipo}`;
}

/**
 * A conta pode anunciar?
 *
 * `status.list.allow` no `/users/me` é o ML dizendo se a conta está livre para
 * publicar. É o sinal que transforma "6 infrações" em "a conta está em risco" —
 * e a diferença entre as duas frases é a única que importa aqui.
 *
 * `null` = o ML não informou. Nunca "pode".
 */
export function contaPodeAnunciar(usuario: unknown): boolean | null {
  const status = (usuario as { status?: { list?: { allow?: unknown } } })?.status;
  const allow = status?.list?.allow;
  return typeof allow === "boolean" ? allow : null;
}

/**
 * O `remedy` do ML vem em HTML — medido na conta real em 03/08/2026:
 * `<div><strong>Pausamos o anúncio…</strong></div><div>Ajuste o título…</div>`.
 *
 * A tela mostrava as tags cruas. Renderizar o HTML dele seria pior (texto de
 * terceiro injetado na nossa página), então o caminho é ARRANCAR as tags e
 * ficar com a frase. As quebras viram espaço porque `</div><div>` cola duas
 * frases sem separador nenhum.
 */
export function semHtml(bruto: string): string {
  return bruto
    .replace(/<\/(div|p|br|li)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Quantos ANÚNCIOS distintos, não quantas infrações.
 *
 * A diferença não é detalhe: medido em 03/08/2026, o ML declarou **1.060
 * infrações** nesta conta, e na primeira página o mesmo `MLB4820492395`
 * aparecia cinco vezes seguidas. 1.060 infrações podem ser 1.060 anúncios ou
 * oitenta, e as duas leituras pedem decisões opostas.
 *
 * Infração sem item relacionado não entra na contagem de itens — e é por isso
 * que ela é devolvida à parte, em vez de somada como se fosse um item anônimo.
 */
export function itensDistintos(infracoes: readonly Infracao[]): {
  itens: number;
  semItem: number;
} {
  const vistos = new Set<string>();
  let semItem = 0;
  for (const i of infracoes) {
    if (i.itemRelacionado) vistos.add(i.itemRelacionado);
    else semItem++;
  }
  return { itens: vistos.size, semItem };
}

/**
 * Agrupa por motivo, do mais frequente — a ordem em que se resolve.
 *
 * A CONTAGEM E A LISTA DE ITENS SÃO SEPARADAS, e isso não é detalhe: uma
 * infração pode não ter `related_item_id` (o elemento moderado pode ser uma
 * pergunta ou um review). Contar pelo tamanho da lista de MLBs faria essa
 * infração desaparecer da contagem — exatamente o tipo de número mudo que
 * passei 02–03/08 arrancando desta base.
 */
export function contarPorMotivo(
  infracoes: readonly Infracao[]
): { motivo: string; infracoes: number; itens: string[] }[] {
  const mapa = new Map<string, { total: number; itens: Set<string> }>();
  for (const i of infracoes) {
    const chave = i.motivo || "(o ML não informou o motivo)";
    const atual = mapa.get(chave) ?? { total: 0, itens: new Set<string>() };
    atual.total++;
    if (i.itemRelacionado) atual.itens.add(i.itemRelacionado);
    mapa.set(chave, atual);
  }
  return (
    [...mapa.entries()]
      // A lista de itens é um CONJUNTO, não um acúmulo. Na primeira leitura da
      // conta real, "13× título e/ou fotos" mostrou `MLB4820492395` cinco vezes
      // seguidas — o mesmo anúncio punido repetidamente. Repetir o MLB na tela
      // faz 13 infrações parecerem 13 anúncios, que é a leitura errada e a que
      // muda a decisão.
      .map(([motivo, v]) => ({ motivo, infracoes: v.total, itens: [...v.itens] }))
      .sort((a, b) => b.infracoes - a.infracoes || a.motivo.localeCompare(b.motivo))
  );
}
