// ⚠️ ROTA TEMPORÁRIA DE DIAGNÓSTICO — REMOVER APÓS A CAPTURA.
//
// Objetivo: fazer engenharia reversa do endpoint POST /catalog/charts/search
// usando EXATAMENTE a infraestrutura de uma publicação (mesmo OAuth via
// renovarToken, mesmo seller, mesmo cliente HTTP, mesmo canal do cliente).
//
// Ela APENAS OBSERVA E REGISTRA. NÃO decide, NÃO cria guia, NÃO reutiliza guia,
// NÃO altera o fluxo de publicação. É um espelho de leitura do contexto real.
//
// Como invocar (logado no app, no domínio de produção, DevTools console):
//   const k = Object.keys(localStorage).find(k => k.includes('-auth-token'));
//   const tok = JSON.parse(localStorage.getItem(k)).access_token;
//   const r = await fetch('/api/ml/diagnostico-guias', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
//     body: JSON.stringify({ clienteId: 'COLE_O_CLIENTE_ID' }),
//   });
//   console.log(JSON.stringify(await r.json(), null, 2));
//
// Depois de rodar UMA vez em produção e me mandar o JSON, apague este arquivo.

import { renovarToken } from "@/lib/marketplaces/mercadolivre";
import { lerCanalServidor, atualizarRefreshTokenServidor } from "@/lib/marketplaces/canalServidor";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

const API = "https://api.mercadolibre.com";

export const maxDuration = 60;

interface Corpo {
  clienteId: string;
  /** Domínio de tamanhos. Default = o do piloto (calçado). */
  domain?: string;
  /** Opcional: id do gênero, para medir o efeito do filtro GENDER. */
  generoId?: string;
  marketplace?: string;
}

export async function POST(request: Request) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json({ erro: "ML_CLIENT_ID/SECRET ausentes no servidor." }, { status: 503 });
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

  // Mesma autorização server-side de uma publicação.
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
  const domainId = corpo.domain ?? "SANDALS_AND_CLOGS";
  const siteId = "MLB";

  try {
    // 1) Mesmo canal + OAuth de uma publicação (renova e persiste o refresh
    //    rotacionado, idêntico ao publicar — não desincroniza a conta).
    const canal = await lerCanalServidor(ctx.supabase, corpo.clienteId, marketplace);
    if (!canal?.refreshToken) {
      return Response.json({ erro: "Cliente não conectado ao Mercado Livre." }, { status: 400 });
    }
    const tokens = await renovarToken({ clientId, clientSecret, refreshToken: canal.refreshToken });
    await atualizarRefreshTokenServidor(ctx.supabase, corpo.clienteId, tokens.refreshToken, marketplace);

    const sellerId = canal.sellerId ?? tokens.userId ?? null;

    // 2) A MESMA chamada que a reutilização faria — mas só para observar.
    const buscaBody: Record<string, unknown> = {
      site_id: siteId,
      domain_id: domainId,
      seller_id: sellerId,
      type: "SPECIFIC",
    };
    if (corpo.generoId) {
      buscaBody.attributes = [{ id: "GENDER", values: [{ id: corpo.generoId }] }];
    }

    const resp = await fetch(`${API}/catalog/charts/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buscaBody),
    });

    const status = resp.status;
    const texto = await resp.text();
    let bruto: unknown;
    let ehJson = true;
    try {
      bruto = JSON.parse(texto);
    } catch {
      ehJson = false;
      bruto = texto;
    }

    // 3) Dissecação do envelope — sem tomar NENHUMA decisão.
    const obj = bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>) : null;
    const ehArray = Array.isArray(bruto);
    const chavesTopo = ehArray ? null : obj ? Object.keys(obj) : null;

    const lista: unknown = ehArray
      ? bruto
      : (obj?.results ?? obj?.charts ?? obj?.data ?? obj?.size_charts ?? null);
    const listaEhArray = Array.isArray(lista);
    const quantidade = listaEhArray ? (lista as unknown[]).length : null;
    const paging = obj?.paging ?? null;

    const primeiro =
      listaEhArray && (lista as unknown[]).length > 0 ? (lista as unknown[])[0] : null;
    const primeiroObj =
      primeiro && typeof primeiro === "object" ? (primeiro as Record<string, unknown>) : null;
    const chavesItem = primeiroObj ? Object.keys(primeiroObj) : null;

    const analise = {
      // Q1 — envelope
      envelope: ehArray ? "array" : obj ? "objeto" : ehJson ? "primitivo" : "nao_json",
      chavesDeTopo: chavesTopo,
      // Q2/Q8 — paginação
      temPaging: paging != null,
      paging,
      // Q5 — quantas vieram
      quantidadeResultados: quantidade,
      chaveDaLista: ehArray
        ? "(array na raiz)"
        : obj?.results != null
          ? "results"
          : obj?.charts != null
            ? "charts"
            : obj?.data != null
              ? "data"
              : obj?.size_charts != null
                ? "size_charts"
                : "(nao_localizada)",
      // Q3/Q4 — estrutura de um item
      chavesDoItem: chavesItem,
      temNames: primeiroObj ? "names" in primeiroObj : null,
      names: primeiroObj?.names ?? null,
      temAttributes: primeiroObj ? "attributes" in primeiroObj : null,
      attributes: primeiroObj?.attributes ?? null,
      temId: primeiroObj ? "id" in primeiroObj : null,
      temType: primeiroObj ? "type" in primeiroObj : null,
      temDomainId: primeiroObj ? "domain_id" in primeiroObj : null,
      temSiteId: primeiroObj ? "site_id" in primeiroObj : null,
    };

    // Log estruturado (aparece nos Runtime Logs como src:"ml.diag.guias").
    console.log(
      JSON.stringify({
        src: "ml.diag.guias",
        clienteId: corpo.clienteId,
        sellerId,
        domainId,
        comGenero: Boolean(corpo.generoId),
        status,
        ehJson,
        ...analise,
        ts: new Date().toISOString(),
      })
    );

    // Devolve TUDO — inclusive o envelope cru — para inspeção direta.
    return Response.json({
      diagnostico: true,
      requisicao: { ...buscaBody },
      status,
      ehJson,
      analise,
      envelopeCru: bruto,
    });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha no diagnóstico." },
      { status: 502 }
    );
  }
}
