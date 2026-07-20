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

import {
  renovarToken,
  preverCategoria,
  criarItem,
  criarGuiaTamanhos,
} from "@/lib/marketplaces/mercadolivre";
import {
  precisaUserProducts,
  dominioDaCategoria,
  montarItensUserProducts,
  type BundleUserProducts,
} from "@/lib/marketplaces/mlUserProducts";
import { lerCanalServidor, atualizarRefreshTokenServidor } from "@/lib/marketplaces/canalServidor";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

// Publicação User Products encadeia várias chamadas ao ML (renovar token,
// prever categoria, criar guia, criar 1 item por tamanho). 60s (Hobby) estoura;
// a conta é Pro (o worker já usa 300), então damos a mesma folga aqui.
export const maxDuration = 300;

interface Corpo {
  clienteId: string;
  /** Correlação de logs com o registro de anúncio (observabilidade). */
  registroId?: string;
  payload: Record<string, unknown>;
  go: boolean;
  /** Usado para prever a categoria quando o payload não traz category_id. */
  tituloParaCategoria?: string;
  marketplace?: string;
  /** Ingredientes do modelo User Products (calçado). Usado só se a categoria exigir. */
  userProducts?: BundleUserProducts;
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

  // --- Observabilidade: um publishId por requisição correlaciona todos os logs
  // desta publicação nos Runtime Logs da Vercel (grep por "ml.publicar").
  const publishId = crypto.randomUUID();
  const t0 = Date.now();
  const registroId = typeof corpo.registroId === "string" ? corpo.registroId : null;
  const log = (
    nivel: "info" | "warn" | "error" | "fatal",
    evento: string,
    extra: Record<string, unknown> = {}
  ): void => {
    const linha = JSON.stringify({
      src: "ml.publicar",
      publishId,
      clienteId: corpo.clienteId,
      registroId,
      nivel,
      evento,
      ...extra,
      ms: Date.now() - t0,
      ts: new Date().toISOString(),
    });
    if (nivel === "error" || nivel === "fatal") console.error(linha);
    else if (nivel === "warn") console.warn(linha);
    else console.log(linha);
  };
  log("info", "inicio", {
    go: corpo.go === true,
    marketplace: corpo.marketplace ?? "Mercado Livre",
  });

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
    const categoriaLog = typeof payload.category_id === "string" ? payload.category_id : null;
    if (categoriaLog) log("info", "categoria", { categoryId: categoriaLog });
    else log("warn", "categoria", { categoryId: null, status: "nao_prevista" });

