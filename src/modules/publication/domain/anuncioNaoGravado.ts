// O anúncio que ficou pronto e não chegou ao banco — puro, sem rede, sem React.
//
// POR QUE ISTO EXISTE
//
// A cadeia guarda cada agente intermediário assim que ele responde
// (`progressoGeracao`), e é por isso que existe "Continuar geração". Mas a
// MONTAGEM FINAL não era guardada em lugar nenhum, e ela é:
//
//   - a chamada mais cara — 27 a 33 s, o dobro de qualquer outra;
//   - a única que produz o anúncio, então sem ela as 9 anteriores não valem nada;
//   - a última, então quem interrompe já esperou dois minutos.
//
// Pior: se `criarAnuncioGerado` falhasse, o erro caía no MESMO catch que trata
// falha de IA. O anúncio existia inteiro na memória — três minutos e cerca de
// dez chamadas pagas — e sumia sem nunca ter sido oferecido de novo, com a
// mensagem "Não foi possível gerar o anúncio agora". Que é falsa: foi gerado.
//
// Medido em 29/07: três gerações registraram `POST /api/agentes/esteira 200` e
// nenhuma linha entrou no banco.
//
// A REGRA
//
// Guardar ANTES de tentar gravar. Trabalho que já custou não pode depender de a
// próxima operação dar certo — a mesma razão de `onEtapaConcluida` existir, um
// passo adiante.

/** Um anúncio montado, esperando gravação. Guardado assim que a IA responde. */
export interface AnuncioPendenteDeGravacao<TAnuncio = unknown> {
  produtoId: string;
  produtoNome: string;
  /** O anúncio inteiro, como a esteira o devolveu. */
  anuncio: TAnuncio;
  tipoExecucao: string;
  /** ISO. Serve para a tela dizer há quanto tempo ele espera. */
  montadoEm: string;
}

/** Uma chave por cliente — dois lojistas no mesmo navegador não se misturam. */
export function chaveAnuncioPendente(clienteId: string): string {
  return `zion:anuncio-pendente:${clienteId}`;
}

/**
 * Lê o que estava guardado. Devolve null a qualquer sinal de lixo.
 *
 * Um anúncio meio gravado é pior que nenhum: a tela ofereceria recuperar algo
 * que não pode ser gravado, e a pessoa tentaria de novo sem entender por quê.
 */
export function lerAnuncioPendente<T = unknown>(
  bruto: string | null | undefined
): AnuncioPendenteDeGravacao<T> | null {
  if (!bruto) return null;
  try {
    const v: unknown = JSON.parse(bruto);
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (typeof o.produtoId !== "string" || !o.produtoId) return null;
    if (!o.anuncio || typeof o.anuncio !== "object") return null;
    return {
      produtoId: o.produtoId,
      produtoNome: typeof o.produtoNome === "string" ? o.produtoNome : "",
      anuncio: o.anuncio as T,
      tipoExecucao: typeof o.tipoExecucao === "string" ? o.tipoExecucao : "IA",
      montadoEm: typeof o.montadoEm === "string" ? o.montadoEm : "",
    };
  } catch {
    return null;
  }
}

/**
 * Este anúncio guardado ainda serve para o produto que está na tela?
 *
 * Oferecer o anúncio de OUTRO produto seria pior que não oferecer nada — a
 * pessoa gravaria um texto de chinelo num tênis sem perceber. Mesma regra do
 * `?produto=` inexistente: na dúvida, não mostra.
 */
export function serveParaOProduto(
  pendente: AnuncioPendenteDeGravacao | null,
  produtoId: string | null
): boolean {
  return Boolean(pendente && produtoId && pendente.produtoId === produtoId);
}
