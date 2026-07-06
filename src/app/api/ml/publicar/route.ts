// Publicação no Mercado Livre (Fase 3) — SOMENTE SERVIDOR.
//
// Recebe o payload JÁ MONTADO pelo cliente (o builder é puro e sem segredo),
// renova o access token com o refresh_token do cliente + o segredo do APP ML
// (env, nunca exposto), prediz a categoria se faltar, e publica em /items.
//
// Segurança: ML_CLIENT_ID / ML_CLIENT_SECRET vivem só no .env do servidor.
// O refresh_token do cliente chega no corpo (a equipe já o lê via RLS) e o
// novo refresh_token rotacionado volta para o cliente persistir.

import { renovarToken, preverCategoria, criarItem } from "@/lib/marketplaces/mercadolivre";

// 60s = limite do plano grátis da Vercel.
export const maxDuration = 60;

interface Corpo {
  payload: Record<string, unknown>;
  refreshToken: string;
  go: boolean;
  /** Usado para prever a categoria quando o payload não traz category_id. */
  tituloParaCategoria?: string;
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

  if (!corpo?.refreshToken) {
    return Response.json(
      { erro: "Cliente sem refresh_token do ML. Conecte a conta do cliente primeiro." },
      { status: 400 }
    );
  }
  if (!corpo?.payload || typeof corpo.payload !== "object") {
    return Response.json({ erro: "Payload do anúncio ausente." }, { status: 400 });
  }

  try {
    // 1) Renova o token (e captura o refresh_token rotacionado).
    const tokens = await renovarToken({
      clientId,
      clientSecret,
      refreshToken: corpo.refreshToken,
    });

    // 2) Garante category_id (prevê pelo título quando não veio).
    const payload = { ...corpo.payload };
    if (!payload.category_id && corpo.tituloParaCategoria) {
      const cat = await preverCategoria(tokens.accessToken, corpo.tituloParaCategoria);
      if (cat) payload.category_id = cat;
    }

    // 3) go=false → valida credenciais + categoria, SEM publicar.
    if (!corpo.go) {
      return Response.json({
        dry: true,
        categoryId: payload.category_id ?? null,
        refreshToken: tokens.refreshToken,
        sellerId: tokens.userId ?? null,
      });
    }

    if (!payload.category_id) {
      return Response.json(
        {
          erro: "Não foi possível determinar a categoria do ML. Informe uma categoria manualmente.",
          refreshToken: tokens.refreshToken,
        },
        { status: 422 }
      );
    }

    // 4) Publica de verdade.
    const item = await criarItem(tokens.accessToken, payload);
    return Response.json({
      dry: false,
      id: item.id,
      permalink: item.permalink,
      status: item.status,
      refreshToken: tokens.refreshToken,
      sellerId: tokens.userId ?? null,
    });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao publicar no ML." },
      { status: 502 }
    );
  }
}
