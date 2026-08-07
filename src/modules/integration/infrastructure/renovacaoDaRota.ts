// A renovação de token, com o mesmo desfecho nas nove rotas.
//
// Oito das nove rotas que renovam token faziam a chamada solta:
//
//     const tokens = await renovarToken({ clientId, clientSecret, refreshToken });
//
// Quando o ML recusava, a exceção caía no catch genérico da rota e virava um
// 502 com a prosa dele em inglês. `/api/ml/publicar` era a única que separava
// "a credencial não vale" de "o ML está fora" — e essa separação não é detalhe
// de implementação, é a diferença entre mandar a lojista reconectar (resolve) e
// mandá-la reconectar à toa quando o problema é do outro lado (não resolve, e
// custa a ela o login inteiro do Mercado Livre).
//
// Este módulo é aquele acerto virado peça única. A classificação continua sendo
// pelo HTTP do ML (`RenovacaoRecusadaError.credencialRecusada`), nunca pela
// mensagem: prosa muda, código de status não.

import { renovarToken, RenovacaoRecusadaError } from "@/lib/marketplaces/mercadolivre";
import { respostaDeReconexao } from "../domain/credencialRecusada";

type Tokens = Awaited<ReturnType<typeof renovarToken>>;

/**
 * Renova — ou devolve, pronta, a resposta que pede reconexão.
 *
 * O retorno é uma união em vez de uma exceção de propósito: a rota escreve
 * `if ("recusa" in r) return r.recusa;` e o desvio fica VISÍVEL na leitura,
 * em vez de depender de um catch lá embaixo que ninguém lembra que existe.
 *
 * 5xx e falha de rede continuam subindo: quando o problema é do ML ou da
 * conexão, ninguém sabe nada sobre a validade da credencial, e afirmar que ela
 * morreu seria inventar. Esses seguem para o catch genérico, como antes.
 *
 * @param oQueFalhou o que a lojista estava tentando fazer, para a frase dizer
 *   por que ESTA tela parou ("consultar suas vendas", "publicar").
 */
export async function renovarTokenDaRota(args: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  marketplace: string;
  oQueFalhou: string;
}): Promise<{ tokens: Tokens } | { recusa: Response }> {
  try {
    const tokens = await renovarToken({
      clientId: args.clientId,
      clientSecret: args.clientSecret,
      refreshToken: args.refreshToken,
    });
    return { tokens };
  } catch (e) {
    if (!(e instanceof RenovacaoRecusadaError) || !e.credencialRecusada) throw e;
    return {
      recusa: Response.json(
        respostaDeReconexao(args.marketplace, args.oQueFalhou, e.message),
        // 409 e não 401: a requisição está autenticada no Zion. Quem recusou foi
        // o marketplace, e o conflito é de ESTADO — a credencial guardada não
        // serve mais. Um 401 faria o cliente tentar renovar a sessão do Zion.
        { status: 409 }
      ),
    };
  }
}