    // 3.5) Bifurcação: categorias que exigem o modelo User Products (ex.: calçado
    // MLB273770) NÃO aceitam o payload clássico. Aqui montamos a guia de tamanhos
    // e publicamos UM item por tamanho (o ML agrupa pela família). Categorias
    // clássicas caem direto no passo 4 abaixo, sem qualquer mudança.
    const categoria = typeof payload.category_id === "string" ? payload.category_id : "";
    if (categoria && precisaUserProducts(categoria)) {
      log("info", "fluxo", { modelo: "user_products", categoryId: categoria });
      const bundle = corpo.userProducts;
      if (!bundle) {
        log("warn", "bloqueio", { status: "bloqueado", motivo: "sem_bundle", categoryId: categoria });
        return Response.json(
          {
            erro:
              "Esta categoria exige o modelo User Products e faltam dados obrigatórios (marca, gênero ou tamanhos com medida). Complete a ficha técnica e a tabela de medidas antes de publicar.",
          },
          { status: 422 }
        );
      }
      const dominio = dominioDaCategoria(categoria);
      if (!dominio) {
        log("warn", "bloqueio", { status: "bloqueado", motivo: "dominio_desconhecido", categoryId: categoria });
        return Response.json(
          { erro: `Domínio de tamanhos desconhecido para a categoria ${categoria}.` },
          { status: 422 }
        );
      }

      // go=false → valida sem publicar.
      if (!corpo.go) {
        log("info", "dry", {
          modelo: "user_products",
          categoryId: categoria,
          tamanhos: bundle.guiaLinhas.map((l) => l.tamanho),
        });
        return Response.json({
          dry: true,
          modelo: "user_products",
          categoryId: categoria,
          tamanhos: bundle.guiaLinhas.map((l) => l.tamanho),
          sellerId: canal.sellerId ?? tokens.userId ?? null,
        });
      }

      // Cria a guia de tamanhos (SIZE_GRID) — precisa do token, por isso aqui.
      const guia = await criarGuiaTamanhos(tokens.accessToken, {
        nome: `${bundle.brand} ${bundle.familyName}`.slice(0, 60),
        domainId: dominio,
        generoId: bundle.generoId,
        generoNome: bundle.generoNome,
        linhas: bundle.guiaLinhas,
      });
      // Detecta (só leitura) rowIds sintéticos: o ML não devolveu a linha e o
      // builder caiu no fallback `${gridId}:${i+1}` → itens tendem a ser rejeitados.
      const rowsSinteticos = bundle.guiaLinhas.filter(
        (l, i) => guia.rowIdPorTamanho[l.tamanho] === `${guia.gridId}:${i + 1}`
      ).length;
      log(rowsSinteticos > 0 ? "warn" : "info", "guia", {
        gridId: guia.gridId,
        rows: bundle.guiaLinhas.length,
        rowsSinteticos,
      });

      const itens = montarItensUserProducts({
        familyName: bundle.familyName,
        categoryId: categoria,
        tipoAnuncio: bundle.tipoAnuncio,
        brand: bundle.brand,
        model: bundle.model,
        descricao: bundle.descricao,
        generoId: bundle.generoId,
        footwearTypeId: bundle.footwearTypeId,
        gridId: guia.gridId,
        rowIdPorTamanho: guia.rowIdPorTamanho,
        pictures: bundle.pictures,
        variacoes: bundle.variacoes,
      });

      // Publica sequencialmente. Em falha parcial ABORTA e reporta os IDs já
      // criados — nunca reenvia (evita duplicar a família num retry cego).
      const criados: { id: string; permalink?: string }[] = [];
      for (let i = 0; i < itens.length; i++) {
        const tamanho = bundle.variacoes[i]?.tamanho ?? null;
        try {
          const item = await criarItem(tokens.accessToken, itens[i]);
          criados.push({ id: item.id, permalink: item.permalink });
          log("info", "item", {
            status: "ok",
            indice: i + 1,
            total: itens.length,
            tamanho,
            itemId: item.id,
          });
        } catch (e) {
          const erro = e instanceof Error ? e.message : "erro desconhecido";
          // k>0 → já há itens vivos no ML sem a família completa: inconsistência (FATAL).
          log(i > 0 ? "fatal" : "error", "erro", {
            status: "parcial",
            etapa: "criar_item",
            indice: i + 1,
            total: itens.length,
            tamanho,
            criados: criados.length,
            itensCriados: criados.map((c) => c.id),
            erro,
          });
          return Response.json(
            {
              erro: `Publicação parcial: ${criados.length}/${itens.length} tamanhos publicados. Falhou em: ${erro}. IDs já criados: ${
                criados.map((c) => c.id).join(", ") || "nenhum"
              }.`,
              parcial: true,
              criados,
            },
            { status: 502 }
          );
        }
      }

      const familia = criados[0];
      log("info", "resumo", {
        status: "ok",
        modelo: "user_products",
        total: criados.length,
        itensCriados: criados.map((c) => c.id),
      });
      return Response.json({
        dry: false,
        id: familia.id,
        permalink: familia.permalink,
        modelo: "user_products",
        itens: criados,
        sellerId: canal.sellerId ?? tokens.userId ?? null,
      });
    }

    // Fluxo clássico (categorias que aceitam title + variations).
    log("info", "fluxo", { modelo: "classico", categoryId: payload.category_id ?? null });

    // 4) go=false → valida credenciais + categoria, SEM publicar. (Sem refresh_token na resposta.)
    if (!corpo.go) {
      log("info", "dry", { modelo: "classico", categoryId: payload.category_id ?? null });
      return Response.json({
        dry: true,
        categoryId: payload.category_id ?? null,
        sellerId: canal.sellerId ?? tokens.userId ?? null,
      });
    }

    if (!payload.category_id) {
      log("warn", "bloqueio", { status: "bloqueado", motivo: "sem_categoria" });
      return Response.json(
        { erro: "Não foi possível determinar a categoria do ML. Informe uma categoria manualmente." },
        { status: 422 }
      );
    }

    // 5) Publica de verdade.
    const item = await criarItem(tokens.accessToken, payload);
    log("info", "resumo", { status: "ok", modelo: "classico", itemId: item.id });
    return Response.json({
      dry: false,
      id: item.id,
      permalink: item.permalink,
      status: item.status,
      sellerId: canal.sellerId ?? tokens.userId ?? null,
    });
  } catch (e) {
    log("error", "erro", {
      status: "falha",
      etapa: "publicar",
      erro: e instanceof Error ? e.message : "desconhecido",
    });
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao publicar no ML." },
      { status: 502 }
    );
  }
}
