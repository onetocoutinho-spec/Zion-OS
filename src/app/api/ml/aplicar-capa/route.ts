// APLICA a foto da lojista como capa dos anúncios de UMA cor.
//
// ===========================================================================
// A ÚNICA ROTA DESTE CAMINHO QUE ESCREVE — e as três regras que a governam
// ===========================================================================
//
// 1. UMA COR POR VEZ. Não existe "arruma tudo". A unidade é a cor porque é a
//    unidade do trabalho dela: fotografou o amarelo, aplica no amarelo.
//
// 2. PARA NO PRIMEIRO ERRO. Seguir depois de uma falha deixaria a lojista com
//    metade dos anúncios trocados e nenhum jeito de saber quais. O que já foi
//    volta na resposta, anúncio por anúncio.
//
// 3. CONFERE DEPOIS DE CADA UM. `200` do Mercado Livre significa "aceitei o
//    pedido", não "troquei a capa". Em 03/08/2026 alguém afirmou "capa
//    ajustada" com base no 200, a lojista reconferiu, e a capa era a antiga.
//    Aqui cada anúncio é RELIDO, e sem a releitura confirmar não há sucesso.
//
// O plano NÃO vem do cliente. Ele é recomposto aqui, do estado de agora — um
// plano montado há dez minutos pode ter envelhecido, e aplicar lista velha
// APAGA a foto que entrou nesse meio-tempo.

import {
  subirFoto,
  definirFotosDoItem,
} from "@/lib/marketplaces/mercadolivre";
import {
  lerCanalServidor,
  atualizarRefreshTokenServidor,
} from "@/modules/integration/infrastructure/canalServidor";
import { renovarTokenDaRota } from "@/modules/integration/infrastructure/renovacaoDaRota";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import {
  corDoTitulo,
  ensaiarTrocaDeCapa,
  nenhumaFotoSumiu,
} from "@/modules/catalog/domain/ensaioDaCapa";
import { coresDoProduto } from "@/modules/catalog/domain/corDaFoto";

const API = "https://api.mercadolibre.com";
const clientId = process.env.ML_CLIENT_ID as string;
const clientSecret = process.env.ML_CLIENT_SECRET as string;

/** Mesmo teto do ensaio: cada anúncio é uma escrita, e escrita em lote assusta. */
const MAXIMO_POR_CHAMADA = 12;

