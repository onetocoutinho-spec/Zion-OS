// Quem pode convidar quem — a decisão PURA de `/api/usuarios`.
//
// ===========================================================================
// O QUE ESTAVA TRANCADO, E POR QUE ISSO CONTRADIZIA O PRODUTO
// ===========================================================================
//
// `/api/usuarios` exigia `equipe`. Consequência: uma conta de loja era
// MONOUSUÁRIO. Quem se cadastra sozinho em `/api/loja/provisionar` ganha um
// acesso — o dele — e a segunda pessoa da loja virava um chamado para a Zion.
//
// O Zion OS é vendido a "lojas com equipe própria". A primeira coisa que uma
// loja com equipe pede é um acesso para o funcionário, e era justamente essa
// que o produto não sabia dar sozinho.
//
// ===========================================================================
// A ARMADILHA: DESTRANCAR NÃO É TIRAR O `exigirEquipe`
// ===========================================================================
//
// Hoje a rota confia no `clienteId` que vem NO CORPO. Ela pode, porque só
// equipe chega lá. Abrir para o lojista sem mexer nisso seria a mesma
// vulnerabilidade que a migração 055 existe para não repetir:
//
//     qualquer pessoa criaria um acesso em QUALQUER loja, trocando um
//     parâmetro do corpo da requisição.
//
// O corpo não afirma a loja. Quem diz de qual loja se trata é o PERFIL do
// autor, lido no servidor. Se o corpo mencionar outra, a resposta é 403 e não
// um silencioso "usei a sua mesmo" — recusar é mais barulhento, e barulho no
// lugar certo é o que faz alguém olhar.
//
// ===========================================================================
// A REGRA QUE NÃO PODE CAIR
// ===========================================================================
//
// Só `equipe` cria `equipe`. Sem isso, um lojista se promove a equipe num
// convite e passa a enxergar as lojas de todos os outros assinantes — que é
// exatamente o vazamento que a 054 descreve ao explicar por que uma agência
// não podia receber o papel `equipe`.

import type { PapelPerfil } from "@/lib/auth/roteamentoPapel";

/** O perfil de quem está convidando, lido no servidor. Nunca do corpo. */
export interface AutorDoConvite {
  papel: PapelPerfil;
  clienteId: string | null;
  agenciaId: string | null;
}

/** O que o corpo pediu — já validado por `validarPayloadNovoUsuario`. */
export interface PedidoDeConvite {
  papel: PapelPerfil;
  clienteId: string | null;
  agenciaId: string | null;
}

/** O vínculo EFETIVO do perfil que vai nascer. É isto que a rota usa. */
export interface AlvoDoConvite {
  papel: PapelPerfil;
  clienteId: string | null;
  agenciaId: string | null;
}

export type DecisaoDeConvite =
  | { ok: true; alvo: AlvoDoConvite }
  | { ok: false; status: 403; motivo: string };

/** A recusa é sempre a mesma frase: separar os casos ensina o que se acertou. */
const NEGADO = "Sem permissão para criar este acesso.";

/**
 * Decide o vínculo do convite. Puro.
 *
 * `equipe` segue com liberdade total — o comportamento anterior, byte a byte.
 * `cliente` só convida para a PRÓPRIA loja, e a loja vem do perfil.
 */
export function decidirConvite(
  autor: AutorDoConvite,
  pedido: PedidoDeConvite
): DecisaoDeConvite {
  // Só equipe cria equipe. Antes de qualquer outra regra, porque é a única
  // cujo erro não estraga dado — abre o banco inteiro.
  if (pedido.papel === "equipe" && autor.papel !== "equipe") {
    return { ok: false, status: 403, motivo: NEGADO };
  }

  if (autor.papel === "equipe") {
    return { ok: true, alvo: { ...pedido } };
  }

  if (autor.papel === "cliente") {
    // A loja convida para dentro de si mesma, e só isso.
    if (pedido.papel !== "cliente") {
      return { ok: false, status: 403, motivo: NEGADO };
    }
    // Perfil de lojista sem loja é perfil incompleto — não convida ninguém.
    if (!autor.clienteId) {
      return { ok: false, status: 403, motivo: NEGADO };
    }
    // O corpo NÃO escolhe a loja. Se ele nomeou outra, isso é uma tentativa,
    // não um engano de digitação: recusa.
    if (pedido.clienteId && pedido.clienteId !== autor.clienteId) {
      return { ok: false, status: 403, motivo: NEGADO };
    }
    if (pedido.agenciaId) {
      return { ok: false, status: 403, motivo: NEGADO };
    }
    // A loja vem do PERFIL mesmo quando o corpo mandou a mesma — o valor usado
    // nunca é o que o navegador disse.
    return { ok: true, alvo: { papel: "cliente", clienteId: autor.clienteId, agenciaId: null } };
  }

  // `agencia` ainda não convida. É a próxima fatia, e falhar fechado enquanto
  // isso é o comportamento que ela já tinha.
  return { ok: false, status: 403, motivo: NEGADO };
}
