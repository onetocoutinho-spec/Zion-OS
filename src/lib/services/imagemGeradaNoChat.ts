// A ponte entre o cartão de rascunho de imagem e `/api/imagens/aprovar`.
// Só transporta: quem decide é o servidor, com a loja dona da versão.

import { cabecalhoAutenticacao } from "../supabase/sessao";

export async function aprovarImagemGerada(
  versaoId: string,
  comoCapa: boolean
): Promise<{ ok: true; url: string } | { ok: false; mensagem: string }> {
  const resposta = await fetch("/api/imagens/aprovar", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ versaoId, acao: "aprovar", comoCapa }),
  });
  const dados = (await resposta.json().catch(() => ({}))) as { ok?: boolean; url?: string; erro?: string };
  if (!resposta.ok || !dados.ok || !dados.url) {
    return { ok: false, mensagem: dados.erro ?? "Não consegui aprovar a imagem." };
  }
  return { ok: true, url: dados.url };
}
