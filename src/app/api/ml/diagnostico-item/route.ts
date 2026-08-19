// Diagnóstico de UM item do Mercado Livre — somente leitura.
//
// Existe para responder perguntas do tipo "de onde vem esse dado?" sem que
// alguém tenha que extrair o access_token do servidor para testar na mão.
//
// A pergunta que motivou a rota: a importação lê `price` de /items, e o ML
// documentou que vai DESCONTINUAR esse campo em favor de /items/{id}/prices.
// Se o campo já vier vazio, todo produto importado entra com preço zero — e a
// precificação inteira fica muda. Esta rota mostra os dois lados lado a lado.
//
// NÃO cria, NÃO altera e NÃO encerra nada. Segue o contrato de /api/ml/publicar:
// autorização server-side, refresh_token via RLS, token rotacionado persistido
// antes da operação externa.

import { CAMPOS_PEDIDOS_AO_ML } from "@/lib/marketplaces/mercadolivre";
import { inventariarItem } from "@/modules/integration/domain/inventarioDoItemML";
import {
  lerCanalServidor,
  atualizarRefreshTokenServidor,
} from "@/modules/integration/infrastructure/canalServidor";
import { renovarTokenDaRota } from "@/modules/integration/infrastructure/renovacaoDaRota";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

const API = "https://api.mercadolibre.com";

/** "MLB-4598408351" e "MLB4598408351" são a mesma coisa; a API quer sem hífen. */
function normalizarItemId(bruto: string): string {
  return bruto.trim().toUpperCase().replace(/-/g, "");
}

