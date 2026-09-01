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
  clienteDaCredencial,
} from "@/modules/integration/infrastructure/canalServidor";
import { renovarTokenDaRota } from "@/modules/integration/infrastructure/renovacaoDaRota";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { respostaDeErro } from "@/lib/http/respostaDeErro";

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
    const canal = await lerCanalServidor(clienteDaCredencial(), clienteId, "Mercado Livre");
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
    await atualizarRefreshTokenServidor(clienteDaCredencial(), clienteId, tokens.refreshToken, "Mercado Livre");
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };

    // Os dois lados da pergunta, em paralelo.
    //
    // `include_attributes=all` porque SEM ele o ML devolve as variações com
    // `attributes` VAZIO. Medido em 18/08/2026: 0 de 24 variações traziam
    // qualquer atributo, e eu quase concluí (de novo) que o SKU não existia —
    // enquanto o painel da lojista mostrava `00895337` na variação 37 BR.
    const [itemResp, precosResp, variacoesResp, visitasResp] = await Promise.all([
      fetch(`${API}/items/${itemId}?include_attributes=all`, { headers: auth }),
      fetch(`${API}/items/${itemId}/prices`, { headers: auth }),
      // O endpoint dedicado às variações. Existe justamente porque o objeto do
      // item nem sempre carrega tudo o que a variação tem.
      fetch(`${API}/items/${itemId}/variations`, { headers: auth }),
      // AS VISITAS. Sem elas não dá para decidir entre dois anúncios do mesmo
      // produto: um pode não vender porque ninguém o vê, e não porque o
      // comprador o rejeitou. São coisas diferentes e o remédio é diferente.
      fetch(`${API}/visits/items?ids=${itemId}`, { headers: auth }),
    ]);

    const item = itemResp.ok ? ((await itemResp.json()) as Record<string, unknown>) : null;
    const precos = precosResp.ok ? ((await precosResp.json()) as Record<string, unknown>) : null;
    const visitas = visitasResp.ok
      ? ((await visitasResp.json()) as Record<string, number>)
      : null;
    const variacoesDedicadas = variacoesResp.ok
      ? ((await variacoesResp.json()) as Record<string, unknown>[] | Record<string, unknown>)
      : null;

    const doItem = Array.isArray(item?.variations)
      ? (item!.variations as Record<string, unknown>[])
      : [];
    const dedicadas = Array.isArray(variacoesDedicadas)
      ? (variacoesDedicadas as Record<string, unknown>[])
      : [];

    // Prefere a fonte que TROUXE atributos. Não escolher por regra fixa: quem
    // manda é quem tem o dado, e isso varia por anúncio (grade antiga x
    // inventário novo com `user_product_id`).
    const temAtributos = (vs: Record<string, unknown>[]) =>
      vs.some((v) => Array.isArray(v.attributes) && (v.attributes as unknown[]).length > 0);
    const variacoes = temAtributos(doItem) || dedicadas.length === 0 ? doItem : dedicadas;

    // ONDE O SKU ESTAVA, de verdade. Três fontes, contadas lado a lado, para
    // que a próxima pessoa não precise adivinhar qual endpoint responde.
    const contar = (vs: Record<string, unknown>[]) =>
      vs.filter((v) => {
        const as = Array.isArray(v.attributes)
          ? (v.attributes as { id?: string; value_name?: string | null }[])
          : [];
        return (
          Boolean(v.seller_custom_field) ||
          as.some((a) => a.id === "SELLER_SKU" && a.value_name)
        );
      }).length;
    const ondeEstaOSku = {
      noObjetoDoItem: `${contar(doItem)} de ${doItem.length}`,
      noEndpointDeVariacoes: `${contar(dedicadas)} de ${dedicadas.length}`,
      statusDoEndpointDeVariacoes: variacoesResp.status,
      // Se o anúncio usa inventário novo, o SKU mora no "user product", que é
      // um objeto separado — nem no item, nem na variação.
      userProductIds: [
        ...new Set(
          [item, ...doItem, ...dedicadas]
            .map((o) => (o?.user_product_id as string | null) ?? null)
            .filter(Boolean)
        ),
      ].slice(0, 5),
    };

    return Response.json({
      itemId,
      ondeEstaOSku,
      // O INVENTÁRIO: o que o ML tem, o que pedimos, e o que ignoramos.
      //
      // A busca acima é `/items/{id}` SEM `?attributes=`, então vem o objeto
      // inteiro — que é justamente o que a importação nunca vê, porque ela usa
      // a lista branca. Sete defeitos em dois dias foram campo não lido; esta
      // é a lista de candidatos ao oitavo.
      inventario: inventariarItem(item, CAMPOS_PEDIDOS_AO_ML),
      // O que a importação lê HOJE:
      deItems: {
        // `httpStatus`, não `status`.
        //
        // Chamava-se `status` e era o código HTTP da REQUISIÇÃO. Em 18/08/2026
        // eu levantei 12 pares de anúncios para decidir qual pausar, li
        // `status: 200` nos 24 e entendi "todos no ar". O ML então recusou a
        // primeira pausa com `status:inactive` — o anúncio já estava fora.
        //
        // Dois campos com o mesmo nome e significados diferentes; o levantamento
        // inteiro saiu errado por isso. Renomear é o conserto: `httpStatus` é a
        // requisição, `statusDoAnuncio` é o anúncio.
        httpStatus: itemResp.status,
        // O ESTADO REAL: active, paused, closed, inactive, under_review.
        statusDoAnuncio: (item?.status as string | null) ?? null,
        subStatus: Array.isArray(item?.sub_status) ? (item!.sub_status as string[]) : [],
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
        //
        // O SKU MORA EM DOIS LUGARES, E EU SÓ OLHAVA UM.
        //
        // `seller_custom_field` é o campo LEGADO. O painel do vendedor hoje
        // grava o SKU como ATRIBUTO `SELLER_SKU` dentro da variação, e o GTIN
        // como atributo `GTIN`. Em 18/08/2026 eu li só o campo legado, vi 96
        // variações vazias e escrevi "o SKU não existe no ML". A lojista
        // mandou o print do painel dela: `00895337`, ali, na variação 37 BR.
        //
        // Foi a TERCEIRA vez no mesmo dia que afirmei ausência olhando o lugar
        // errado. Por isso `todosOsAtributos` vem INTEIRO: eu não filtro mais
        // por palpite sobre qual campo importa. O que o ML manda, a rota mostra.
        skuDasVariacoes: variacoes.map((v) => {
          const atributos = Array.isArray(v.attributes)
            ? (v.attributes as { id?: string; value_name?: string | null }[])
            : [];
          const acharAtributo = (id: string) =>
            atributos.find((a) => a.id === id)?.value_name ?? null;
          return {
            id: (v.id as string | number) ?? null,
            // Os três candidatos a SKU, lado a lado, sem eu decidir qual vale.
            seller_custom_field: (v.seller_custom_field as string | null) ?? null,
            SELLER_SKU: acharAtributo("SELLER_SKU"),
            GTIN: acharAtributo("GTIN"),
            combinacao: Array.isArray(v.attribute_combinations)
              ? (v.attribute_combinations as { value_name?: string }[])
                  .map((a) => a.value_name ?? "")
                  .filter(Boolean)
                  .join(" · ")
              : "",
            todosOsAtributos: atributos
              .map((a) => `${a.id ?? "?"}=${a.value_name ?? ""}`)
              .join(" | "),
          };
        }),
        // E NO NÍVEL DO ITEM, pelo mesmo motivo: anúncio sem grade também pode
        // ter o SKU no atributo em vez do campo legado.
        //
        // 20/08/2026 — E AQUI EU REPETI O DEFEITO DENTRO DO PRÓPRIO CONSERTO.
        //
        // Três linhas acima está escrito "eu não filtro mais por palpite sobre
        // qual campo importa". Na VARIAÇÃO isso é verdade. No ITEM eu filtrava
        // por `SELLER_SKU` e `GTIN` e descartava o resto.
        //
        // O custo apareceu no Papete Modare: 17 anúncios rachados em 4 famílias
        // no ML, e a lojista perguntando por quê. Nesta conta cada TAMANHO é um
        // item separado (modelo User Products) — então `SIZE_GRID_ID` e
        // `SIZE_GRID_ROW_ID`, que são o que o ML usa para agrupar a família,
        // moram no NÍVEL DO ITEM. O filtro os jogava fora, e a pergunta "por que
        // o Bege 36 está sozinho" não tinha como ser respondida com o que a
        // rota devolvia.
        //
        // Agora vem INTEIRO, no mesmo formato da variação.
        atributosDoItem: (Array.isArray(item?.attributes)
          ? (item!.attributes as {
              id?: string;
              value_name?: string | null;
              value_id?: string | null;
            }[])
          : []
        )
          .map((a) => `${a.id ?? "?"}=${a.value_name ?? a.value_id ?? ""}`)
          .join(" | "),
        // O VÍDEO. O ML devolve `video_id` e a importação do Zion o LÊ — ele
        // aparece entre os campos usados — mas ninguém o guarda: não existe
        // coluna de vídeo em tabela nenhuma. É o mesmo formato que já custou
        // dias nesta base: o dado chega e é descartado na borda.
        //
        // Aqui vai o VALOR, não só a presença: saber que o campo veio não
        // responde se ela usa vídeo, e é essa resposta que decide se isso é
        // dado dela sendo perdido ou oportunidade que nunca existiu.
        video_id: (item?.video_id as string | null) ?? null,
        // ===================================================================
        // O QUE DECIDE ENTRE DOIS ANÚNCIOS DO MESMO PRODUTO
        // ===================================================================
        //
        // Em 18/08/2026 a base tinha 12 PARES de anúncios vendendo o mesmo
        // par de sapato, mesmo EAN, mesmo tamanho — descobertos porque cada
        // "variante duplicada" carregava um MLB diferente em `observacoes`.
        //
        // Eles competem entre si: dividem visita, dividem relevância, e o ML
        // não soma o histórico dos dois. Decidir qual pausar sem estes números
        // é apostar — e apostar aqui apaga o histórico de venda do lado certo.
        //
        // `sold_quantity` é o que já vendeu; `health` é a nota do ML;
        // `start_time` diz qual é o mais antigo (histórico não se recupera).
        sold_quantity: (item?.sold_quantity as number | null) ?? null,
        health: (item?.health as number | null) ?? null,
        listing_type_id: (item?.listing_type_id as string | null) ?? null,
        start_time: (item?.start_time as string | null) ?? null,
        available_quantity: (item?.available_quantity as number | null) ?? null,
        visitas: visitas ? (visitas[itemId] ?? null) : null,
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
    return respostaDeErro("ml/diagnostico-item", e, "Falha ao consultar o item no ML.", 502);
  }
}
