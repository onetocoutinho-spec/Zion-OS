// PROMOVE a melhor foto que JÁ ESTÁ em cada anúncio de um produto.
//
// ===========================================================================
// POR QUE ESTE CAMINHO É MAIS SEGURO QUE O DA FOTO NOVA
// ===========================================================================
//
// Não sobe imagem, não consulta o cadastro, e NÃO PRECISA SABER A COR. Se a
// foto já está naquele anúncio, ela já é daquele produto e daquela cor — quem
// a colocou lá foi a lojista. A adivinhação de cor por título, que é a parte
// frágil de `aplicar-capa`, não acontece aqui.
//
// Medido em 13/08/2026: 23 anúncios de 4 produtos têm a foto 1200x1200 dentro
// deles, em segundo ou terceiro lugar, com uma pior na frente. Reordenar
// resolve sem subir nada e sem o ML reprocessar imagem nenhuma.
//
// ===========================================================================
// GET ENSAIA, POST APLICA — e as mesmas três regras do outro caminho
// ===========================================================================
//
//   1. um produto por vez, com teto de anúncios por chamada
//   2. para no primeiro erro, devolvendo o que já foi
//   3. confere DEPOIS de cada envio: `200` do ML é "aceitei", não "troquei"
//
// E a tranca que o incidente de hoje comprovou necessária: `nenhumaFotoSumiu`
// roda ANTES de cada escrita. `definirFotosDoItem` substitui o conjunto.

import { definirFotosDoItem } from "@/lib/marketplaces/mercadolivre";
import {
  lerCanalServidor,
  atualizarRefreshTokenServidor,
} from "@/modules/integration/infrastructure/canalServidor";
import { renovarTokenDaRota } from "@/modules/integration/infrastructure/renovacaoDaRota";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { promoverMelhorFoto, nenhumaFotoSumiu } from "@/modules/catalog/domain/ensaioDaCapa";
import { LADO_MINIMO_DA_CAPA } from "@/modules/integration/domain/capaForaDoPadrao";

const API = "https://api.mercadolibre.com";
const clientId = process.env.ML_CLIENT_ID as string;
const clientSecret = process.env.ML_CLIENT_SECRET as string;

/** Cada anúncio é uma leitura (e no POST, uma escrita). Lote grande assusta. */
const MAXIMO_POR_CHAMADA = 12;

interface Passo {
  mlb: string;
  fotos: number;
  /** Os ids ANTES, para a tranca comparar contra algo que não seja ela mesma. */
  idsAntes: readonly string[];
  capaAntes: string;
  melhor: string | null;
  motivo: "trocar" | "capa-ja-e-a-melhor" | "nenhuma-serve";
  novaOrdem: readonly string[];
}

/** Lê os anúncios do produto e decide o que fazer em cada um. Não escreve. */
async function planejar(
  supabase: NonNullable<Awaited<ReturnType<typeof exigirAcessoAoCliente>>["supabase"]>,
  clienteId: string,
  produtoId: string,
  auth: HeadersInit,
  /**
   * De onde continuar. O teto é por CHAMADA, não por produto — sem este
   * deslocamento, o produto com 40 anúncios devolvia sempre os 12 primeiros e
   * os 28 do fim eram inalcançáveis, por mais que se rechamasse.
   *
   * Medido em 14/08/2026 na varredura dos 36 produtos com capa fora do padrão:
   * 391 anúncios, 228 lidos, **163 fora de alcance**. `naoLidos` dizia o
   * número — dizer não é o bastante quando não há como chegar lá.
   */
  desde = 0
): Promise<{ passos: Passo[]; falhas: { mlb: string; erro: string }[]; total: number }> {
  const { data: anuncios } = await supabase
    .from("anuncios_gerados")
    .select("ml_item_id")
    .eq("cliente_id", clienteId)
    .eq("produto_id", produtoId)
    .not("ml_item_id", "is", null);

  const todos = (anuncios ?? []).map((a) => a.ml_item_id as string);
  const inicio = Math.max(0, Math.floor(desde) || 0);
  const alvos = todos.slice(inicio, inicio + MAXIMO_POR_CHAMADA);
  const passos: Passo[] = [];
  const falhas: { mlb: string; erro: string }[] = [];

  // SEQUENCIAL: cada leitura renova o token e regrava o refresh_token; em
  // paralelo elas usariam o mesmo e derrubariam a conexão dela.
  for (const mlb of alvos) {
    try {
      const r = await fetch(`${API}/items/${mlb}?attributes=id,pictures`, { headers: auth });
      if (!r.ok) {
        falhas.push({ mlb, erro: `ML respondeu ${r.status}` });
        continue;
      }
      const item = (await r.json()) as { pictures?: { id?: string; max_size?: string }[] };
      const fotos = (item.pictures ?? []).map((p) => ({
        id: String(p.id ?? ""),
        maxSize: String(p.max_size ?? ""),
      }));
      const d = promoverMelhorFoto(fotos, LADO_MINIMO_DA_CAPA);
      passos.push({
        mlb,
        fotos: fotos.length,
        idsAntes: fotos.map((f) => f.id),
        capaAntes: fotos[0]?.maxSize ?? "?",
        melhor: d.melhor,
        motivo: d.motivo,
        novaOrdem: d.novaOrdem,
      });
    } catch (e) {
      // A causa vai junto: "não consegui ler" e "não tem foto boa" levam a
      // decisões opostas.
      falhas.push({ mlb, erro: e instanceof Error ? e.message : "falha ao ler" });
    }
  }
  return { passos, falhas, total: todos.length };
}

