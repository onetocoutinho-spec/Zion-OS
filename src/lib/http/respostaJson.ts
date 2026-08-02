// Ler JSON de uma resposta que pode não ser JSON.
//
// ===========================================================================
// O CASO
// ===========================================================================
//
// 02/08/2026, na tela da lojista:
//
//     Unexpected token '<', "<!DOCTYPE "... is not valid JSON
//
// Isso é `.json()` recebendo HTML. Acontece quando a plataforma responde no
// lugar da aplicação — 504 por tempo esgotado, 502 de gateway, página de erro
// do host. Todas devolvem HTML, e todas produzem EXATAMENTE esta mensagem.
//
// O problema não é o erro: é que a mensagem não diz QUAL rota, QUAL status,
// nem que a resposta veio da plataforma e não do nosso código. Quem lê fica
// procurando bug de parsing onde há bug de tempo.
//
// Mesma família dos defeitos mudos do dia: a informação existia (status,
// content-type, corpo) e a mensagem não a carregava.

/** O primeiro pedaço do corpo, para a mensagem dizer o que veio. */
function amostra(texto: string): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > 80 ? `${limpo.slice(0, 80)}…` : limpo;
}

/**
 * Lê o JSON — ou explica o que veio no lugar dele.
 *
 * `onde` é o nome da rota, e entra na mensagem porque uma tela que faz cinco
 * chamadas precisa dizer qual delas quebrou.
 *
 * Não decide se a resposta é um erro: um 422 com JSON é lido normalmente e
 * quem chamou trata. Aqui só se resolve "isto é JSON?".
 */
export async function lerJson<T>(resposta: Response, onde: string): Promise<T> {
  const tipo = resposta.headers.get("content-type") ?? "";
  const texto = await resposta.text();

  if (tipo.includes("json")) {
    try {
      return JSON.parse(texto) as T;
    } catch {
      throw new Error(
        `${onde} respondeu ${resposta.status} dizendo ser JSON, mas o corpo não é: ${amostra(texto)}`
      );
    }
  }

  // Corpo vazio com status de erro: a plataforma cortou sem dizer nada.
  if (!texto.trim()) {
    throw new Error(`${onde} respondeu ${resposta.status} sem conteúdo.`);
  }

  // HTML é quase sempre a plataforma respondendo no lugar da aplicação. O
  // 504 tem nome próprio porque a ação é outra: não é erro de dado, é a
  // operação sendo grande demais para o tempo disponível.
  if (/^\s*<(!doctype|html)/i.test(texto)) {
    const motivo =
      resposta.status === 504 || resposta.status === 408
        ? "a operação passou do tempo limite do servidor"
        : `a plataforma respondeu ${resposta.status} no lugar da aplicação`;
    throw new Error(`${onde}: ${motivo}. Tente de novo; se repetir, é preciso dividir o trabalho.`);
  }

  throw new Error(`${onde} respondeu ${resposta.status} em ${tipo || "formato desconhecido"}: ${amostra(texto)}`);
}
