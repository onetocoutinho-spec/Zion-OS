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
  idDaFotoNoML,
} from "@/modules/catalog/domain/ensaioDaCapa";
import { coresDoProduto } from "@/modules/catalog/domain/corDaFoto";
import { quadrarCapa } from "@/modules/integration/domain/quadrarCapa";
import { LADO_MINIMO_DA_CAPA } from "@/modules/integration/domain/capaForaDoPadrao";

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
    });
  // O TETO CONTA ESCRITAS, NÃO CANDIDATOS — e a diferença é entre terminar e
  // nunca terminar.
  //
  // Medido em 14/08/2026: 11 pares (produto, cor) desta conta têm MAIS de 12
  // anúncios, e o maior tem 25. Cortando a lista de candidatos aqui, a chamada
  // trocava os 12 primeiros e devolvia "troquei 12" — sem dizer que 13 ficaram.
  // E repetir a chamada não resolvia: o corte pegaria os MESMOS 12 primeiros,
  // que agora já estão com a capa certa, e os 13 do fim nunca seriam
  // alcançados. Um teto que não termina é pior que teto nenhum.
  //
  // Contando ESCRITAS, o anúncio que já está certo é pulado de graça e a
  // chamada seguinte continua de onde esta parou.

  if (daCor.length === 0) {
    return Response.json(
      { erro: `Nenhum anúncio desta cor (${foto.cor}) foi encontrado.`, motivo: "sem-alvos" },
      { status: 409 }
    );
  }

  const feitos: { mlb: string; titulo: string; fotosAntes: number; fotosDepois: number }[] = [];
  /** Os que o teto deixou para a próxima chamada. Nunca fica em silêncio. */
  let naoAlcancados = 0;
  /** Anúncios que a rota deixou como estavam, e por quê. Vazio é resposta. */
  const pulados: { mlb: string; motivo: string }[] = [];
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

    // ---- A FOTO. Reusar quando ela JÁ vive no ML; subir só quando não vive.
    //
    // ===================================================================
    // O DEFEITO QUE ISTO CONSERTA — cometido por mim em 13/08/2026
    // ===================================================================
    //
    // A primeira versão baixava `foto.url` e subia sempre. Duas falhas de uma
    // vez, medidas em produção nos 5 anúncios amarelos da lojista:
    //
    // 1. `foto.url` é a variante `-O` do CDN do ML, que serve 500px. Subi uma
    //    cópia de 500x500 de uma imagem cujo original tem 1200x1200 — e as
    //    capas dela PIORARAM. É exatamente a armadilha que eu tinha escrito na
    //    migração 059 e na qual entrei mesmo assim.
    //
    // 2. Todo upload cria um id NOVO no ML. Então `ja-e-a-capa` nunca dispara
    //    para a mesma imagem reenviada — e `612023-...`, que já era a capa dos
    //    cinco, foi "trocada" por uma cópia pior de si mesma.
    //
    // Reusar o id resolve os dois: nada é reenviado, nada é reprocessado, e a
    // foto que já é capa é reconhecida como tal.
    const idNoML = idDaFotoNoML(foto.url as string);
    let novaFotoId: string;
    if (idNoML) {
      novaFotoId = idNoML;
      registrar("info", "foto-ja-no-ml", { novaFotoId });
    } else {
      // Foto do Storage dela (veio do celular): essa precisa subir mesmo, e o
      // arquivo lá É o original — não há variante para errar.
      const arquivo = await fetch(foto.url as string);
      if (!arquivo.ok) {
        return Response.json({ erro: "Não consegui baixar a foto do seu cadastro." }, { status: 502 });
      }
      const bytes = Buffer.from(await arquivo.arrayBuffer());

      // ===================================================================
      // QUADRAR AQUI — a ligação que faltava entre três peças prontas
      // ===================================================================
      //
      // MEDIDO EM 20/08/2026. O Papete Modare tinha CINCO fotos boas no acervo
      // da lojista, uma por cor, todas em 960x1280. Os anúncios dela no ML
      // continuavam com capa `492x245`, e 7 deles derrubados por isso.
      //
      // O software tinha as três peças e elas nunca se encontraram:
      //
      //   `melhor-capa`  promove foto que JÁ está no padrão — nenhuma estava,
      //                  então respondeu `trocariam: 0` e parou.
      //   `quadrar-capa` completa a lateral com branco — mas só sabe pegar a
      //                  foto que já está DENTRO do anúncio, e lá só há a ruim.
      //   `aplicar-capa` sobe a foto do acervo — e subia 960x1280 como estava,
      //                  que o ML recusa por não ser quadrada.
      //
      // Cada uma parou na própria trava, e as três estavam certas. Faltava
      // esta linha: a foto do acervo passa por `quadrarCapa` antes de subir.
      //
      // `contain` nunca corta e nunca estica — o produto continua inteiro, e o
      // que entra é branco na lateral. E a recusa dela é 422 com motivo: foto
      // cujo MAIOR lado é menor que o mínimo precisa mesmo de foto nova, e
      // ampliar inventaria pixel.
      //
      // Só o caminho do ACERVO quadra. O `idNoML` acima reusa a foto que já
      // vive no ML sem reprocessar — e quadrar ali criaria um id novo, que é
      // exatamente o defeito de 13/08 (capa "trocada" por cópia pior de si).
      const pronta = await quadrarCapa(bytes);
      // `quadrarCapa` RECUSA quando a foto já está no padrão — e essa recusa é
      // sucesso, não erro: significa que ela serve como está. Tratá-la como
      // falha impediria de aplicar justamente a foto boa.
      const jaEstavaNoPadrao = !pronta.ok && /dentro do padrão/i.test(pronta.motivo);
      if (!pronta.ok && !jaEstavaNoPadrao) {
        registrar("warn", "capa-nao-quadravel", { motivo: pronta.motivo });
        return Response.json({ erro: pronta.motivo, motivo: "nao-quadravel" }, { status: 422 });
      }
      const enviar = pronta.ok ? pronta.imagem : bytes;
      novaFotoId = await subirFoto(tokens.accessToken, enviar, `${produtoId}-${foto.cor}.jpg`);
      registrar("info", "foto-no-acervo", {
        novaFotoId,
        bytes: enviar.length,
        quadrada: pronta.ok,
      });
    }

    // ---- UM ANÚNCIO POR VEZ, PARANDO NO PRIMEIRO ERRO ----
    for (const [i, a] of daCor.entries()) {
      // O TETO, medido em escritas. Ver o comentário na montagem de `daCor`.
      if (feitos.length >= MAXIMO_POR_CHAMADA) {
        naoAlcancados = daCor.length - i;
        registrar("info", "teto-da-chamada", { escritas: feitos.length, naoAlcancados });
        break;
      }
      // O estado de AGORA, relido por anúncio. Compor a partir do que o ensaio
      // viu minutos atrás apagaria foto que entrou nesse meio-tempo.
      //
      // `status` e o TAMANHO DA CAPA vêm junto — os dois decidem PULAR, e a
      // diferença entre pular e parar é o que este conserto trouxe. Ver abaixo.
      const rLer = await fetch(
        `${API}/items/${a.mlb}?attributes=id,pictures,status,sub_status`,
        { headers: auth }
      );
      if (!rLer.ok) {
        registrar("error", "falha-ao-ler", { mlb: a.mlb, status: rLer.status });
        return parcial(feitos, a, `não consegui ler as fotos deste anúncio (ML ${rLer.status})`, foto.cor as string, novaFotoId);
      }
      const itemAgora = (await rLer.json()) as {
        pictures?: { id?: string; max_size?: string }[];
        status?: string;
      };
      const antes = itemAgora.pictures ?? [];
      const idsAntes = antes.map((p) => String(p.id ?? "")).filter(Boolean);

      // =====================================================================
      // PULAR NÃO É PARAR — os dois defeitos de 20/08/2026
      // =====================================================================
      //
      // A lojista aplicou a capa do Papete Marrom. Sete anúncios da cor; o de
      // tamanho 39 estava INACTIVE, e o ML recusa foto em anúncio fora do ar:
      // "pictures is not modifiable". A rota parou ali — correto para erro, e
      // errado para ESTE erro, porque os tamanhos 38 e 40 vinham depois na fila
      // e nunca foram alcançados.
      //
      // Rodar de novo não resolvia: a ordem é a mesma, então travava no mesmo
      // 39. E aí o segundo defeito aparecia — os QUATRO que já estavam com a
      // capa certa eram refeitos, cada rodada acrescentando uma cópia da mesma
      // foto. De 4 fotos para 5, depois para 6.
      //
      // A causa do segundo é a de 13/08: todo upload cria um id NOVO no ML, e
      // `ja-e-a-capa` compara por id. Uma reenviada nunca é reconhecida como a
      // que já está lá.
      //
      // As duas travas abaixo são "pule este e siga", não "pare tudo":
      //
      //   1. NÃO MODIFICÁVEL. Anúncio fora do ar não aceita foto — não é falha
      //      nossa nem dela, e não deve bloquear os outros da mesma cor.
      //   2. CAPA JÁ BOA. Se a capa atual já cumpre o mínimo do ML, reenviar só
      //      empilha cópia. Compara pelo TAMANHO, não pelo id, justamente
      //      porque o id novo nunca bate.
      const naoModificavel = ["inactive", "closed", "payment_required"].includes(
        String(itemAgora.status ?? "")
      );
      if (naoModificavel) {
        registrar("info", "pulado-nao-modificavel", { mlb: a.mlb, status: itemAgora.status });
        pulados.push({ mlb: a.mlb, motivo: `está ${itemAgora.status} — o ML não deixa trocar foto` });
        continue;
      }
      const ladoDaCapa = (() => {
        const m = /^(\d+)x(\d+)$/.exec(String(antes[0]?.max_size ?? ""));
        return m ? Math.min(Number(m[1]), Number(m[2])) : 0;
      })();
      if (ladoDaCapa >= LADO_MINIMO_DA_CAPA) {
        registrar("info", "pulado-capa-ja-boa", { mlb: a.mlb, capa: antes[0]?.max_size });
        pulados.push({ mlb: a.mlb, motivo: `a capa já está ${antes[0]?.max_size}` });
        continue;
      }

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
        return parcial(feitos, a, "a lista nova perderia uma foto, então não enviei nada neste anúncio", foto.cor as string, novaFotoId);
      }

      try {
        await definirFotosDoItem(tokens.accessToken, a.mlb, alvo.novaOrdem);
      } catch (e) {
        registrar("error", "ml-recusou", { mlb: a.mlb, erro: e instanceof Error ? e.message : "?" });
        return parcial(feitos, a, e instanceof Error ? e.message : "o Mercado Livre recusou a troca", foto.cor as string, novaFotoId);
      }

      // CONFERE. Sem isto, `200` viraria "trocou" — o defeito de 03/08.
      const rDepois = await fetch(`${API}/items/${a.mlb}?attributes=id,pictures`, { headers: auth });
      const depois = rDepois.ok
        ? ((await rDepois.json()) as { pictures?: { id?: string; max_size?: string }[] })
        : null;
      const capaAgora = (depois?.pictures ?? [])[0]?.id?.trim() ?? "";
      if (capaAgora !== novaFotoId) {
        registrar("error", "capa-nao-mudou", { mlb: a.mlb, capaAgora });
        return parcial(
          feitos,
          a,
          "o Mercado Livre aceitou o pedido mas a capa continuou a antiga",
          foto.cor as string,
          novaFotoId
        );
      }
      // ANOTA O QUE ACABAMOS DE FAZER.
      // ===================================================================
      // Medido em 14/08/2026, logo depois da primeira troca real: o Mercado
      // Livre passou a dizer `1200x1200` e `anuncios_gerados` continuou
      // dizendo `402x496` nos dez. Nós mudamos a capa e não anotamos.
      //
      // O custo não é cosmético. `foto_capa_max_size` é a coluna que a
      // análise de capa lê: sem esta escrita, a lista de pendências segue
      // cobrando o que já foi resolvido até a lojista mandar reler a conta —
      // e ela não tem por que saber que precisa.
      //
      // Falhar AQUI não desfaz nada e não vira erro: a capa no ar já está
      // certa, e responder "não deu" sobre o que deu seria a mentira que este
      // arquivo inteiro existe para não contar. Vira rastro.
      const tamanhoAgora = ((depois?.pictures ?? [])[0]?.max_size ?? "").trim();
      if (tamanhoAgora) {
        const { error: erroAnotar } = await ctx.supabase
          .from("anuncios_gerados")
          .update({ foto_capa_max_size: tamanhoAgora })
          .eq("cliente_id", clienteId)
          .eq("ml_item_id", a.mlb);
        if (erroAnotar) {
          registrar("warn", "trocou-mas-nao-anotou", { mlb: a.mlb, erro: erroAnotar.message });
        }
      }
      feitos.push({
        mlb: a.mlb,
        titulo: a.titulo,
        fotosAntes: idsAntes.length,
        fotosDepois: (depois?.pictures ?? []).length,
      });
      registrar("info", "trocou", { mlb: a.mlb, capa: tamanhoAgora });
    }

    // O QUE FICOU DE FORA ENTRA NA FRASE. Um teto calado se lê como "acabou",
    // e ela fecharia a conversa com 13 anúncios ainda com a capa velha.
    const sobra =
      naoAlcancados > 0
        ? ` Parei em ${MAXIMO_POR_CHAMADA} de uma vez — faltam ${naoAlcancados} anúncio(s) desta cor. ` +
          "Peça de novo com a mesma foto que eu continuo de onde parei."
        : "";
    return Response.json({
      ok: true,
      cor: foto.cor,
      // O ID DA FOTO NO MERCADO LIVRE — é o que o desfazer precisa mirar.
      // Sem ele, quem quisesse tirar a foto errada teria de descobrir o id
      // relendo os anúncios, e o desfazer nasceria mais frágil que a ida.
      fotoNoML: novaFotoId,
      trocados: feitos.length,
      naoAlcancados,
      feitos,
      // O QUE FOI PULADO, e por quê. Silêncio aqui vira "então trocou todos".
      pulados,
      frase:
        (feitos.length === 0
          ? `Nenhum anúncio de ${foto.cor} precisava de troca.`
          : `Troquei a capa de ${feitos.length} anúncio(s) de ${foto.cor}.`) +
        (pulados.length > 0
          ? ` Deixei ${pulados.length} como estava: ` +
            pulados.map((p) => `${p.mlb} (${p.motivo})`).join("; ") + "."
          : "") +
        sobra,
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
  cor: string,
  /** A foto que ENTROU. O desfazer mira nela, e a parada é onde ele mais serve. */
  fotoNoML: string
) {
  return Response.json(
    {
      ok: false,
      parou: true,
      cor,
      fotoNoML,
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
