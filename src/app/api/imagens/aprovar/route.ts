// Aprovar uma versão gerada pela IA — ela vira foto do produto.
//
// O rascunho mora no bucket PRIVADO (070). Aprovar copia o arquivo para o
// bucket público (o Mercado Livre precisa baixar) e registra em
// `imagens_produto`. Só o servidor faz isso: o navegador não escreve no
// bucket privado nem em `imagens_versoes`.
//
// A loja dona da versão é quem autoriza (`exigirAcessoAoCliente`): lojista a
// própria, agência as dela, equipe qualquer. Versão de outra loja "não existe".

import { exigirAcessoAoCliente, exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { aprovarVersao, lerVersao, rejeitarVersao } from "@/lib/services/imagensVersoes";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { respostaDeErro } from "@/lib/http/respostaDeErro";

export const maxDuration = 30;

interface Corpo {
  versaoId: string;
  /** aprovar (vira foto) ou rejeitar (registra o feedback; a próxima parte dela). */
  acao: "aprovar" | "rejeitar";
  comoCapa?: boolean;
  feedback?: string;
}

export async function POST(request: Request) {
  try {
    await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  let corpo: Corpo;
  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  const versaoId = typeof corpo?.versaoId === "string" ? corpo.versaoId.trim() : "";
  if (!versaoId || (corpo.acao !== "aprovar" && corpo.acao !== "rejeitar")) {
    return Response.json({ erro: "Informe a versão e a ação (aprovar ou rejeitar)." }, { status: 400 });
  }

  // A loja DA VERSÃO decide a autorização — lida com o admin só para saber
  // de quem é; a decisão vem de `exigirAcessoAoCliente`.
  const { data } = await getSupabaseAdmin().from("imagens_versoes").select("cliente_id").eq("id", versaoId).maybeSingle();
  const clienteId = (data as { cliente_id?: string } | null)?.cliente_id;
  if (!clienteId) return Response.json({ erro: "Não achei essa versão." }, { status: 404 });
  try {
    await exigirAcessoAoCliente(request, clienteId);
  } catch {
    return Response.json({ erro: "Não achei essa versão." }, { status: 404 });
  }

  try {
    if (corpo.acao === "rejeitar") {
      await rejeitarVersao(clienteId, versaoId, String(corpo.feedback ?? ""));
      return Response.json({ ok: true });
    }
    const v = await lerVersao(clienteId, versaoId);
    if (!v) return Response.json({ erro: "Não achei essa versão." }, { status: 404 });
    const r = await aprovarVersao(clienteId, versaoId, corpo.comoCapa === true);
    if (!r.ok) return Response.json({ erro: r.mensagem }, { status: 409 });
    return Response.json({ ok: true, imagemId: r.imagemId, url: r.url });
  } catch (e) {
    return respostaDeErro("imagens/aprovar", e, "Não consegui aprovar a imagem.", 502);
  }
}
