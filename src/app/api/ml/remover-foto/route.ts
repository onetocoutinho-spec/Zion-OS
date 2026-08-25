// TIRA uma foto dos anúncios no ar — a volta que não existia.
//
// ===========================================================================
// O INCIDENTE QUE CRIOU ESTA ROTA — 14/08/2026
// ===========================================================================
//
// `aplicar-capa` colocou uma foto de Havaianas AMARELO como capa de 10
// anúncios AZUL-MARINHO. A foto era quadrada, tinha 1200 de lado, passou em
// todas as guardas — e estava errada, porque quem escolheu a cor foi um
// humano lendo o id errado, não o software.
//
// Naquele momento o repositório tinha ida e não tinha volta: `aplicar-capa`
// põe, `melhor-capa` promove, e NADA tirava. Desfazer exigiria escrever
// código novo com a lojista no prejuízo — que é a pior hora possível para
// escrever código.
//
// Uma capacidade que muda o que a compradora vê e não tem desfazer não está
// pronta. Esta rota é o desfazer.
//
// ===========================================================================
// AS GUARDAS, e cada uma tem um jeito de acabar mal atrás dela
// ===========================================================================
//
// 1. `definirFotosDoItem` SUBSTITUI o conjunto. Mandar a lista errada apaga
//    foto dela. Aqui a lista nova é a atual MENOS UMA, e a conferência é
//    exata: some a foto nomeada, e some SÓ ela.
// 2. Anúncio sem foto o Mercado Livre recusa — e um anúncio sem foto vende
//    zero. Tirar a última foto é recusado.
// 3. `200` do ML é "aceitei", não "tirei". Cada anúncio é RELIDO.
// 4. Para no primeiro erro, devolvendo o que já foi. Metade desfeita sem
//    saber quais é o pior desfecho.

import { definirFotosDoItem } from "@/lib/marketplaces/mercadolivre";
import { respostaDeErro } from "@/lib/http/respostaDeErro";
import {
  lerCanalServidor,
  atualizarRefreshTokenServidor,
  clienteDaCredencial,
} from "@/modules/integration/infrastructure/canalServidor";
import { renovarTokenDaRota } from "@/modules/integration/infrastructure/renovacaoDaRota";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { idDaFotoNoML } from "@/modules/catalog/domain/ensaioDaCapa";
import { semAFoto } from "@/modules/catalog/domain/remocaoDaFoto";

const API = "https://api.mercadolibre.com";
const clientId = process.env.ML_CLIENT_ID as string;
const clientSecret = process.env.ML_CLIENT_SECRET as string;

/** Mesmo teto de `aplicar-capa`: cada anúncio é uma escrita. */
const MAXIMO_POR_CHAMADA = 12;

