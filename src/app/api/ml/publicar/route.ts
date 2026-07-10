// Publicação no Mercado Livre (Fase 3) — SOMENTE SERVIDOR.
//
// Recebe o payload JÁ MONTADO pelo cliente (o builder é puro e sem segredo) +
// o `clienteId`. Autoriza no servidor, BUSCA o refresh_token do canal (nunca
// vem do navegador — R3), renova o access token com o segredo do APP ML (env),
// prediz a categoria se faltar, e publica em /items.
//
// Segurança: ML_CLIENT_ID / ML_CLIENT_SECRET vivem só no .env do servidor.
// O refresh_token do cliente é lido e rotacionado SÓ no servidor; nunca é
// enviado nem devolvido ao navegador.

import { renovarToken, preverCategoria, criarItem } from "@/lib/marketplaces/mercadolivre";
import { lerCanalServidor, atualizarRefreshTokenServidor } from "@/lib/marketplaces/canalServidor";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

// 60s = limite do plano grátis da Vercel.
export const maxDuration = 60;

interface Corpo {
  clienteId: string;
  payload: Record<string, unknown>;
  go: boolean;
  /** Usado para prever a categoria quando o payload não traz category_id. */
  tituloParaCategoria?: string;
  marketplace?: string;
}

export async function POST(request: Request) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json(
      {
        erro: "Integração ML não configurada no servidor. Defina ML_CLIENT_ID e ML_CLIENT_SECRET no .env.",
        configurado: false,
      },
      { status: 503 }
    );
  }

  let corpo: Corpo;
  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  if (!corpo?.clienteId) {
    return Response.json({ erro: "clienteId ausente." }, { status: 400 });
  }
  if (!corpo?.payload || typeof corpo.payload !== "object") {
    return Response.json({ erro: "Payload do anúncio ausente." }, { status: 400 });
  }

  // Autorização server-side: o usuário precisa poder operar este cliente.
  let ctx;
  try {
    ctx = await exigirAcessoAoCliente(request, corpo.clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if (!ctx.supabase) {
    return Response.json({ erro: "Supabase não configurado no servidor." }, { status: 503 });
  }

  const marketplace = corpo.marketplace ?? "Mercado Livre";

  try {
    // 1) Busca o refresh_token do canal NO SERVIDOR (via RLS).
    const canal = await lerCanalServidor(ctx.supabase, corpo.clienteId, marketplace);
    if (!canal?.refreshToken) {
      return Response.json(
        { erro: "Cliente não conectado ao Mercado Livre. Conecte a conta antes de publicar." },
        { status: 400 }
      );
    }

    // 2) Renova o token (e captura o refresh_token rotacionado).
    const tokens = await renovarToken({ clientId, clientSecret, refreshToken: canal.refreshToken });
    // Persiste o refresh_token rotacionado imediatamente (mesmo se publicar falhar depois).
    await atualizarRefreshTokenServidor(ctx.supabase, corpo.clienteId, tokens.refreshToken, marketplace);

    // 3) Garante category_id (prevê pelo título quando não veio).
    const payload = { ...corpo.payload };
    if (!payload.category_id && corpo.tituloParaCategoria) {
      const cat = await preverCategoria(tokens.accessToken, corpo.tituloParaCategoria);
      if (cat) payload.category_id = cat;
    }

    // 4) go=false → valida credenciais + categoria, SEM publicar. (Sem refresh_token na resposta.)
    if (!corpo.go) {
      return Response.json({
        dry: true,
        categoryId: payload.category_id ?? null,
        sellerId: canal.sellerId ?? tokens.userId ?? null,
      });
    }

    if (!payload.category_id) {
      return Response.json(
        { erro: "Não foi possível determinar a categoria do ML. Informe uma categoria manualmente." },
        { status: 422 }
      );
    }

    // 5) Publica de verdade.
    const item = await criarItem(tokens.accessToken, payload);
    return Response.json({
      dry: false,
      id: item.id,
      permalink: item.permalink,
      status: item.status,
      sellerId: canal.sellerId ?? tokens.userId ?? null,
    });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao publicar no ML." },
      { status: 502 }
    );
  }
}
