// O estado de uma leitura assíncrona, explícito.
//
// O DEFEITO QUE ISTO CORRIGE
//
// `useLiveQuery` gravava `{ data: null, carregando: false }` no `catch` — o
// MESMO valor que uma consulta bem-sucedida que não achou nada. Para a tela,
// "o servidor recusou" e "não existe nenhum" eram o mesmo estado, e as duas
// situações pedem coisas opostas do lojista: uma é "tente de novo ou fale com
// alguém", a outra é "cadastre o primeiro".
//
// Foi assim que as migrações 037/038 pendentes ficaram invisíveis por dias: a
// tela lia zero e mostrava vazio.
//
// POR QUE "VAZIO" NÃO PODE SER DECIDIDO PELO HOOK SOZINHO
//
// Vazio depende da FORMA do dado, e a forma é de quem consulta:
//
//   T[]                    vazio é `length === 0`
//   T | null               vazio é `null`
//   number                 ZERO NÃO É VAZIO — é uma resposta
//   { limite, usado }      nunca é vazio; é um objeto que existe
//
// O default abaixo acerta os três primeiros casos e erra de propósito para o
// lado seguro nos objetos: objeto presente é `sucesso`. Quem tiver uma noção
// própria de vazio passa `vazio` e decide.

export type EstadoAssincrono = "carregando" | "sucesso" | "vazio" | "erro";

/**
 * A noção padrão de vazio.
 *
 * `0` e `false` NÃO são vazios: são respostas. Confundi-los com ausência é o
 * mesmo erro que este módulo existe para corrigir, uma camada abaixo — "zero
 * produtos sem custo" é uma boa notícia, não uma tela em branco.
 */
export function estaVazio(dado: unknown): boolean {
  if (dado === null || dado === undefined) return true;
  if (Array.isArray(dado)) return dado.length === 0;
  if (typeof dado === "string") return dado.trim() === "";
  if (dado instanceof Map || dado instanceof Set) return dado.size === 0;
  return false;
}

/**
 * A ordem das perguntas é a regra, e ela não é comutativa.
 *
 * `carregando` primeiro: enquanto a resposta não chegou, nada mais é verdade.
 *
 * `erro` ANTES de `vazio`: no erro o dado é `null`, e `null` também é vazio
 * pelo default. Se a ordem invertesse, todo erro apareceria como vazio — que é
 * exatamente o defeito original, reconstruído dentro da correção.
 */
export function classificarEstado(entrada: {
  carregando: boolean;
  erro: unknown;
  dado: unknown;
  vazio?: (dado: unknown) => boolean;
}): EstadoAssincrono {
  if (entrada.carregando) return "carregando";
  if (entrada.erro !== null && entrada.erro !== undefined) return "erro";
  const éVazio = entrada.vazio ?? estaVazio;
  return éVazio(entrada.dado) ? "vazio" : "sucesso";
}

/**
 * Normaliza o que veio de um `catch` para `Error`.
 *
 * `throw "texto"` e `throw { code: 42 }` são legais em JavaScript e chegam aqui.
 * A tela precisa de `.message` para ter o que dizer, e `String(erro)` num objeto
 * produz "[object Object]" — que é pior que não mostrar nada, porque parece
 * mensagem.
 */
export function comoErro(bruto: unknown): Error {
  if (bruto instanceof Error) return bruto;
  if (typeof bruto === "string" && bruto.trim() !== "") return new Error(bruto);
  if (bruto && typeof bruto === "object") {
    const m = (bruto as { message?: unknown }).message;
    if (typeof m === "string" && m.trim() !== "") return new Error(m);
  }
  return new Error("Não consegui carregar estes dados.");
}
