// De onde veio este valor — e o que isso NÃO significa.
//
// A pergunta que o lojista faz é curta: "de onde veio esse custo?". A resposta
// honesta tem cinco partes, e juntá-las numa só é o erro que este módulo existe
// para impedir.
//
//     ORIGEM     de onde o valor veio como FATO (cliente, ERP, planilha, Zion)
//     MÉTODO     por qual caminho ele entrou (cadastro, copilot, importação…)
//     ATOR       quem — o humano, quando havia um
//     MOMENTO    quando
//     EVIDÊNCIA  o registro que sustenta a afirmação (proposta, decisão, ação)
//
// ---------------------------------------------------------------------------
// PROCEDÊNCIA NÃO É CONFIANÇA. Este módulo NÃO tem campo de confiança.
//
// "Veio do ERP" não quer dizer certo — o ERP já mandou custo de referência de
// modelo. "Veio do cliente" não quer dizer certo — o mesmo cliente pode dizer
// dois custos diferentes na mesma conversa. E "veio da planilha" foi
// exatamente a origem do custo de R$ 30.277.872 que entrou com selo de
// "confiança alta" porque a célula foi LIDA corretamente.
//
// Validade é outra pergunta, e ela já tem dono: `pricing/domain/custoDigitado`
// para dinheiro, `validarRascunho` para o obrigatório. Misturar as duas aqui
// reconstruiria a hierarquia simplista — ERP bom, IA ruim — que os incidentes
// desta base já desmentiram.
//
// ---------------------------------------------------------------------------
// DESCONHECIDO É UMA RESPOSTA, E É A MAIS COMUM HOJE.
//
// A base tem 73 produtos e 684 variantes escritos antes de existir qualquer
// registro de procedência. Para eles a resposta certa é "não foi registrado" —
// nunca "provavelmente veio da planilha". Um palpete apresentado como fato é
// pior que a ausência, porque a ausência ninguém usa para decidir.

import { ehCritico } from "../../assistant/domain/fatosDoCadastro";

/** De onde o valor veio COMO FATO. Não é juízo sobre ele estar certo. */
export type OrigemDoValor =
  /** O lojista afirmou. Digitou, disse ao Copilot, corrigiu na tela. */
  | "cliente"
  /** Um ERP conectado devolveu. */
  | "erp"
  /** Veio de um arquivo que alguém subiu. */
  | "planilha"
  /** Veio do marketplace (importação de anúncios). */
  | "marketplace"
  /** O próprio Zion produziu — cálculo ou derivação determinística. */
  | "zion"
  /** Nada foi registrado. Ver o cabeçalho: isto é resposta, não falha. */
  | "desconhecida";

/** Por qual caminho o valor entrou. Responde "esse SKU veio da planilha?". */
export type MetodoDeEntrada =
  | "cadastro_manual"
  | "copilot"
  | "importacao"
  | "api_marketplace"
  | "calculo"
  | "desconhecido";

/**
 * O que sustenta a afirmação de procedência.
 *
 * Sem evidência, "veio do Copilot" é uma frase. Com o id da proposta, é um
 * registro que alguém consegue abrir e conferir.
 */
export interface EvidenciaDeProcedencia {
  /** `copilot_acoes`, `decisoes`, `copilot_cadastros`, `procedencia_de_campo`. */
  registro: string;
  id: string;
}

export interface Procedencia {
  origem: OrigemDoValor;
  metodo: MetodoDeEntrada;
  /** O id do humano, quando havia um. `null` = sistema, ou não registrado. */
  ator: string | null;
  /** ISO. `null` quando não há registro — e aí a origem é `desconhecida`. */
  momento: string | null;
  evidencia?: EvidenciaDeProcedencia;
}

/** O valor de um campo, com a procedência dele. */
export interface ValorComProcedencia {
  campo: string;
  /** Como o valor aparece para quem lê. Texto, sempre — SKU tem zero à esquerda. */
  valor: string;
  procedencia: Procedencia;
}

/**
 * A resposta quando não há registro nenhum.
 *
 * Existe como função e não como constante para ninguém mutá-la por engano, e
 * para a intenção ficar escrita na chamada.
 */
