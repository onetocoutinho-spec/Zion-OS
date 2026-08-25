// A resposta de erro de uma rota — o que vai para o navegador e o que fica.
//
// ZION-API-001 (auditoria de 2026-08-21). Vinte rotas faziam:
//
//     { erro: e instanceof Error ? e.message : "Falha ao ..." }
//
// Isso manda para o navegador a mensagem de QUEM QUER QUE TENHA LANÇADO: o SDK
// da Anthropic, o da OpenAI, a API do Mercado Livre, o driver do Supabase. Essas
// mensagens carregam nome de modelo, endpoint, motivo de cota, formato de erro
// do backend — reconhecimento de graça para quem provoca falhas de propósito.
// E o app já sabia disso: /api/catalogo/extrair loga o erro e devolve texto
// genérico, com o comentário explicando por quê. Só não era a regra.
//
// A REGRA, agora:
//
//   * Erro que o APP escreveu para a pessoa ler — `ErroDominio`,
//     `RenovacaoRecusadaError`, `JaPublicadoError`, etc. — PASSA. A mensagem
//     foi feita para a tela; esconder seria piorar o produto sem ganhar nada.
//   * Qualquer outro `Error` é de terceiro: vai para o `console.error` do
//     servidor, inteiro, e para o navegador vai só a mensagem pública da rota.
//
// O critério é "quem escreveu a mensagem", e o NOME da classe (`e.name`) é o
// que responde. Por nome, e não por `instanceof`, de propósito: importar as
// classes aqui puxaria `publicacaoML` (que importa o cliente do navegador)
// para dentro de toda rota de servidor. A lista é fechada e cada nome vem de
// um `this.name = "..."` no construtor da classe.
//
// Um `new Error("...")` solto é tratado como de terceiro mesmo que seja nosso:
// se a mensagem é para a pessoa, ela merece uma classe que diga isso.

/** Os `name` das classes cuja mensagem foi escrita para a pessoa. Fechada. */
const ESCRITOS_PARA_A_PESSOA: ReadonlySet<string> = new Set([
  "ErroDominio",             // src/domain/shared/erros-dominio.ts
  "ErroConector",            // src/infrastructure/connectors/shared/erros.ts
  "ErroAutorizacao",         // src/lib/auth/serverAuthorization.ts
  "RenovacaoRecusadaError",  // src/lib/marketplaces/mercadolivre.ts
  "JaPublicadoError",        // src/lib/services/publicacaoML.ts
  "CapaNaoAplicavelError",   // src/lib/services/quadrarCapaML.ts
  "ReconectarCanalError",    // src/modules/integration/domain/credencialRecusada.ts
]);

/** `true` quando a mensagem deste erro pode ir para o navegador como está. */
export function mensagemEhPublica(e: unknown): e is Error {
  return e instanceof Error && ESCRITOS_PARA_A_PESSOA.has(e.name);
}

/**
 * A mensagem que vai para o navegador: a do erro, se foi escrita para a
 * pessoa; a `publica` da rota, se não. Pura — testável sem Response.
 */
export function mensagemParaONavegador(e: unknown, publica: string): string {
  return mensagemEhPublica(e) ? e.message : publica;
}

/**
 * Monta a resposta de erro e LOGA o que não vai nela.
 *
 * @param onde    o nome da rota, para o log ("ml/vendas")
 * @param e       o que foi capturado
 * @param publica a mensagem genérica desta rota
 * @param status  o status HTTP (o padrão é 502: a maioria destas rotas falha
 *                falando com alguém de fora)
 * @param extra   campos adicionais no corpo, quando a rota já os tinha
 */
export function respostaDeErro(
  onde: string,
  e: unknown,
  publica: string,
  status = 502,
  extra: Record<string, unknown> = {}
): Response {
  if (!mensagemEhPublica(e)) {
    // O erro real, inteiro, onde alguém pode lê-lo — e só aí.
    console.error(`[${onde}] falhou`, e);
  }
  return Response.json({ ...extra, erro: mensagemParaONavegador(e, publica) }, { status });
}
