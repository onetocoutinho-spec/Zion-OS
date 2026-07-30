// O escopo de uma resolução em lote — e por que ele CONGELA.
//
// "Essas Havaianas usam 420 g embaladas" é a frase que transforma 47 perguntas
// em uma. É também a frase que, mal resolvida, grava 420 g em 47 produtos
// errados de uma vez.
//
// A REGRA CENTRAL:
//
//     o escopo aprovado é o que executa — nem mais, nem menos
//
// Se o lojista aprovou 47 variantes e no momento da execução existirem 48, a
// 48ª NÃO entra. Ela não foi mostrada, não foi lida e não foi aprovada. O
// contrário — "aplicar ao filtro" em vez de "aplicar à lista" — faz o escopo
// crescer entre a leitura e o clique, e ninguém percebe.
//
// Por isso a proposta guarda IDS, nunca um critério. Um critério é uma
// promessa sobre o futuro; uma lista é um fato sobre o presente.
//
// A SEGUNDA REGRA, que evita o estrago silencioso:
//
//     quem já tem valor não é tocado
//
// Aplicar em massa sobre quem já tem dado sobrescreve trabalho anterior — e o
// trabalho anterior costuma ser mais confiável que a generalização de agora.
// Esses ficam de fora e são CONTADOS, para a frase poder dizer "3 já têm peso
// e não vou mexer".

import type { ProdutoAlvo } from "./propostaDeCorrecao";

/** Um alvo possível do lote, com o que decide se ele entra. */
export interface CandidatoAoLote {
  id: string;
  nome: string;
  /** Quantas unidades este alvo representa — variações, para o peso. */
  unidades: number;
  /** Quantas delas ainda estão SEM o dado que o lote quer preencher. */
  unidadesSemDado: number;
  /** O valor atual do campo, quando ele é do produto pai (custo). */
  valorAtual: number | null;
}

export type CampoDoLote = "peso" | "custo";

export interface EscopoDoLote {
  /** Os que RECEBEM a mudança. É esta lista que vira `alvos` da Proposal. */
  incluidos: readonly CandidatoAoLote[];
  /** Os que ficam de fora por JÁ TEREM o dado. Contados, não escondidos. */
  jaTemDado: readonly CandidatoAoLote[];
  /** Quantas unidades serão realmente tocadas. */
  unidadesAfetadas: number;
  /** A frase que a pessoa lê antes de aprovar. */
  resumo: string;
}

/**
 * Monta o escopo a partir dos candidatos e do campo.
 *
 * Não filtra por similaridade nem por "parece da mesma família": recebe os
 * candidatos já resolvidos e decide apenas QUEM ESTÁ FALTANDO o dado. Julgar
 * pertencimento a partir do nome é o tipo de inferência que vira identidade
 * errada, e identidade errada em lote é o pior estrago possível.
 */
export function montarEscopo(
  campo: CampoDoLote,
  candidatos: readonly CandidatoAoLote[],
  valor: number,
  comoEscrever: (v: number) => string
): EscopoDoLote {
  const precisa = (c: CandidatoAoLote): boolean =>
    campo === "custo" ? !c.valorAtual || c.valorAtual <= 0 : c.unidadesSemDado > 0;

  const incluidos = candidatos.filter(precisa);
  const jaTemDado = candidatos.filter((c) => !precisa(c));
  const unidadesAfetadas = incluidos.reduce(
    (soma, c) => soma + (campo === "custo" ? 1 : c.unidadesSemDado),
    0
  );

  return {
    incluidos,
    jaTemDado,
    unidadesAfetadas,
    resumo: frase(campo, incluidos.length, unidadesAfetadas, jaTemDado.length, valor, comoEscrever),
  };
}

function frase(
  campo: CampoDoLote,
  quantos: number,
  unidades: number,
  deFora: number,
  valor: number,
  comoEscrever: (v: number) => string
): string {
  if (quantos === 0) {
    return `Nenhum dos produtos que encontrei está sem ${campo}. Não há o que aplicar.`;
  }
  const alvo =
    campo === "custo"
      ? `${quantos} produto${quantos > 1 ? "s" : ""}`
      : `${unidades} variaç${unidades > 1 ? "ões" : "ão"} de ${quantos} produto${quantos > 1 ? "s" : ""}`;
  const ressalva =
    deFora > 0
      ? ` ${deFora} produto${deFora > 1 ? "s já têm" : " já tem"} ${campo} e não ${deFora > 1 ? "serão alterados" : "será alterado"}.`
      : "";
  return `Aplicar ${comoEscrever(valor)} de ${campo} a ${alvo}.${ressalva}`;
}

/**
 * O escopo continua o mesmo?
 *
 * Chamada na execução, com os alvos relidos do banco. Compara a LISTA APROVADA
 * com quem ainda precisa do dado — em conjunto, não em contagem: 47 e 47 pode
 * ser um trocado por outro, e trocar um alvo é tão grave quanto acrescentar.
 *
 * Devolve o que saiu (alguém preencheu no meio-tempo) e o que sobrou. Nunca
 * inclui quem entrou depois: a Proposal executa a lista aprovada e ponto.
 */
export function escopoAindaVale(
  alvosAprovados: readonly string[],
  aindaPrecisam: readonly string[]
): { vale: boolean; saíram: string[]; restantes: string[] } {
  const precisam = new Set(aindaPrecisam);
  const restantes = alvosAprovados.filter((id) => precisam.has(id));
  const saíram = alvosAprovados.filter((id) => !precisam.has(id));
  return { vale: saíram.length === 0, saíram, restantes };
}

/** Converte candidatos em `ProdutoAlvo` — a ponte com o catálogo já carregado. */
export function candidatosDoCatalogo(
  produtos: readonly ProdutoAlvo[],
  ids: readonly string[]
): CandidatoAoLote[] {
  const querido = new Set(ids);
  return produtos
    .filter((p) => querido.has(p.id))
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      unidades: p.quantidadeVariantes,
      unidadesSemDado: p.variacoesSemPeso,
      valorAtual: p.custo > 0 ? p.custo : null,
    }));
}
