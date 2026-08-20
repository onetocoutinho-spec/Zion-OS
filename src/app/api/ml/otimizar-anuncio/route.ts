// LEVA ao Mercado Livre o título, a descrição e a ficha que a Zion escreveu.
//
// ===========================================================================
// A LACUNA QUE ESTA ROTA FECHA
// ===========================================================================
//
// Até 19/08/2026 o Zion sabia MELHORAR e não sabia ENTREGAR. `propor_titulo`,
// `propor_descricao` e `propor_palavras_chave` rodavam o agente (Opus 5),
// mostravam antes-e-depois, a lojista confirmava — e a gravação ia para o
// JSONB de `anuncios_gerados`, o nosso banco.
//
// A mensagem final era honesta e por isso mesmo constrangedora:
//
//   "Título trocado no anúncio preparado aqui. O anúncio que já está no ar no
//    Mercado Livre não muda com isso."
//
// Com 480 anúncios ativos, otimizar era ensaio. O texto sempre existiu; faltava
// a entrega.
//
// ===========================================================================
// AS QUATRO REGRAS — as mesmas de `aplicar-capa`, e pelos mesmos incidentes
// ===========================================================================
//
// 1. UM ANÚNCIO POR CHAMADA. Isto ESCREVE na vitrine ao vivo dela. Um laço que
//    reescreve 480 títulos errado não se desfaz com Ctrl+Z.
//
// 2. GET ENSAIA, POST APLICA. O ensaio diz o que MUDARIA e o que o ML vai
//    recusar antes de tentar — anúncio de catálogo não tem título próprio,
//    anúncio com venda tem o título congelado.
//
// 3. CONFERE DEPOIS DE CADA CAMPO. `200` do ML é "aceitei o pedido", não
//    "troquei". Em 03/08/2026 alguém afirmou "capa ajustada" com base no 200 e
//    a capa era a antiga. Aqui o item é RELIDO e comparado.
//
// 4. PARA NO PRIMEIRO ERRO, devolvendo o que já foi. Metade aplicada sem saber
//    qual metade é pior que nada.
//
// O que a rota NÃO faz: não escolhe o texto. Ela recebe o que a lojista
// confirmou e entrega. Gerar é da esteira; decidir é dela.

import {
  definirTituloDoItem,
  definirDescricaoDoItem,
  definirAtributosDoItem,
  definirPrecoDoItem,
} from "@/lib/marketplaces/mercadolivre";
import {
  lerCanalServidor,
  atualizarRefreshTokenServidor,
} from "@/modules/integration/infrastructure/canalServidor";
import { renovarTokenDaRota } from "@/modules/integration/infrastructure/renovacaoDaRota";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import {
  planejarOtimizacao,
  type ItemNoAr,
  type TextoProposto,
} from "@/modules/integration/domain/otimizacaoNoMarketplace";

const API = "https://api.mercadolibre.com";

function normalizarItemId(bruto: string): string {
  return bruto.trim().toUpperCase().replace(/-/g, "");
}

/** Lê o item ao vivo — o estado de AGORA, nunca o que o cliente mandou. */
async function lerItem(itemId: string, auth: HeadersInit): Promise<ItemNoAr | null> {
  const r = await fetch(`${API}/items/${itemId}?include_attributes=all`, { headers: auth });
  if (!r.ok) return null;
  const j = (await r.json()) as Record<string, unknown>;
  // A descrição é OUTRO endpoint. Ler o item e concluir "sem descrição" seria a
  // mesma afirmação de ausência que custou o dia 18/08.
  const rd = await fetch(`${API}/items/${itemId}/description`, { headers: auth });
  const d = rd.ok ? ((await rd.json()) as { plain_text?: string }) : null;
  return {
    id: String(j.id ?? ""),
    titulo: String(j.title ?? ""),
    descricao: d?.plain_text ?? "",
    status: String(j.status ?? ""),
    vendidos: Number(j.sold_quantity ?? 0),
    doCatalogo: Boolean(j.catalog_listing),
    atributos: Array.isArray(j.attributes)
      ? (j.attributes as { id?: string; value_id?: string | null; value_name?: string | null }[])
          .filter((a) => a.id)
          .map((a) => ({
            id: String(a.id),
            valueId: a.value_id ?? null,
            valueName: a.value_name ?? null,
          }))
      : [],
  };
}

