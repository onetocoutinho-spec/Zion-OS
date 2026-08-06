// "the client_id does not match the original", em inglês, num box vermelho.
//
// ===========================================================================
// O QUE A LOJISTA VIA
// ===========================================================================
//
// Em Precificação e em Vendas, 06/08/2026:
//
//     Falha ao renovar token do ML: the client_id does not match the original
//
// Três problemas numa frase: está em inglês, é prosa de máquina, e não oferece
// caminho nenhum. A Vendas ainda mostrava "Nenhuma venda nos últimos 30 dias"
// logo acima — uma AFIRMAÇÃO falsa, porque ninguém conseguiu perguntar ao ML.
//
// ===========================================================================
// A CORREÇÃO JÁ EXISTIA — SÓ QUE EM UM LUGAR
// ===========================================================================
//
// `/api/ml/publicar` já classificava a recusa pelo HTTP (4xx = a credencial não
// vale; 5xx = o ML está fora) e devolvia 409 com `motivo: "reconectar"`, que a
// tela de publicação converte em "Reconectar agora". Estava certo, e estava em
// UMA das nove rotas que renovam token.
//
// As outras oito faziam `catch (e) { e.message }` e despejavam a prosa do ML.
// Este módulo é aquele acerto virado peça compartilhada — e o que existe aqui é
// o JULGAMENTO (quem é a culpa, e o que a lojista lê), não o transporte.

/** O que o servidor devolve quando a credencial do canal foi recusada. */
export interface RespostaDeReconexao {
  erro: string;
  motivo: "reconectar";
  detalhe: string;
}

/**
 * O corpo do 409 — a frase que a lojista lê, no lugar da prosa do ML.
 *
 * `detalhe` carrega a mensagem original: ela não vai para o box, mas serve ao
 * suporte e ao log. Guardar a causa e não exibi-la é diferente de descartá-la.
 *
 * `oQueFalhou` é o que ela estava tentando fazer ("consultar suas vendas"),
 * porque a mesma credencial morta impede coisas diferentes em telas diferentes
 * — e a frase tem que explicar por que ESTA tela parou.
 */
export function respostaDeReconexao(
  marketplace: string,
  oQueFalhou: string,
  detalhe: string
): RespostaDeReconexao {
  return {
    erro: `O ${marketplace} recusou a credencial salva desta conta. Reconecte a conta para ${oQueFalhou}.`,
    motivo: "reconectar",
    detalhe,
  };
}

/**
 * Esta resposta do servidor é um pedido de reconexão?
 *
 * O lado do navegador pergunta isto para trocar o box vermelho por um aviso com
 * saída. A chave é o `motivo`, e só ele: casar por texto da mensagem faria a
 * detecção quebrar na primeira vez que alguém melhorasse a frase.
 */
export function pedeReconexao(corpo: unknown): corpo is RespostaDeReconexao {
  return (
    typeof corpo === "object" &&
    corpo !== null &&
    (corpo as { motivo?: unknown }).motivo === "reconectar"
  );
}

/**
 * O erro que o lado do navegador levanta — identificável por `instanceof`.
 *
 * Existe para a tela poder decidir SEM ler texto: um `catch (e)` que precisasse
 * procurar "reconecte" na mensagem voltaria a acoplar comportamento a prosa.
 */
export class ReconectarCanalError extends Error {
  /** A mensagem crua do ML, para log e suporte — nunca para a tela. */
  readonly detalhe: string;
  constructor(mensagem: string, detalhe = "") {
    super(mensagem);
    this.name = "ReconectarCanalError";
    this.detalhe = detalhe;
  }
}
