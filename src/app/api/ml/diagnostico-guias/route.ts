// ⚠️ ROTA TEMPORÁRIA DE DIAGNÓSTICO — REMOVER APÓS A CAPTURA.
//
// Objetivo: fazer engenharia reversa do endpoint POST /catalog/charts/search
// usando EXATAMENTE a infraestrutura de uma publicação (mesmo OAuth via
// renovarToken, mesmo seller, mesmo cliente HTTP, mesmo canal do cliente).
//
// Ela APENAS OBSERVA E REGISTRA. NÃO decide, NÃO cria guia, NÃO reutiliza guia,
// NÃO altera o fluxo de publicação. É um espelho de leitura do contexto real.
//
// Descoberta empírica: o /catalog/charts/search EXIGE o filtro GENDER. Como não
// sabemos o id do gênero de antemão, esta rota descobre os valores de GENDER da
// categoria (GET /categories/{cat}/attributes) e roda a busca PARA CADA gênero.
//
// Como invocar (logado no app, produção, DevTools console):
//   const k = Object.keys(localStorage).find(k => k.includes('-auth-token'));
//   const tok = JSON.parse(localStorage.getItem(k)).access_token;
//   const r = await fetch('/api/ml/diagnostico-guias', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
//     body: JSON.stringify({ clienteId: '5074ae56-5f3a-4bc2-a3ad-d9f79ac8d53c' }),
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
  domain?: string;
  categoryId?: string;
  /** Opcional: força um único gênero. Se ausente, descobre todos da categoria. */
  generoId?: string;
  marketplace?: string;
}

/** Disseca um envelope de resposta do search — sem tomar NENHUMA decisão. */
function dissecar(bruto: unknown, ehJson: boolean) {
  const obj = bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>) : null;
  const ehArray = Array.isArray(bruto);
  const chavesTopo = ehArray ? null : obj ? Object.keys(obj) : null;

  const lista: unknown = ehArray
    ? bruto
    : (obj?.results ?? obj?.charts ?? obj?.data ?? obj?.size_charts ?? null);
  const listaEhArray = Array.isArray(lista);
  const quantidade = listaEhArray ? (lista as unknown[]).length : null;

  const primeiro =
    listaEhArray && (lista as unknown[]).length > 0 ? (lista as unknown[])[0] : null;
  const primeiroObj =
    primeiro && typeof primeiro === "object" ? (primeiro as Record<string, unknown>) : null;

  return {
    envelope: ehArray ? "array" : obj ? "objeto" : ehJson ? "primitivo" : "nao_json",
    chavesDeTopo: chavesTopo,
    temPaging: (obj?.paging ?? null) != null,
    paging: obj?.paging ?? null,
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
    chavesDoItem: primeiroObj ? Object.keys(primeiroObj) : null,
    temNames: primeiroObj ? "names" in primeiroObj : null,
    names: primeiroObj?.names ?? null,
    temAttributes: primeiroObj ? "attributes" in primeiroObj : null,
    attributes: primeiroObj?.attributes ?? null,
    temId: primeiroObj ? "id" in primeiroObj : null,
    temType: primeiroObj ? "type" in primeiroObj : null,
    temDomainId: primeiroObj ? "domain_id" in primeiroObj : null,
    temSiteId: primeiroObj ? "site_id" in primeiroObj : null,
  };
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
  const categoryId = corpo.categoryId ?? "MLB273770";
  const siteId = "MLB";

  try {
    // Mesmo canal + OAuth de uma publicação.
    const canal = await lerCanalServidor(ctx.supabase, corpo.clienteId, marketplace);
    if (!canal?.refreshToken) {
      return Response.json({ erro: "Cliente não conectado ao Mercado Livre." }, { status: 400 });
    }
    const tokens = await renovarToken({ clientId, clientSecret, refreshToken: canal.refreshToken });
    await atualizarRefreshTokenServidor(ctx.supabase, corpo.clienteId, tokens.refreshToken, marketplace);
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };
    const sellerId = canal.sellerId ?? tokens.userId ?? null;

    // 1) Descobre os valores de GENDER da categoria (a busca EXIGE esse filtro).
    let generos: { id: string; nome: string }[] = [];
    let generosOrigem = "categoria";
    if (corpo.generoId) {
      generos = [{ id: corpo.generoId, nome: "(fornecido)" }];
      generosOrigem = "fornecido";
    } else {
      const at = await fetch(`${API}/categories/${categoryId}/attributes`, { headers: auth });
      if (at.ok) {
        const attrs = (await at.json()) as {
          id?: string;
          values?: { id?: string; name?: string }[];
        }[];
        const gender = attrs.find((a) => a.id === "GENDER");
        generos = (gender?.values ?? [])
          .filter((v) => v.id)
          .map((v) => ({ id: String(v.id), nome: v.name ?? "" }));
      }
    }

    // 2) Roda a busca PARA CADA gênero e disseca cada resposta.
    const resultados: unknown[] = [];
    for (const g of generos) {
      const buscaBody = {
        site_id: siteId,
        domain_id: domainId,
        seller_id: sellerId,
        type: "SPECIFIC",
        attributes: [{ id: "GENDER", values: [{ id: g.id }] }],
      };
      const resp = await fetch(`${API}/catalog/charts/search`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
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
      const analise = dissecar(bruto, ehJson);

      console.log(
        JSON.stringify({
          src: "ml.diag.guias",
          clienteId: corpo.clienteId,
          sellerId,
          domainId,
          genero: g,
          status,
          ehJson,
          ...analise,
          ts: new Date().toISOString(),
        })
      );

      resultados.push({ genero: g, status, ehJson, analise, envelopeCru: bruto });
    }

    return Response.json({
      diagnostico: true,
      sellerId,
      domainId,
      categoryId,
      generosOrigem,
      generosDescobertos: generos,
      resultados,
    });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha no diagnóstico." },
      { status: 502 }
    );
  }
}
