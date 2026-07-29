// O que cada tipo de proposta precisa vigiar.
//
// Puro, e deliberadamente pequeno. É a resposta a uma pergunta única:
//
//     que pedaço do mundo, se mudar, invalida esta proposta?
//
// Vigiar DEMAIS torna o sistema irritante — uma proposta de peso morreria
// porque alguém corrigiu a descrição. Vigiar DE MENOS é o defeito perigoso: a
// proposta executa sobre um estado que já não existe.
//
// O corte é por CONSEQUÊNCIA. Uma proposta de custo depende do custo atual
// porque o resumo que a pessoa leu dizia "de R$ 17,16 para R$ 24,90" — se o
// primeiro número mudou, ela aprovou uma frase que ficou falsa.
//
// Uma proposta de peso depende de QUANTAS variações estão sem peso, e não do
// peso de cada uma: o que a pessoa aprovou foi um escopo ("todas as 12"), e é
// o escopo que não pode mudar por baixo. Esta é a mesma distinção do INC-001 —
// completude não é o mesmo que ter algum valor.

import type { Precondicao, TipoDeProposta } from "./propostaPersistida";

/** O estado do produto no instante em que a proposta é montada. */
export interface EstadoParaPrecondicao {
  /** Custo atual do produto pai. `null` quando não há. */
  custo: number | null;
  /** Quantas variações estão sem peso agora. */
  variacoesSemPeso: number;
}

/**
 * As precondições de uma proposta deste tipo, lidas do estado de agora.
 *
 * Devolve lista, não objeto, porque a ordem importa para a mensagem: quando
 * várias quebram, a primeira é a que a explicação cita primeiro.
 */
export function precondicoesDaProposta(
  tipo: TipoDeProposta,
  estado: EstadoParaPrecondicao
): Precondicao[] {
  if (tipo === "custo") {
    // O custo ANTERIOR é o que a frase mostrou. Mudou, a frase mentiu.
    return [{ campo: "custo", valorNaCriacao: estado.custo }];
  }
  // Peso: o ESCOPO aprovado. "Todas as 12 variações" com 12 sem peso é
  // diferente de "todas as 12" com 8 — mesmo texto, outro efeito.
  return [{ campo: "variacoesSemPeso", valorNaCriacao: estado.variacoesSemPeso }];
}