export async function GET(request: Request) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json({ erro: "Integração ML não configurada no servidor." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const clienteId = (searchParams.get("clienteId") ?? "").trim();
  const itemId = normalizarItemId(searchParams.get("itemId") ?? "");
  if (!clienteId) return Response.json({ erro: "clienteId ausente." }, { status: 400 });
  if (!itemId) return Response.json({ erro: "itemId ausente." }, { status: 400 });

  let ctx;
  try {
    ctx = await exigirAcessoAoCliente(request, clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if (!ctx.supabase) {
    return Response.json({ erro: "Supabase não configurado no servidor." }, { status: 503 });
  }

  try {
    const canal = await lerCanalServidor(ctx.supabase, clienteId, "Mercado Livre");
    if (!canal?.refreshToken) {
      return Response.json({ erro: "Cliente não conectado ao Mercado Livre." }, { status: 400 });
    }
    const renovacao = await renovarTokenDaRota({
      clientId,
      clientSecret,
      refreshToken: canal.refreshToken,
      marketplace: "Mercado Livre",
      oQueFalhou: "ver o diagnóstico deste anúncio",
    });
    if ("recusa" in renovacao) return renovacao.recusa;
    const tokens = renovacao.tokens;
    await atualizarRefreshTokenServidor(ctx.supabase, clienteId, tokens.refreshToken, "Mercado Livre");
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };

    // Os dois lados da pergunta, em paralelo.
    const [itemResp, precosResp] = await Promise.all([
      fetch(`${API}/items/${itemId}`, { headers: auth }),
      fetch(`${API}/items/${itemId}/prices`, { headers: auth }),
    ]);

    const item = itemResp.ok ? ((await itemResp.json()) as Record<string, unknown>) : null;
    const precos = precosResp.ok ? ((await precosResp.json()) as Record<string, unknown>) : null;

    const variacoes = Array.isArray(item?.variations)
      ? (item!.variations as Record<string, unknown>[])
      : [];

    return Response.json({
      itemId,
      // O INVENTÁRIO: o que o ML tem, o que pedimos, e o que ignoramos.
      //
      // A busca acima é `/items/{id}` SEM `?attributes=`, então vem o objeto
      // inteiro — que é justamente o que a importação nunca vê, porque ela usa
      // a lista branca. Sete defeitos em dois dias foram campo não lido; esta
      // é a lista de candidatos ao oitavo.
      inventario: inventariarItem(item, CAMPOS_PEDIDOS_AO_ML),
      // O que a importação lê HOJE:
      deItems: {
        status: itemResp.status,
        price: item?.price ?? null,
        base_price: item?.base_price ?? null,
        original_price: item?.original_price ?? null,
        title: item?.title ?? null,
        category_id: item?.category_id ?? null,
        shipping_dimensions: (item?.shipping as { dimensions?: string })?.dimensions ?? null,
        variacoes: variacoes.length,
        precoDaPrimeiraVariacao: variacoes[0]?.price ?? null,
        // O SKU DO VENDEDOR, com VALOR — não só o nome do campo.
        //
        // Em 18/08/2026 eu procurei "seller_custom_field" no corpo desta
        // resposta, achei só a menção dentro de `inventario.usados`, e concluí
        // que o campo estava VAZIO no anúncio. Era inferência: a rota nunca
        // devolveu o valor. A lojista corrigiu — os SKUs estão lá.
        //
        // Ausência afirmada sem medição é o defeito que este repo mais persegue,
        // e eu o cometi olhando para a ferramenta errada. Agora o valor vem.
        seller_custom_field: (item?.seller_custom_field as string | null) ?? null,
        // E POR VARIAÇÃO, que é onde ele de fato mora num anúncio com grade.
        //
        // SEM CORTE. O corte era 8, e em 18/08/2026 ele me fez ver 46 de 83
        // variações e quase escrever "nenhuma tem SKU" — a mesma frase que eu
        // já tinha errado uma vez hoje, agora só que por amostragem em vez de
        // por leitura no lugar errado. Um anúncio tem no máximo 100 variações
        // no ML; devolver todas custa alguns KB e compra a diferença entre
        // medir e estimar.
        skuDasVariacoes: variacoes.map((v) => ({
          id: (v.id as string | number) ?? null,
          seller_custom_field: (v.seller_custom_field as string | null) ?? null,
          atributos: Array.isArray(v.attribute_combinations)
            ? (v.attribute_combinations as { value_name?: string }[])
                .map((a) => a.value_name ?? "")
                .filter(Boolean)
                .join(" · ")
            : "",
        })),
        // O VÍDEO. O ML devolve `video_id` e a importação do Zion o LÊ — ele
        // aparece entre os campos usados — mas ninguém o guarda: não existe
        // coluna de vídeo em tabela nenhuma. É o mesmo formato que já custou
        // dias nesta base: o dado chega e é descartado na borda.
        //
        // Aqui vai o VALOR, não só a presença: saber que o campo veio não
        // responde se ela usa vídeo, e é essa resposta que decide se isso é
        // dado dela sendo perdido ou oportunidade que nunca existiu.
        video_id: (item?.video_id as string | null) ?? null,
      },
      // AS FOTOS DESTE ANÚNCIO, com o tamanho que o ML guarda de cada uma.
      //
      // `pictures` aparecia no inventário desta rota como aninhado IGNORADO —
      // ela dizia "existe e ninguém lê" e continuava não lendo.
      //
      // Isto responde uma pergunta que nada no Zion respondia (12/08/2026):
      // nossas 651 fotos estão ligadas ao PRODUTO, e nenhuma ao anúncio, então
      // não se sabia quais fotos cada um dos 460 anúncios tem. Sem isso não dá
      // para decidir se trocar a capa conserta a infração — e trocar às cegas
      // é pior, porque `definirFotosDoItem` SUBSTITUI o conjunto: mandar uma
      // lista incompleta apaga foto.
      //
      // `max_size` é o ORIGINAL, não a variante servida pela url. A ordem
      // importa e vai preservada: a primeira é a capa.
      fotos: (Array.isArray(item?.pictures) ? (item!.pictures as Record<string, unknown>[]) : []).map(
        (p, i) => ({
          ordem: i,
          id: String(p.id ?? ""),
          maxSize: String(p.max_size ?? ""),
          qualidade: p.quality ?? null,
        })
      ),
      // O que o ML manda usar a partir de agora:
      dePrices: {
        status: precosResp.status,
        prices: precos?.prices ?? null,
      },
    });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao consultar o item no ML." },
      { status: 502 }
    );
  }
}
