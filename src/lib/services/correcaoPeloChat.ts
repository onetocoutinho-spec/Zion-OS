// A execução de uma proposta que alguém já leu e confirmou.
//
// Este arquivo é a única porta do chat para a escrita, e ele só aceita uma
// `Proposta` do tipo "pronta" — a estrutura que `propostaDeCorrecao` monta e
// que a tela mostrou por inteiro antes de alguém clicar. Não há caminho daqui
// para uma frase solta: o texto do cliente nunca chega até aqui.
//
// ASSIMETRIA DECLARADA, e não disfarçada:
//
//   custo  -> `atualizarProduto`, que observa a AIL (campos observados)
//   peso   -> `definirPesoDosProdutos` -> `atualizarVariantesBulk`, que vai
//             direto ao repositório e a AIL NÃO VÊ
//
// Isso é anterior a este chat: a tela de peso grava do mesmo jeito cego desde
// sempre. O chat não piora nem melhora — é mais uma porta para a mesma escrita.
// Fazer a AIL enxergar peso é mexer na superfície de entrada dela, e a AIL não
// se mexe sem autorização explícita. Fica registrado aqui para não virar
// descoberta arqueológica depois.

import { definirPesoDosProdutos } from "./pesoDeProduto";
import { atualizarProduto } from "./produtos";
import type { Proposta } from "../../modules/assistant/domain/propostaDeCorrecao";

export interface ResultadoDaCorrecao {
  ok: boolean;
  /** O que dizer a quem confirmou. Sempre no passado — já aconteceu. */
  mensagem: string;
  /** Verdadeiro quando a AIL não enxergou esta gravação. */
  cegoParaAIL: boolean;
}

/**
 * Executa a proposta. Só a "pronta" — o tipo garante isso no compilador.
 *
 * Recebe a proposta inteira, não os campos soltos: montar de novo aqui a partir
 * de pedaços seria abrir a chance de gravar algo diferente do que a pessoa leu
 * na tela, que é o único jeito de a confirmação virar teatro.
 */
export async function executarProposta(
  clienteId: string,
  proposta: Extract<Proposta, { tipo: "pronta" }>
): Promise<ResultadoDaCorrecao> {
  if (proposta.campo === "custo") {
    const atualizado = await atualizarProduto(proposta.alvo.id, { custo: proposta.valor });
    if (!atualizado) {
      return { ok: false, mensagem: "Não consegui gravar o custo.", cegoParaAIL: false };
    }
    return {
      ok: true,
      mensagem: `Pronto. ${proposta.alvo.nome} agora custa ${proposta.valorEscrito}.`,
      cegoParaAIL: false,
    };
  }

  const r = await definirPesoDosProdutos(clienteId, [proposta.alvo.id], {
    pesoGramas: proposta.valor,
  });
  if (r.variantes === 0) {
    // Zero variantes é recusa do domínio, não sucesso silencioso. Dizer
    // "pronto" aqui deixaria a pessoa sair achando que resolveu.
    return {
      ok: false,
      mensagem: "Não consegui gravar o peso — nenhuma variação foi encontrada.",
      cegoParaAIL: true,
    };
  }
  return {
    ok: true,
    mensagem:
      `Pronto. ${proposta.valorEscrito} gravados em ${proposta.alvo.nome}` +
      (r.variantes > 1 ? ` — ${r.variantes} variações.` : "."),
    cegoParaAIL: true,
  };
}