export async function POST(request: Request) {
  let corpo: { clienteId?: string; produtoId?: string; imagemId?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  const clienteId = (corpo.clienteId ?? "").trim();
  const produtoId = (corpo.produtoId ?? "").trim();
  const imagemId = (corpo.imagemId ?? "").trim();
  if (!clienteId || !produtoId || !imagemId) {
    return Response.json({ erro: "clienteId, produtoId e imagemId são obrigatórios." }, { status: 400 });
  }

  let ctx;
  try {
    ctx = await exigirAcessoAoCliente(request, clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if (!ctx.supabase) {
    return Response.json({ erro: "Supabase não configurado no servidor." }, { status: 503 });
  }

  const { data: foto } = await ctx.supabase
    .from("imagens_produto")
    .select("id, produto_id, cor, url")
    .eq("id", imagemId)
    .eq("cliente_id", clienteId)
    .maybeSingle();

  if (!foto) return Response.json({ erro: "Foto não encontrada nesta conta." }, { status: 404 });
  if (foto.produto_id !== produtoId) {
    return Response.json({ erro: "Essa foto é de outro produto." }, { status: 400 });
  }
  if (!foto.cor) {
    return Response.json(
      { erro: "Essa foto não tem cor definida, e cada anúncio seu é de uma cor.", motivo: "sem-cor" },
      { status: 409 }
    );
  }

  const [{ data: variantes }, { data: anuncios }] = await Promise.all([
    ctx.supabase.from("produto_variantes").select("cor").eq("produto_id", produtoId),
    ctx.supabase
      .from("anuncios_gerados")
      .select("ml_item_id, anuncio")
      .eq("cliente_id", clienteId)
      .eq("produto_id", produtoId)
      .not("ml_item_id", "is", null),
  ]);

  const cores = coresDoProduto(variantes ?? []);
  const daCor = (anuncios ?? [])
    .map((a) => ({
      mlb: a.ml_item_id as string,
      titulo:
        ((a.anuncio as { tituloOtimizado?: string } | null)?.tituloOtimizado ?? "") ||
        (a.ml_item_id as string),
    }))
    .filter((a) => {
      const c = corDoTitulo(a.titulo, cores);
      return c !== null && c.toLowerCase() === String(foto.cor).toLowerCase();
    })
    .slice(0, MAXIMO_POR_CHAMADA);

  if (daCor.length === 0) {
    return Response.json(
      { erro: `Nenhum anúncio desta cor (${foto.cor}) foi encontrado.`, motivo: "sem-alvos" },
      { status: 409 }
    );
  }

  const feitos: { mlb: string; titulo: string; fotosAntes: number; fotosDepois: number }[] = [];
  const registrar = (nivel: "info" | "warn" | "error", evento: string, extra: Record<string, unknown> = {}) =>
    console.log(
      JSON.stringify({ src: "ml.aplicarCapa", clienteId, produtoId, cor: foto.cor, nivel, evento, ...extra })
    );

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
      oQueFalhou: "aplicar a capa nos anúncios",
    });
    if ("recusa" in renovacao) return renovacao.recusa;
    const tokens = renovacao.tokens;
    await atualizarRefreshTokenServidor(ctx.supabase, clienteId, tokens.refreshToken, "Mercado Livre");
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };

    // ---- A FOTO SOBE UMA VEZ SÓ, e ainda não entra em anúncio nenhum. ----
    const arquivo = await fetch(foto.url as string);
    if (!arquivo.ok) {
      return Response.json({ erro: "Não consegui baixar a foto do seu cadastro." }, { status: 502 });
    }
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const novaFotoId = await subirFoto(tokens.accessToken, bytes, `${produtoId}-${foto.cor}.jpg`);
    registrar("info", "foto-no-acervo", { novaFotoId, bytes: bytes.length });

    // ---- UM ANÚNCIO POR VEZ, PARANDO NO PRIMEIRO ERRO ----
    for (const a of daCor) {
      // O estado de AGORA, relido por anúncio. Compor a partir do que o ensaio
      // viu minutos atrás apagaria foto que entrou nesse meio-tempo.
      const rLer = await fetch(`${API}/items/${a.mlb}?attributes=id,pictures`, { headers: auth });
      if (!rLer.ok) {
        registrar("error", "falha-ao-ler", { mlb: a.mlb, status: rLer.status });
        return parcial(feitos, a, `não consegui ler as fotos deste anúncio (ML ${rLer.status})`, foto.cor as string);
      }
      const antes = ((await rLer.json()) as { pictures?: { id?: string }[] }).pictures ?? [];
      const idsAntes = antes.map((p) => String(p.id ?? "")).filter(Boolean);

      const plano = ensaiarTrocaDeCapa(
        [{ mlb: a.mlb, titulo: a.titulo, fotos: idsAntes }],
        cores,
        String(foto.cor),
        novaFotoId
      );
      const alvo = plano.alvos[0];
      if (!alvo) {
        // Já era a capa, ou o título deixou de casar. Não é erro: é um anúncio
        // que não precisa de nada, e seguir para o próximo é o certo.
        registrar("info", "sem-mudanca", { mlb: a.mlb, motivo: plano.fora[0]?.motivo ?? "nao-e-alvo" });
        continue;
      }
      // A ÚLTIMA TRANCA ANTES DE ESCREVER. `definirFotosDoItem` substitui o
      // conjunto: se a lista nova não contém tudo o que havia, o envio apaga
      // foto dela. Recusar aqui é sempre melhor que descobrir depois.
      if (!nenhumaFotoSumiu(idsAntes, alvo.novaOrdem)) {
        registrar("error", "composicao-perderia-foto", { mlb: a.mlb, antes: idsAntes.length });
        return parcial(feitos, a, "a lista nova perderia uma foto, então não enviei nada neste anúncio", foto.cor as string);
      }

      try {
        await definirFotosDoItem(tokens.accessToken, a.mlb, alvo.novaOrdem);
      } catch (e) {
        registrar("error", "ml-recusou", { mlb: a.mlb, erro: e instanceof Error ? e.message : "?" });
        return parcial(feitos, a, e instanceof Error ? e.message : "o Mercado Livre recusou a troca", foto.cor as string);
      }

      // CONFERE. Sem isto, `200` viraria "trocou" — o defeito de 03/08.
      const rDepois = await fetch(`${API}/items/${a.mlb}?attributes=id,pictures`, { headers: auth });
      const depois = rDepois.ok ? ((await rDepois.json()) as { pictures?: { id?: string }[] }) : null;
      const capaAgora = (depois?.pictures ?? [])[0]?.id?.trim() ?? "";
      if (capaAgora !== novaFotoId) {
        registrar("error", "capa-nao-mudou", { mlb: a.mlb, capaAgora });
        return parcial(
          feitos,
          a,
          "o Mercado Livre aceitou o pedido mas a capa continuou a antiga",
          foto.cor as string
        );
      }
      feitos.push({
        mlb: a.mlb,
        titulo: a.titulo,
        fotosAntes: idsAntes.length,
        fotosDepois: (depois?.pictures ?? []).length,
      });
      registrar("info", "trocou", { mlb: a.mlb });
    }

    return Response.json({
      ok: true,
      cor: foto.cor,
      trocados: feitos.length,
      feitos,
      frase:
        feitos.length === 0
          ? `Nenhum anúncio de ${foto.cor} precisava de troca — todos já estavam com essa capa.`
          : `Troquei a capa de ${feitos.length} anúncio(s) de ${foto.cor}.`,
    });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao aplicar a capa." },
      { status: 502 }
    );
  }
}

/**
 * A resposta de parada: o que JÁ foi, e onde parou.
 *
 * Nunca 500 seco. A lojista precisa saber exatamente quais anúncios mudaram —
 * "deu erro" depois de trocar três de cinco é o pior desfecho possível.
 */
function parcial(
  feitos: { mlb: string; titulo: string; fotosAntes: number; fotosDepois: number }[],
  onde: { mlb: string; titulo: string },
  motivo: string,
  cor: string
) {
  return Response.json(
    {
      ok: false,
      parou: true,
      cor,
      trocados: feitos.length,
      feitos,
      pareiEm: { mlb: onde.mlb, titulo: onde.titulo, motivo },
      frase:
        feitos.length === 0
          ? `Não troquei nenhum anúncio. Parei no ${onde.mlb}: ${motivo}.`
          : `Troquei ${feitos.length} anúncio(s) e parei no ${onde.mlb}: ${motivo}. Os demais desta cor continuam como estavam.`,
    },
    { status: 207 }
  );
}
