// A versão que o SERVIDOR está rodando.
//
// Existe para a aba descobrir que está velha SEM precisar rodar uma operação.
// O detector anterior viajava na resposta de `/api/ml/importar-anuncios`, então
// só avisava depois de uma importação — e em 02/08/2026 o autor abriu a tela,
// não achou um botão que já estava no ar e não tinha como saber por quê.
//
// SEM AUTENTICAÇÃO, de propósito: o valor devolvido é exatamente o que já vem
// compilado dentro do pacote JavaScript de todo navegador que abre o site
// (`NEXT_PUBLIC_VERSAO`). Exigir sessão para ler um dado que o próprio cliente
// já carrega seria cerimônia sem proteção.
//
// `force-dynamic` porque uma resposta cacheada aqui devolveria a versão ANTIGA
// e o detector diria "está tudo em dia" justamente quando não está — o defeito
// que ele existe para pegar.

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { versao: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