export function procedenciaDesconhecida(): Procedencia {
  return { origem: "desconhecida", metodo: "desconhecido", ator: null, momento: null };
}

export function ehDesconhecida(p: Procedencia): boolean {
  return p.origem === "desconhecida";
}

/**
 * O histórico de um campo — o valor de hoje e os anteriores REGISTRADOS.
 *
 * `anteriores` vem em ordem decrescente de momento. Vazio significa "não há
 * registro anterior", que é diferente de "nunca mudou": esta base foi escrita
 * durante meses sem nenhuma trilha, e afirmar que o valor nunca mudou seria
 * inventar um passado.
 */
export interface HistoricoDeCampo {
  campo: string;
  /** O valor de agora, lido do catálogo. `null` = o campo está vazio. */
  valorAtual: string | null;
  /** A procedência do valor atual, ou desconhecida. */
  procedencia: Procedencia;
  anteriores: readonly ValorComProcedencia[];
  /**
   * Verdadeiro quando a trilha COMEÇA depois do valor atual existir.
   *
   * Serve para a frase ser honesta: "não sei de onde veio, e não sei porque
   * ninguém registrava na época" é diferente de "esse campo nunca foi tocado".
   */
  anteriorAoRegistro: boolean;
}

// ---------------------------------------------------------------------------
// conflito
// ---------------------------------------------------------------------------

/**
 * Duas fontes, dois valores, nenhuma escolha automática.
 *
 * NÃO existe aqui "confiança 90% na planilha". A planilha diz R$ 42,00 e o
 * lojista disse R$ 47,80 ao Copilot: são dois fatos, e o único jeito honesto de
 * resolver é perguntar. Eleger a fonte "mais confiável" por regra é como esta
 * base ganhou um custo de trinta milhões — a planilha tinha sido lida
 * corretamente, e a leitura correta de uma coluna errada continua errada.
 */
export interface ConflitoDeProcedencia {
  campo: string;
  /** O alvo: um produto ou uma variante. */
  alvo: { tipo: "produto" | "variante"; id: string; rotulo: string };
  lados: readonly ValorComProcedencia[];
  /** Por que isto é um conflito, na voz de quem vai decidir. */
  explicacao: string;
}

/**
 * Há conflito entre estes valores?
 *
 * Dois registros com valores DIFERENTES para o mesmo campo. Iguais não são
 * conflito, mesmo vindos de fontes diferentes — duas fontes concordando é o
 * caso bom, não um problema a relatar.
 *
 * A comparação é textual e canônica porque é assim que os valores chegam dos
 * três registros que os guardam. Converter para número aqui perderia o zero à
 * esquerda de um SKU.
 */
export function detectarConflito(
  campo: string,
  alvo: ConflitoDeProcedencia["alvo"],
  valores: readonly ValorComProcedencia[]
): ConflitoDeProcedencia | null {
  const distintos = new Map<string, ValorComProcedencia>();
  for (const v of valores) {
    const chave = canonico(v.valor);
    if (!chave) continue;
    if (!distintos.has(chave)) distintos.set(chave, v);
  }
  if (distintos.size < 2) return null;
  const lados = [...distintos.values()];
  return {
    campo,
    alvo,
    lados,
    explicacao: `${lados
      .map((l) => `${l.valor} (${escreverProcedencia(l.procedencia)})`)
      .join(" e ")} — os dois estão registrados para ${campo}.`,
  };
}