export async function POST(request: Request) {
  let corpo: {
    clienteId?: string;
    produtoId?: string;
    fotoNoML?: string;
    /**
     * Recorte OPCIONAL: só estes anúncios. Ver a nota em `alvos`.
     */
    mlbs?: string[];
  };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  const clienteId = (corpo.clienteId ?? "").trim();
  const produtoId = (corpo.produtoId ?? "").trim();
  // O id da foto NO MERCADO LIVRE, não o do nosso cadastro: é ele que aparece
  // na lista do anúncio, e é por ele que a remoção casa.
  const fotoNoML = (corpo.fotoNoML ?? "").trim();
  if (!clienteId || !produtoId || !fotoNoML) {
    return Response.json(
      { erro: "clienteId, produtoId e fotoNoML são obrigatórios." },
      { status: 400 }
    );
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

  const { data: anuncios } = await ctx.supabase
    .from("anuncios_gerados")
    .select("ml_item_id, anuncio")
    .eq("cliente_id", clienteId)
    .eq("produto_id", produtoId)
    .not("ml_item_id", "is", null);

  // O RECORTE, e por que ele precisou existir — 20/08/2026.
  //
  // Uma MESMA foto no ML tem UM id, e ela pode estar CERTA num anúncio e
  // ERRADA em outro do mesmo produto.
  //
  // Medido: `604761-MLB116507673175_082026` (a foto da Avelã, marrom) era a
  // capa correta dos anúncios Avelã 34, 36 e 40 — e estava, ao mesmo tempo,
  // dentro dos anúncios Alecrim 35, 37 e 38, que são verdes, porque a cor
  // deles fora deduzida do título e o título diz "Marrom".
  //
  // Tirar pelo produto inteiro consertaria os três verdes e ARRANCARIA A CAPA
  // dos três marrons. A remoção precisa poder mirar.
  //
  // Sem `mlbs`, nada muda: continua valendo para todos os anúncios do produto.
  const recorte = new Set(
    (Array.isArray(corpo.mlbs) ? corpo.mlbs : []).map((m) => String(m).trim().toUpperCase()).filter(Boolean)
  );
  const alvos = (anuncios ?? [])
    .map((a) => ({
      mlb: a.ml_item_id as string,
      titulo:
        ((a.anuncio as { tituloOtimizado?: string } | null)?.tituloOtimizado ?? "") ||
        (a.ml_item_id as string),
    }))
    .filter((a) => recorte.size === 0 || recorte.has(String(a.mlb).toUpperCase()));
  if (alvos.length === 0) {
    return Response.json({ erro: "Este produto não tem anúncio no Mercado Livre." }, { status: 409 });
  }

  const feitos: { mlb: string; titulo: string; fotosAntes: number; fotosDepois: number }[] = [];
  let naoAlcancados = 0;
  const registrar = (nivel: "info" | "warn" | "error", evento: string, extra: Record<string, unknown> = {}) =>
    console.log(
      JSON.stringify({ src: "ml.removerFoto", clienteId, produtoId, fotoNoML, nivel, evento, ...extra })
    );

  try {
    // A CREDENCIAL SO PELO ADMIN — nao por `ctx.supabase`.
    //
    // Esta rota nasceu antes das migracoes 059/061, que tiraram
    // `refresh_token` do alcance de `authenticated` e cifraram a coluna.
    // Com o papel do usuario a leitura nao alcanca mais o dado — e, antes
    // disso, ler credencial com o papel de quem pediu e o nivel de
    // confianca errado. `credencialForaDoNavegador` guarda isso.
    const canal = await lerCanalServidor(clienteDaCredencial(), clienteId, "Mercado Livre");
    if (!canal?.refreshToken) {
      return Response.json({ erro: "Cliente não conectado ao Mercado Livre." }, { status: 400 });
    }
    const renovacao = await renovarTokenDaRota({
      clientId,
      clientSecret,
      refreshToken: canal.refreshToken,
      marketplace: "Mercado Livre",
      oQueFalhou: "tirar a foto dos anúncios",
    });
    if ("recusa" in renovacao) return renovacao.recusa;
    const tokens = renovacao.tokens;
    await atualizarRefreshTokenServidor(clienteDaCredencial(), clienteId, tokens.refreshToken, "Mercado Livre");
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };

    for (const [i, a] of alvos.entries()) {
      if (feitos.length >= MAXIMO_POR_CHAMADA) {
        naoAlcancados = alvos.length - i;
        registrar("info", "teto-da-chamada", { escritas: feitos.length, naoAlcancados });
        break;
      }

      const rLer = await fetch(`${API}/items/${a.mlb}?attributes=id,pictures`, { headers: auth });
      if (!rLer.ok) {
        registrar("error", "falha-ao-ler", { mlb: a.mlb, status: rLer.status });
        return parcial(feitos, a, `não consegui ler as fotos deste anúncio (ML ${rLer.status})`);
      }
      const antes = ((await rLer.json()) as { pictures?: { id?: string }[] }).pictures ?? [];
      const idsAntes = antes.map((p) => String(p.id ?? "")).filter(Boolean);

      const plano = semAFoto(idsAntes, fotoNoML);
      if (plano.motivo === "nao-esta-la") {
        // Não é erro: é um anúncio que não tem essa foto. Seguir é o certo.
        registrar("info", "nao-esta-la", { mlb: a.mlb });
        continue;
      }
      if (plano.motivo === "ficaria-sem-foto") {
        registrar("error", "ficaria-sem-foto", { mlb: a.mlb });
        return parcial(
          feitos,
          a,
          "essa é a única foto do anúncio, e anúncio sem foto o Mercado Livre não aceita"
        );
      }

      try {
        await definirFotosDoItem(tokens.accessToken, a.mlb, plano.novaOrdem);
      } catch (e) {
        registrar("error", "ml-recusou", { mlb: a.mlb, erro: e instanceof Error ? e.message : "?" });
        return parcial(feitos, a, e instanceof Error ? e.message : "o Mercado Livre recusou a mudança");
      }

      // CONFERE. `200` é "aceitei", não "tirei".
      const rDepois = await fetch(`${API}/items/${a.mlb}?attributes=id,pictures`, { headers: auth });
      const depois = rDepois.ok
        ? ((await rDepois.json()) as { pictures?: { id?: string; max_size?: string }[] })
        : null;
      const idsDepois = (depois?.pictures ?? []).map((p) => String(p.id ?? "")).filter(Boolean);
      if (idsDepois.includes(fotoNoML)) {
        registrar("error", "foto-continua-la", { mlb: a.mlb });
        return parcial(feitos, a, "o Mercado Livre aceitou o pedido mas a foto continuou no anúncio");
      }
      if (idsDepois.length !== idsAntes.length - 1) {
        // Sumiu mais do que a foto nomeada. Parar aqui é o mínimo: seguir
        // repetiria a perda nos próximos.
        registrar("error", "sumiu-mais-que-uma", { mlb: a.mlb, antes: idsAntes.length, depois: idsDepois.length });
        return parcial(
          feitos,
          a,
          `o anúncio tinha ${idsAntes.length} fotos e ficou com ${idsDepois.length} — parei antes de repetir isso`
        );
      }

      // A capa mudou junto, então o tamanho registrado também muda. Mesma
      // disciplina de `aplicar-capa`: o que fazemos, anotamos.
      const tamanhoAgora = ((depois?.pictures ?? [])[0]?.max_size ?? "").trim();
      if (tamanhoAgora) {
        const { error: erroAnotar } = await ctx.supabase
          .from("anuncios_gerados")
          .update({ foto_capa_max_size: tamanhoAgora })
          .eq("cliente_id", clienteId)
          .eq("ml_item_id", a.mlb);
        if (erroAnotar) {
          registrar("warn", "tirou-mas-nao-anotou", { mlb: a.mlb, erro: erroAnotar.message });
        }
      }

      feitos.push({
        mlb: a.mlb,
        titulo: a.titulo,
        fotosAntes: idsAntes.length,
        fotosDepois: idsDepois.length,
      });
      registrar("info", "tirou", { mlb: a.mlb, capa: tamanhoAgora });
    }

    const sobra =
      naoAlcancados > 0
        ? ` Parei em ${MAXIMO_POR_CHAMADA} de uma vez — faltam ${naoAlcancados} anúncio(s). Peça de novo que eu continuo.`
        : "";
    return Response.json({
      ok: true,
      trocados: feitos.length,
      naoAlcancados,
      feitos,
      frase:
        (feitos.length === 0
          ? "Essa foto não estava em nenhum anúncio deste produto."
          : `Tirei a foto de ${feitos.length} anúncio(s).`) + sobra,
    });
  } catch (e) {
    return respostaDeErro("ml/remover-foto", e, "Falha ao tirar a foto.", 422);
  }
}

/** O que JÁ foi, e onde parou. Nunca 500 seco depois de ter mexido em alguns. */
function parcial(
  feitos: { mlb: string; titulo: string; fotosAntes: number; fotosDepois: number }[],
  onde: { mlb: string; titulo: string },
  motivo: string
) {
  return Response.json(
    {
      ok: false,
      parou: true,
      trocados: feitos.length,
      feitos,
      pareiEm: { mlb: onde.mlb, titulo: onde.titulo, motivo },
      frase:
        feitos.length === 0
          ? `Não mexi em nenhum anúncio. Parei no ${onde.mlb}: ${motivo}.`
          : `Tirei a foto de ${feitos.length} anúncio(s) e parei no ${onde.mlb}: ${motivo}.`,
    },
    { status: 207 }
  );
}

/** Reexportado para quem só tem a URL do nosso cadastro em mãos. */
export { idDaFotoNoML };
