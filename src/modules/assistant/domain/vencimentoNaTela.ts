// INC-006 — o cartão vencido para de oferecer o botão.
//
// ===========================================================================
// POR QUE ISTO EXISTE, DEPOIS DE O INC-006 TER DECIDIDO NÃO CORRIGIR
// ===========================================================================
//
// O INC-006 registrou a limitação e explicou a recusa por CUSTO: a correção
// exigiria `expiraEm` no wire (rota + tipo + parse), o turno guardando o campo,
// e um estado novo em cinco máquinas de cartão. "O risco da mudança é maior que
// o do defeito."
//
// Essa conta estava errada. As cinco máquinas começam todas pela MESMA linha:
//
//     if (desfecho) return { estado: "concluido", ok, mensagem };
//
// Ou seja: a interface JÁ sabe desenhar "este cartão acabou, eis o motivo, sem
// botão". É exatamente o estado que o servidor produz depois do clique. E o
// padrão de desfecho sintético já existia — o descarte usa um
// ("Descartado. Nada foi gravado.").
//
// Então não é preciso wire, nem campo novo no protocolo, nem estado novo em
// máquina nenhuma. Basta o turno saber QUANDO chegou.
//
// ===========================================================================
// POR QUE UM RELÓGIO DE CLIENTE NÃO É UMA BARREIRA FALSA
// ===========================================================================
//
// O INC-006 já tinha desenhado a regra: relógio do cliente serve para UX, nunca
// como barreira. Aqui ela é respeitada com uma propriedade que dá para provar.
//
// `chegouEm` é o instante em que a RESPOSTA chegou ao navegador. A proposta
// nasceu ANTES disso, no servidor — a latência é sempre positiva. Logo:
//
//     chegouEm            >=  criadaEm
//     chegouEm + 30min    >=  criadaEm + 30min  =  expiraEm
//
// O relógio da tela vence SEMPRE em cima da hora ou DEPOIS, nunca antes. O erro
// possível é deixar o botão visível um instante a mais — e aí o servidor
// recusa, como sempre fez. O erro impossível é esconder um botão ainda válido.
//
// Nada aqui cancela, muda status ou escreve. Detectar não tem efeito colateral.

import { MINUTOS_ATE_EXPIRAR, explicarImpedimento } from "./propostaPersistida";

/**
 * A MESMA frase que o servidor devolve ao recusar por validade.
 *
 * Reusada, e não reescrita: duas redações para o mesmo fato ensinariam ao
 * lojista que são dois problemas diferentes.
 */
export const MENSAGEM_VENCIDO = explicarImpedimento({ motivo: "expirada" });

/**
 * O desfecho sintético de um cartão que passou da validade — ou `undefined`
 * quando ele ainda vale, ou quando não se sabe a hora de chegada.
 *
 * `undefined` para chegada desconhecida é deliberado: um turno RETOMADO do
 * disco não tem carimbo. Ele também não tem proposta (`paraGuardar` a exclui),
 * então não tem botão — mas se um dia tiver, o certo é não afirmar vencimento
 * sobre um instante que ninguém mediu.
 */
export function desfechoPorVencimento(
  chegouEm: number | undefined,
  agora: number
): { ok: false; mensagem: string } | undefined {
  if (chegouEm === undefined) return undefined;
  if (agora - chegouEm < MINUTOS_ATE_EXPIRAR * 60_000) return undefined;
  return { ok: false, mensagem: MENSAGEM_VENCIDO };
}