async function comToken(request: Request, clienteId: string) {
  const ctx = await exigirAcessoAoCliente(request, clienteId);
  if (!ctx.supabase) throw new Error("Supabase não configurado no servidor.");
  const canal = await lerCanalServidor(ctx.supabase, clienteId, "Mercado Livre");
  if (!canal?.refreshToken) throw new Error("Cliente não conectado ao Mercado Livre.");
  const renovacao = await renovarTokenDaRota({
    clientId,
    clientSecret,
    refreshToken: canal.refreshToken,
    marketplace: "Mercado Livre",
    oQueFalhou: "promover a melhor foto",
  });
  if ("recusa" in renovacao) return { recusa: renovacao.recusa } as const;
  await atualizarRefreshTokenServidor(
    ctx.supabase,
    clienteId,
    renovacao.tokens.refreshToken,
    "Mercado Livre"
  );
  return {
    supabase: ctx.supabase,
    accessToken: renovacao.tokens.accessToken,
    auth: { Authorization: `Bearer ${renovacao.tokens.accessToken}` },
  } as const;
}

/** O ENSAIO. Lê e mostra; nada é enviado. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clienteId = (searchParams.get("clienteId") ?? "").trim();
  const produtoId = (searchParams.get("produtoId") ?? "").trim();
  if (!clienteId || !produtoId) {
    return Response.json({ erro: "clienteId e produtoId são obrigatórios." }, { status: 400 });
  }
  let sessao;
  try {
    sessao = await comToken(request, clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if ("recusa" in sessao) return sessao.recusa;

  const desde = Number(searchParams.get("desde") ?? 0);
  const { passos, falhas, total } = await planejar(
    sessao.supabase,
    clienteId,
    produtoId,
    sessao.auth,
    desde
  );
  const inicio = Math.max(0, Math.floor(desde) || 0);
  const trocar = passos.filter((p) => p.motivo === "trocar");
  return Response.json({
    ensaio: true,
    anunciosDoProduto: total,
    desde: inicio,
    lidos: passos.length,
    // O QUE FALTA DEPOIS DESTA JANELA, e por onde continuar. Um número sem
    // continuação é o mesmo que não ter contado: a varredura de 14/08 parou
    // com 163 anúncios fora de alcance porque o teto não tinha `desde`.
    naoLidos: Math.max(0, total - (inicio + passos.length)),
    proximoDesde: inicio + passos.length < total ? inicio + passos.length : null,
    trocariam: trocar.length,
    jaEstaoCertos: passos.filter((p) => p.motivo === "capa-ja-e-a-melhor").length,
    semFotoBoa: passos.filter((p) => p.motivo === "nenhuma-serve").length,
    passos,
    falhas,
    comoResponder:
      "ENSAIO: nada foi enviado. `novaOrdem` é a lista que seria gravada — a melhor foto do próprio anúncio na frente, todas as outras preservadas atrás.",
  });
}

/** A APLICAÇÃO. Um anúncio por vez, parando no primeiro erro. */
export async function POST(request: Request) {
  let corpo: { clienteId?: string; produtoId?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  const clienteId = (corpo.clienteId ?? "").trim();
  const produtoId = (corpo.produtoId ?? "").trim();
  if (!clienteId || !produtoId) {
    return Response.json({ erro: "clienteId e produtoId são obrigatórios." }, { status: 400 });
  }
  let sessao;
  try {
    sessao = await comToken(request, clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if ("recusa" in sessao) return sessao.recusa;

  // O PLANO É FEITO AGORA, no servidor, do estado de agora. Aceitar plano do
  // cliente aplicaria lista velha — e lista velha apaga foto.
  const { passos, falhas } = await planejar(sessao.supabase, clienteId, produtoId, sessao.auth);
  const registrar = (nivel: string, evento: string, extra: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ src: "ml.melhorCapa", clienteId, produtoId, nivel, evento, ...extra }));

  const feitos: { mlb: string; de: string; para: string }[] = [];
  for (const p of passos) {
    if (p.motivo !== "trocar" || !p.melhor) continue;

    // A TRANCA COMPARA CONTRA O ESTADO LIDO, não contra si mesma. Escrita
    // como `nenhumaFotoSumiu(p.novaOrdem, p.novaOrdem)` ela era decoração:
    // sempre verdadeira, e `definirFotosDoItem` substitui o conjunto.
    if (!nenhumaFotoSumiu(p.idsAntes, p.novaOrdem)) {
      registrar("error", "composicao-invalida", { mlb: p.mlb });
      return parcial(feitos, p.mlb, "a lista nova não conferiu");
    }
    try {
      await definirFotosDoItem(sessao.accessToken, p.mlb, p.novaOrdem);
    } catch (e) {
      registrar("error", "ml-recusou", { mlb: p.mlb, erro: e instanceof Error ? e.message : "?" });
      return parcial(feitos, p.mlb, e instanceof Error ? e.message : "o Mercado Livre recusou");
    }

    // CONFERE. `200` é "aceitei o pedido", não "troquei a capa" (03/08/2026).
    const rDepois = await fetch(`${API}/items/${p.mlb}?attributes=id,pictures`, {
      headers: sessao.auth,
    });
    const depois = rDepois.ok
      ? ((await rDepois.json()) as { pictures?: { id?: string; max_size?: string }[] })
      : null;
    const capa = (depois?.pictures ?? [])[0];
    if (String(capa?.id ?? "") !== p.melhor) {
      registrar("error", "capa-nao-mudou", { mlb: p.mlb });
      return parcial(feitos, p.mlb, "o ML aceitou o pedido mas a capa continuou a antiga");
    }
    // E o TAMANHO, não só o id: em 03/08 o ML aparou faixa branca no upload e
    // a capa "trocada" saiu menor. Aqui não há upload, mas conferir é barato.
    feitos.push({ mlb: p.mlb, de: p.capaAntes, para: String(capa?.max_size ?? "?") });
    registrar("info", "trocou", { mlb: p.mlb, para: capa?.max_size });
  }

  return Response.json({
    ok: true,
    trocados: feitos.length,
    feitos,
    falhasDeLeitura: falhas,
    frase:
      feitos.length === 0
        ? "Nenhum anúncio precisava de troca: a melhor foto já era a capa."
        : `Promovi a melhor foto em ${feitos.length} anúncio(s).`,
  });
}

function parcial(feitos: { mlb: string; de: string; para: string }[], mlb: string, motivo: string) {
  return Response.json(
    {
      ok: false,
      parou: true,
      trocados: feitos.length,
      feitos,
      pareiEm: { mlb, motivo },
      frase:
        feitos.length === 0
          ? `Não troquei nenhum anúncio. Parei no ${mlb}: ${motivo}.`
          : `Troquei ${feitos.length} e parei no ${mlb}: ${motivo}. Os demais continuam como estavam.`,
    },
    { status: 207 }
  );
}
