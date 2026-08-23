// O DIAGNÓSTICO de um anúncio, lido no SERVIDOR: o retrato do item e as
// visitas no Mercado Livre com a credencial da loja, e a leitura pura de
// `diagnosticoDoAnuncio`. ⚠️ Server-only.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { renovarToken, RenovacaoRecusadaError, retratoDoItem, visitasDoItem } from "@/lib/marketplaces/mercadolivre";
import { atualizarRefreshTokenServidor, clienteDaCredencial, lerCanalServidor } from "@/modules/integration/infrastructure/canalServidor";
import { diagnosticarAnuncio, type DiagnosticoDoAnuncio } from "@/modules/assistant/domain/diagnosticoDoAnuncio";

export type DiagnosticoNoServidor =
  | { ok: true; mlb: string; titulo: string; permalink: string | null; diagnostico: DiagnosticoDoAnuncio }
  | { ok: false; motivo: "sem_anuncio_no_ar" | "nao_conectado" | "reconectar" | "sem_integracao" | "falha"; mensagem: string };

const PERIODO_DIAS = 30;

/** O MLB de um produto: o anúncio publicado mais recente dele. Com o tenant. */
async function mlbDoProduto(clienteId: string, produtoId: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from("anuncios_gerados")
    .select("ml_item_id")
    .eq("cliente_id", clienteId)
    .eq("produto_id", produtoId)
    .not("ml_item_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const l = ((data ?? []) as { ml_item_id: string | null }[])[0];
  return l?.ml_item_id ?? null;
}

export async function diagnosticoNoServidor(
  clienteId: string,
  produtoId: string,
  precoMinimo: number | null
): Promise<DiagnosticoNoServidor> {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { ok: false, motivo: "sem_integracao", mensagem: "A integração com o Mercado Livre não está configurada no servidor." };
  const mlb = await mlbDoProduto(clienteId, produtoId);
  if (!mlb) return { ok: false, motivo: "sem_anuncio_no_ar", mensagem: "Esse produto não tem anúncio publicado no Mercado Livre — não há o que diagnosticar ainda." };

  const marketplace = "Mercado Livre";
  const canal = await lerCanalServidor(clienteDaCredencial(), clienteId, marketplace);
  if (!canal?.refreshToken) return { ok: false, motivo: "nao_conectado", mensagem: "A loja não está conectada ao Mercado Livre." };
  let tokens: Awaited<ReturnType<typeof renovarToken>>;
  try {
    tokens = await renovarToken({ clientId, clientSecret, refreshToken: canal.refreshToken });
  } catch (e) {
    if (e instanceof RenovacaoRecusadaError && e.credencialRecusada) {
      return { ok: false, motivo: "reconectar", mensagem: "O Mercado Livre recusou a credencial guardada. É preciso reconectar a loja." };
    }
    throw e;
  }
  await atualizarRefreshTokenServidor(clienteDaCredencial(), clienteId, tokens.refreshToken, marketplace);

  const [item, visitas] = await Promise.all([
    retratoDoItem(tokens.accessToken, mlb),
    visitasDoItem(tokens.accessToken, mlb, PERIODO_DIAS),
  ]);
  return {
    ok: true,
    mlb,
    titulo: item.titulo,
    permalink: item.permalink,
    diagnostico: diagnosticarAnuncio({
      status: item.status,
      subStatus: item.subStatus,
      visitasNoPeriodo: visitas,
      periodoDias: PERIODO_DIAS,
      vendidosNaVida: item.vendidos,
      estoque: item.estoque,
      saude: item.saude,
      fotos: item.fotos,
      preco: item.preco,
      precoMinimo,
      // No ML Brasil, `gold_pro` é o Premium; `gold_special` é o Clássico. Tudo
      // o mais (free, bronze, silver, gold) tem exposição menor que o Premium.
      tipoAnuncioEhClassico: item.tipoAnuncio !== null && item.tipoAnuncio !== "gold_pro",
    }),
  };
}
