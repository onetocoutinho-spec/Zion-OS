// A tela "Custos da loja" — puro, sem React, sem rede.
//
// Responde três perguntas por produto: este custo é confiável (confirmado),
// falta (ausente) ou está em disputa (conflito)? A regra que já vale na
// operação é "custo em dúvida vira pendência, não vira preço" — este módulo é
// o que decide QUANDO um custo está em dúvida, e o que fazer quando alguém
// resolve a dúvida.
//
// Conflito é PRIMEIRA CLASSE aqui, não um subcaso de anomalia: enquanto uma
// pendência (`custo_pendencias`, migração 087) estiver aberta para o produto,
// o estado é "conflito" e prevalece sobre confirmado/ausente — mesmo que
// `produtos.custo` já tenha um número, ele não é a resposta ainda.

import type { Procedencia } from "./procedenciaDeCampo";
import { procedenciaDesconhecida } from "./procedenciaDeCampo";

export type EstadoDoCusto = "ausente" | "confirmado" | "conflito";

/**
 * Um valor em disputa e de onde ele veio, na voz de quem vai decidir.
 *
 * O campo é `custo`, não `valor` — a MESMA forma de `AmbiguidadeCusto`
 * (`importacaoCustos.ts`), para a importação gravar direto, sem tradução.
 */
export interface CandidatoDeCusto {
  custo: number;
  origem: string;
}

export interface LinhaDeCusto {
  produtoId: string;
  nome: string;
  sku: string;
  custo: number;
  /** Para a edição inline aplicar a mesma recusa de referência de modelo do resto do sistema. */
  precoVenda: number;
  estado: EstadoDoCusto;
  /** De onde veio o `custo` de hoje. `procedenciaDesconhecida()` quando não há registro. */
  fonte: Procedencia;
  /** ISO do registro de procedência mais recente. `null` = não registrado. */
  atualizadoEm: string | null;
  /** Quantas variações existem para este produto — hoje todas herdam (ver ADR da 2b). */
  skusHerdando: number;
  /** Presente só quando `estado === "conflito"`. Duas ou mais entradas, sempre. */
  candidatos?: readonly CandidatoDeCusto[];
}

/**
 * O estado de um custo, dados o valor gravado e se há disputa aberta.
 *
 * A pendência aberta MANDA: um produto com `custo > 0` mas com disputa aberta
 * não é "confirmado" — o número que está lá pode não ser nenhum dos que
 * disputam, ou pode ser um deles por acaso, e nenhum dos dois casos é
 * confiança. "Custo em dúvida vira pendência, não vira preço."
 */
export function estadoDoCusto(custo: number, temPendenciaAberta: boolean): EstadoDoCusto {
  if (temPendenciaAberta) return "conflito";
  return custo > 0 ? "confirmado" : "ausente";
}

export interface DadosDoProdutoParaLinha {
  produtoId: string;
  nome: string;
  sku: string;
  custo: number;
  precoVenda: number;
  /** Total de variações do produto (SKUs). */
  totalVariantes: number;
  /** A procedência mais recente registrada para o campo custo. Ausente = não registrada. */
  fonte?: Procedencia;
  /** A pendência aberta deste produto, quando há uma. */
  pendenciaAberta?: { candidatos: readonly CandidatoDeCusto[] } | null;
}

/** Monta uma linha da tabela a partir dos dados já lidos (produto + fonte + pendência). */
export function montarLinhaDeCusto(p: DadosDoProdutoParaLinha): LinhaDeCusto {
  const estado = estadoDoCusto(p.custo, Boolean(p.pendenciaAberta));
  const fonte = p.fonte ?? procedenciaDesconhecida();
  return {
    produtoId: p.produtoId,
    nome: p.nome,
    sku: p.sku,
    custo: p.custo,
    precoVenda: p.precoVenda,
    estado,
    fonte,
    atualizadoEm: fonte.momento,
    skusHerdando: p.totalVariantes,
    ...(p.pendenciaAberta ? { candidatos: p.pendenciaAberta.candidatos } : {}),
  };
}

/**
 * A ordem padrão: o que precisa de decisão primeiro. Conflito antes de
 * ausente — uma disputa já tem candidatos e contexto para decidir agora; um
 * ausente só tem uma lacuna. Confirmado por último, porque não pede nada.
 * Dentro do mesmo estado, por nome — para a lista não pular a cada
 * recarregamento.
 */
const PESO_DO_ESTADO: Record<EstadoDoCusto, number> = { conflito: 0, ausente: 1, confirmado: 2 };

export function ordenarLinhasDeCusto(linhas: readonly LinhaDeCusto[]): LinhaDeCusto[] {
  return [...linhas].sort((a, b) => {
    const peso = PESO_DO_ESTADO[a.estado] - PESO_DO_ESTADO[b.estado];
    return peso !== 0 ? peso : a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export interface PlanoDeResolucao {
  valorEscolhido: number;
  /** Os candidatos que NÃO venceram — congelados para a pendência virar histórico. */
  descartados: readonly CandidatoDeCusto[];
}

/**
 * O que gravar quando uma pendência é resolvida com `valorEscolhido`.
 *
 * `valorEscolhido` não precisa ser um dos candidatos: quem decide pode saber
 * que nenhuma das fontes está certa e digitar um quarto número. Nesse caso
 * TODOS os candidatos são descartados — o que é a verdade: nenhum deles
 * venceu.
 *
 * A comparação é por VALOR, não por identidade do objeto: duas fontes podem
 * coincidir no número sem ser a mesma entrada, e as duas "venceram" se o
 * escolhido é esse número.
 */
export function planoDeResolucao(
  candidatos: readonly CandidatoDeCusto[],
  valorEscolhido: number
): PlanoDeResolucao {
  return {
    valorEscolhido,
    descartados: candidatos.filter((c) => c.custo !== valorEscolhido),
  };
}

/**
 * Lê `candidatos` como veio do jsonb — defensivo, porque o CHECK do banco só
 * garante "array com 2+ elementos", não a forma de cada um.
 *
 * Devolve só as entradas com `custo` numérico finito e `origem` textual;
 * silenciosamente descarta o resto. Uma entrada malformada não pode derrubar
 * a tela inteira — ela já é a tela que existe para mostrar problema de dado.
 */
export function candidatosValidos(bruto: unknown): CandidatoDeCusto[] {
  if (!Array.isArray(bruto)) return [];
  const validos: CandidatoDeCusto[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.custo === "number" && Number.isFinite(o.custo) && typeof o.origem === "string") {
      validos.push({ custo: o.custo, origem: o.origem });
    }
  }
  return validos;
}
