// AS VENDAS DA LOJA, lidas no SERVIDOR — para o Copilot responder "como
// estão minhas vendas?" e "por que caíram?".
//
// `buscarVendasDoCliente` (vendasML.ts) roda no navegador e chama
// `/api/ml/vendas`. O Copilot roda no servidor, com o tenant da sessão, e não
// pode fazer um fetch para si mesmo. Este módulo faz o MESMO caminho da rota
// — canal, credencial renovada e rotacionada, pedidos pagos — e a MESMA conta
// (`calcularMetricas`), duas vezes: a janela pedida e a anterior de igual
// tamanho, para o diagnóstico ser diferencial.
//
// Tudo com `.eq("cliente_id", …)` e a credencial lida pelo cliente de
// credencial (059/061). Nada do que passa por aqui volta ao navegador.
//
// ⚠️ Server-only.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { lerTudoPaginado } from "@/lib/supabase/paginado";
import {
  buscarPedidosML,
  renovarToken,
  RenovacaoRecusadaError,
  type PedidoML,
} from "@/lib/marketplaces/mercadolivre";
import {
  atualizarRefreshTokenServidor,
  clienteDaCredencial,
  lerCanalServidor,
} from "@/modules/integration/infrastructure/canalServidor";
import { calcularMetricas, type MetricasVendas } from "@/lib/services/vendasML";
import { diagnosticoDeVendas, type LeituraDeVendas } from "@/modules/assistant/domain/diagnosticoDeVendas";
import type { Produto } from "@/lib/types";

export type VendasNoServidor =
  | { ok: true; leitura: LeituraDeVendas; pedidosLidos: number; truncado: boolean }
  | { ok: false; motivo: "nao_conectado" | "reconectar" | "sem_integracao" | "falha"; mensagem: string };

export const DIAS_PERMITIDOS = [7, 14, 30, 60, 90] as const;
export type DiasDeVendas = (typeof DIAS_PERMITIDOS)[number];

const TETO_DE_PEDIDOS = 600;

export async function vendasNoServidor(clienteId: string, dias: DiasDeVendas): Promise<VendasNoServidor> {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { ok: false, motivo: "sem_integracao", mensagem: "A integração com o Mercado Livre não está configurada no servidor." };
  }
  const marketplace = "Mercado Livre";
  const canal = await lerCanalServidor(clienteDaCredencial(), clienteId, marketplace);
  if (!canal?.refreshToken) {
    return { ok: false, motivo: "nao_conectado", mensagem: "A loja não está conectada ao Mercado Livre." };
  }

  let tokens: Awaited<ReturnType<typeof renovarToken>>;
  try {
    tokens = await renovarToken({ clientId, clientSecret, refreshToken: canal.refreshToken });
  } catch (e) {
    if (e instanceof RenovacaoRecusadaError && e.credencialRecusada) {
      return {
        ok: false,
        motivo: "reconectar",
        mensagem: "O Mercado Livre recusou a credencial guardada. É preciso reconectar a loja em Conexão com o Mercado Livre.",
      };
    }
    throw e;
  }
  await atualizarRefreshTokenServidor(clienteDaCredencial(), clienteId, tokens.refreshToken, marketplace);
  const sellerId = canal.sellerId || tokens.userId;
  if (!sellerId) return { ok: false, motivo: "falha", mensagem: "Não achei o seller_id do Mercado Livre desta loja." };

  // DUAS janelas numa leitura só: pedidos desde 2×dias, divididos pela data.
  const agora = Date.now();
  const corte = agora - dias * 86_400_000;
  const desde = new Date(agora - 2 * dias * 86_400_000).toISOString();
  const pedidos = await buscarPedidosML(tokens.accessToken, sellerId, { desde, maxPedidos: TETO_DE_PEDIDOS });
  const truncado = pedidos.length >= TETO_DE_PEDIDOS;

  const atual: PedidoML[] = [];
  const anterior: PedidoML[] = [];
  for (const p of pedidos) {
    const t = Date.parse(p.data || "");
    if (!Number.isFinite(t)) continue;
    (t >= corte ? atual : anterior).push(p);
  }

  const produtos = await produtosComCusto(clienteId);
  const mAtual: MetricasVendas = calcularMetricas(atual, produtos);
  const mAnterior: MetricasVendas = calcularMetricas(anterior, produtos);

  return {
    ok: true,
    leitura: diagnosticoDeVendas(dias, mAtual, mAnterior),
    pedidosLidos: pedidos.length,
    truncado,
  };
}

/** Só o que `calcularMetricas` lê: sku, codErp e custo. Com o tenant. */
async function produtosComCusto(clienteId: string): Promise<Produto[]> {
  const admin = getSupabaseAdmin();
  const linhas = await lerTudoPaginado<{ id: string; sku: string | null; cod_erp: string | null; custo: number | null }>(
    "produtos para as vendas",
    (de, ate) =>
      admin
        .from("produtos")
        .select("id, sku, cod_erp, custo")
        .eq("cliente_id", clienteId)
        .order("id", { ascending: true })
        .range(de, ate)
  );
  return linhas.map(
    (l) =>
      ({
        id: l.id,
        sku: l.sku ?? "",
        codErp: l.cod_erp ?? "",
        custo: Number(l.custo ?? 0),
      }) as unknown as Produto
  );
}