/** O preço de AGORA, lido do ML — nunca o que o cliente mandou. */
async function lerPrecoAtual(itemId: string, auth: HeadersInit): Promise<number | null> {
  const r = await fetch(`${API}/items/${itemId}`, { headers: auth });
  if (!r.ok) return null;
  const j = (await r.json()) as { price?: number };
  return typeof j.price === "number" ? j.price : null;
}

async function contexto(request: Request, clienteId: string) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { recusa: Response.json({ erro: "Integração ML não configurada." }, { status: 503 }) };
  }
  let ctx;
  try {
    ctx = await exigirAcessoAoCliente(request, clienteId);
  } catch (e) {
    return { recusa: respostaErroAutorizacao(e) };
  }
  if (!ctx.supabase) {
    return { recusa: Response.json({ erro: "Supabase não configurado." }, { status: 503 }) };
  }
  const canal = await lerCanalServidor(ctx.supabase, clienteId, "Mercado Livre");
  if (!canal?.refreshToken) {
    return { recusa: Response.json({ erro: "Cliente não conectado ao ML." }, { status: 400 }) };
  }
  const renovacao = await renovarTokenDaRota({
    clientId,
    clientSecret,
    refreshToken: canal.refreshToken,
    marketplace: "Mercado Livre",
    oQueFalhou: "levar o texto ao seu anúncio",
  });
  if ("recusa" in renovacao) return { recusa: renovacao.recusa };
  await atualizarRefreshTokenServidor(
    ctx.supabase,
    clienteId,
    renovacao.tokens.refreshToken,
    "Mercado Livre"
  );
  return { token: renovacao.tokens.accessToken };
}

/** ENSAIO: o que mudaria, e o que o ML vai recusar antes de tentarmos. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clienteId = (searchParams.get("clienteId") ?? "").trim();
  const itemId = normalizarItemId(searchParams.get("itemId") ?? "");
  if (!clienteId || !itemId) {
    return Response.json({ erro: "clienteId e itemId são obrigatórios." }, { status: 400 });
  }
  const c = await contexto(request, clienteId);
  if ("recusa" in c) return c.recusa;
  const auth = { Authorization: `Bearer ${c.token}` };

  const item = await lerItem(itemId, auth);
  if (!item) return Response.json({ erro: `Não consegui ler ${itemId} no ML.` }, { status: 404 });

  return Response.json({
    ensaio: true,
    item: {
      id: item.id,
      titulo: item.titulo,
      status: item.status,
      vendidos: item.vendidos,
      doCatalogo: item.doCatalogo,
      tamanhoDaDescricao: item.descricao.length,
      atributosPreenchidos: item.atributos.length,
    },
    // Sem proposta, o ensaio ainda serve: ele diz o que o ML PERMITE mudar.
    permissoes: planejarOtimizacao(item, {}).permissoes,
  });
}

interface Corpo {
  clienteId: string;
  itemId: string;
  texto: TextoProposto;
  /**
   * O PREÇO NOVO. Caminho próprio, fora de `texto`, e a separação é decisão.
   *
   * Texto é reversível: um título ruim se troca de volta e ninguém pagou por
   * ele. Preço no ar é o que o comprador vê e paga — juntá-lo ao mesmo
   * "confirmar" faria um sim sobre a descrição aprovar uma mudança de preço.
   */
  preco?: number;
}

