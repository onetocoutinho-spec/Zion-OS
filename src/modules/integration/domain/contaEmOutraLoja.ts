// A conta do marketplace que já pertence a outra loja (migração 076).
//
// ===========================================================================
// POR QUE ESTE MÓDULO EXISTE, E NÃO UM `throw new Error` NA HORA
// ===========================================================================
//
// `salvarRefreshTokenServidor` faz `throw new Error(error.message)` com o que o
// Postgres devolveu. E `respostaDeErro` — a regra ZION-API-001 — trata `Error`
// solto como mensagem de TERCEIRO: ela vai para o `console.error` do servidor e
// o navegador recebe a frase genérica da rota.
//
// O efeito, sem este módulo: a lojista clica em Conectar, o banco recusa por um
// motivo que ela pode resolver sozinha ("a conta está na outra loja"), e ela lê
// "Falha ao conectar com o Mercado Livre." O motivo fica num log que ela não
// abre.
//
// O próprio `respostaDeErro` diz o que fazer: "Um `new Error(...)` solto é
// tratado como de terceiro mesmo que seja nosso: se a mensagem é para a pessoa,
// ela merece uma classe que diga isso."
//
// Esta é a classe. O nome entra na lista fechada de `respostaDeErro`.
//
// ===========================================================================
// POR QUE O CÓDIGO, E NÃO O TEXTO
// ===========================================================================
//
// O reconhecimento é por `code === "23505"`, não por procurar palavras na
// mensagem. Dois caminhos levantam esse código e os dois querem a mesma
// resposta:
//
//   * `ml_credencial_gravar` recusando de propósito, com a frase que nomeia a
//     outra loja (076);
//   * o índice `canais_marketplace_conta_ativa_unica` disparando sozinho, se
//     alguém chegar à tabela por fora da função.
//
// No primeiro caso a frase do banco é boa e é ela que a pessoa lê. No segundo
// não há frase — e o texto padrão daqui cobre o buraco sem mentir sobre o que
// se sabe.

/** O erro que a pessoa lê. O `name` é o que `respostaDeErro` reconhece. */
export class ContaEmOutraLojaError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ContaEmOutraLojaError";
  }
}

/** O marcador que `ml_credencial_gravar` põe na frente da frase dela (076). */
const MARCADOR = "conta_em_outra_loja:";

/**
 * O que o `supabase-js` devolve em `error`. Só os campos que interessam — o
 * tipo real (`PostgrestError`) traria o SDK para dentro de um módulo de
 * domínio, que é justamente o que a regra do `respostaDeErro` evita.
 */
export interface ErroDoBanco {
  code?: string | null;
  message?: string | null;
}

/** `23505` — unique_violation. O índice e a função levantam o mesmo. */
const UNIQUE_VIOLATION = "23505";

const PADRAO =
  "Esta conta do marketplace já está conectada a outra loja. Uma conta pertence " +
  "a uma loja só — se ela mudou de mãos, desconecte-a na outra loja antes de " +
  "conectá-la aqui.";

/**
 * Traduz o erro do banco, quando ele é este. Puro.
 *
 * Devolve `null` para qualquer outra falha: quem chama segue com o tratamento
 * que já tinha, e nada aqui decide o destino de um erro que não é seu.
 */
export function contaEmOutraLoja(erro: ErroDoBanco | null | undefined): ContaEmOutraLojaError | null {
  if (!erro || erro.code !== UNIQUE_VIOLATION) return null;

  const bruta = (erro.message ?? "").trim();
  const i = bruta.indexOf(MARCADOR);
  // A frase da função vem depois do marcador e nomeia a loja — é melhor que a
  // padrão porque diz ONDE a conta está. Sem marcador, o índice disparou
  // sozinho e ninguém sabe qual é a outra loja: aí a padrão é a frase honesta.
  const doBanco = i >= 0 ? bruta.slice(i + MARCADOR.length).trim() : "";

  return new ContaEmOutraLojaError(doBanco || PADRAO);
}