function canonico(v: string): string {
  return String(v ?? "").trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// escrita para leitura humana
// ---------------------------------------------------------------------------

const NOME_DA_ORIGEM: Record<OrigemDoValor, string> = {
  cliente: "você informou",
  erp: "veio do ERP",
  planilha: "veio de uma planilha",
  marketplace: "veio do Mercado Livre",
  zion: "o Zion calculou",
  desconhecida: "origem não registrada",
};

const NOME_DO_METODO: Record<MetodoDeEntrada, string> = {
  cadastro_manual: "pelo cadastro manual",
  copilot: "em conversa comigo",
  importacao: "por importação",
  api_marketplace: "pela integração do marketplace",
  calculo: "por cálculo",
  desconhecido: "",
};

/**
 * A procedência em uma frase.
 *
 * Quando é desconhecida, a frase diz isso e para. Acrescentar "provavelmente" a
 * uma origem desconhecida é o começo do palpite virando fato.
 */
export function escreverProcedencia(p: Procedencia): string {
  if (ehDesconhecida(p)) return NOME_DA_ORIGEM.desconhecida;
  const metodo = NOME_DO_METODO[p.metodo];
  return metodo ? `${NOME_DA_ORIGEM[p.origem]} ${metodo}` : NOME_DA_ORIGEM[p.origem];
}

/**
 * A resposta completa de "de onde veio esse custo?".
 *
 * Devolve TEXTO montado pelo domínio, não pelo modelo: a diferença entre
 * "origem não registrada" e "veio da planilha" é a diferença entre honestidade
 * e invenção, e ela não pode depender de como o Gemini resolveu escrever.
 */
export function explicarHistorico(h: HistoricoDeCampo, rotuloDoAlvo: string): string {
  if (h.valorAtual === null) {
    return `${rotuloDoAlvo} está sem ${h.campo}.`;
  }
  const linhas = [`${h.campo} de ${rotuloDoAlvo}: ${h.valorAtual}.`];

  if (ehDesconhecida(h.procedencia)) {
    linhas.push(
      h.anteriorAoRegistro
        ? "A origem desse valor não foi registrada — ele é anterior ao registro de procedência."
        : "A origem desse valor não foi registrada."
    );
  } else {
    const quando = h.procedencia.momento ? ` em ${h.procedencia.momento}` : "";
    linhas.push(`Origem: ${escreverProcedencia(h.procedencia)}${quando}.`);
  }

  if (h.anteriores.length > 0) {
    const antes = h.anteriores
      .map((a) => `${a.valor} (${escreverProcedencia(a.procedencia)})`)
      .join("; ");
    linhas.push(`Valor anterior registrado: ${antes}.`);
  }
  return linhas.join(" ");
}

// ---------------------------------------------------------------------------
// campos críticos
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// campos críticos
// ---------------------------------------------------------------------------

/**
 * O nome do campo NO CATÁLOGO, traduzido para o vocabulário dos fatos.
 *
 * A lista de campos críticos é UMA — a de `fatosDoCadastro` — e não é copiada
 * aqui. Duas listas divergiriam no dia em que uma delas mudasse, e a divergência
 * apareceria como um valor inferido entrando por um caminho e recusado no outro.
 *
 * O que existe aqui é só a tradução de nome: a coluna do banco chama `peso`
 * (em kg, na variante) o que o cadastro chama `pesoGramas`. Traduzir é
 * diferente de redefinir.
 */
const NOME_NO_CADASTRO: Record<string, string> = {
  peso: "pesoGramas",
  preco: "precoVenda",
  preco_venda: "precoVenda",
};

/**
 * `estoque` é crítico AQUI e não lá — e isso é deliberado.
 *
 * No cadastro em conversa ele não é: um estoque errado num produto que ainda não
 * existe não faz estrago. No catálogo vivo ele é: estoque errado vende o que não
 * há, e o Mercado Livre cancela a venda na conta do lojista.
 */
const CRITICOS_SO_NO_CATALOGO: readonly string[] = ["estoque"];

/** Este campo do catálogo não aceita valor inventado? */
export function campoCriticoDoCatalogo(campo: string): boolean {
  if (CRITICOS_SO_NO_CATALOGO.includes(campo)) return true;
  return ehCritico(NOME_NO_CADASTRO[campo] ?? campo);
}

/**
 * A IA pode ser fonte deste valor?
 *
 * NUNCA para campo crítico. Ela pode detectar ausência, apontar conflito,
 * explicar, agrupar e perguntar — o que ela não pode é ocupar o lugar do valor.
 *
 * `zion` com método `calculo` NÃO é a IA: é aritmética determinística (piso,
 * margem), e ela é fonte legítima do que calcula. A distinção mora no método,
 * não na origem.
 */
export function iaPodeSerFonte(campo: string, procedencia: Procedencia): boolean {
  const inferidoPelaIA = procedencia.origem === "zion" && procedencia.metodo !== "calculo";
  if (!inferidoPelaIA) return true;
  return !campoCriticoDoCatalogo(campo);
}