export async function POST(request: Request) {
  let corpo: Corpo;
  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  const clienteId = (corpo?.clienteId ?? "").trim();
  const itemId = normalizarItemId(corpo?.itemId ?? "");
  if (!clienteId || !itemId) {
    return Response.json({ erro: "clienteId e itemId são obrigatórios." }, { status: 400 });
  }

  const c = await contexto(request, clienteId);
  if ("recusa" in c) return c.recusa;
  const auth = { Authorization: `Bearer ${c.token}` };

  // O PLANO SAI DO ESTADO DE AGORA, não do que o cliente mandou.
  //
  // Um plano montado há dez minutos envelheceu: o ML pode ter congelado o
  // título por uma venda que entrou nesse meio-tempo. `aplicar-capa` aprendeu
  // isso do jeito caro — lá, plano velho APAGAVA foto.
  const item = await lerItem(itemId, auth);
  if (!item) return Response.json({ erro: `Não consegui ler ${itemId} no ML.` }, { status: 404 });

  // PREÇO primeiro, e sozinho: quem manda preço não manda texto na mesma
  // chamada. Uma escrita por vez é a mesma disciplina de `aplicar-capa`.
  if (typeof corpo.preco === "number") {
    const precoAtual = Number((await lerPrecoAtual(itemId, auth)) ?? 0);
    try {
      const r = await definirPrecoDoItem(c.token, itemId, corpo.preco, { precoAtual });
      const confirmado = Math.abs(r.preco - corpo.preco) < 0.005;
      return Response.json({
        aplicados: [
          { campo: "preco", ok: confirmado, confirmado: `R$ ${r.preco.toFixed(2)}`, de: precoAtual },
        ],
      });
    } catch (e) {
      return Response.json(
        { aplicados: [], erro: e instanceof Error ? e.message : "Falha ao trocar o preço." },
        { status: 422 }
      );
    }
  }

  const plano = planejarOtimizacao(item, corpo.texto ?? {});
  if (plano.passos.length === 0) {
    return Response.json({ aplicados: [], nadaAFazer: true, motivo: plano.porque });
  }

  const aplicados: { campo: string; ok: boolean; confirmado?: string; erro?: string }[] = [];
  try {
    for (const passo of plano.passos) {
      if (passo.campo === "titulo") {
        const r = await definirTituloDoItem(c.token, itemId, passo.valor as string);
        // REGRA 3: confere. `200` é "aceitei", não "troquei".
        const ok = r.titulo.trim() === (passo.valor as string).trim();
        aplicados.push({ campo: "titulo", ok, confirmado: r.titulo });
        if (!ok) break;
      } else if (passo.campo === "descricao") {
        await definirDescricaoDoItem(c.token, itemId, passo.valor as string);
        const rd = await fetch(`${API}/items/${itemId}/description`, { headers: auth });
        const d = rd.ok ? ((await rd.json()) as { plain_text?: string }) : null;
        const ok = (d?.plain_text ?? "").trim() === (passo.valor as string).trim();
        aplicados.push({ campo: "descricao", ok, confirmado: `${(d?.plain_text ?? "").length} car.` });
        if (!ok) break;
      } else {
        const r = await definirAtributosDoItem(
          c.token,
          itemId,
          passo.valor as { id: string; value_id?: string | null; value_name?: string | null }[]
        );
        aplicados.push({ campo: "ficha", ok: true, confirmado: `${r.quantosVieram} atributos` });
      }
    }
  } catch (e) {
    // REGRA 4: para no primeiro erro E DEVOLVE O QUE JÁ FOI.
    //
    // 422 e não 5xx: a recusa do ML não é falha de gateway, e num 5xx o
    // Cloudflare descarta o corpo e serve a página dele — medido em 18/08/2026,
    // com o motivo real da recusa morrendo na borda.
    return Response.json(
      {
        aplicados,
        erro: e instanceof Error ? e.message : "Falha ao levar o texto ao Mercado Livre.",
      },
      { status: 422 }
    );
  }

  return Response.json({ aplicados, permissoes: plano.permissoes });
}
