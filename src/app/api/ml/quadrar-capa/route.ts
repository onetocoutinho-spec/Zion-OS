// Deixa a capa de UM anúncio quadrada — e não perde nenhuma foto.
//
// ===========================================================================
// O CASO
// ===========================================================================
//
// Medido na conta da Chinelaria em 02/08/2026: 341 anúncios NO AR com a capa
// fora do padrão do ML, e boa parte deles só porque a foto é EM PÉ —
// `993x1200`, `961x1200`, `896x1152`. O ML pede quadrada e ≥1200 de lado, e
// tira exposição de quem não cumpre. Havia 3.751 peças de estoque atrás disso.
//
// Não é caso de refotografar: é caso de completar a lateral com branco.
//
// ===========================================================================
// TRÊS DECISÕES DE SEGURANÇA
// ===========================================================================
//
// 1. UM ANÚNCIO POR CHAMADA. Sem lote. Isto ESCREVE no anúncio ao vivo dela, e
//    um laço que reescreve 341 anúncios errado é um estrago que não se desfaz
//    com Ctrl+Z. O lote pode vir depois, quando o primeiro tiver funcionado.
//
// 2. NADA É APAGADO. A capa quadrada entra como PRIMEIRA e todas as fotos
//    antigas continuam no anúncio, atrás dela. O ML substitui o conjunto de
//    fotos quando recebe `pictures`, então mandar só a nova apagaria as outras.
//    A foto original vira a segunda — se o resultado não agradar, a antiga está
//    ali para voltar a ser capa.
//
// 3. A ORDEM É ML PRIMEIRO. Sobe a foto, troca a capa, e só então responde.
//    Não há gravação nossa aqui: o estado do anúncio mora no ML, e a próxima
//    leitura o traz. Não existe caminho em que o Zion afirme uma troca que não
//    aconteceu.
//
// Mesmo contrato de /api/ml/publicar: autorização server-side, refresh_token
// lido só no servidor (RLS), token rotacionado persistido ANTES da operação
// externa.

import {
  variacoesDaFoto,
  subirFoto,
  definirFotosDoItem,
} from "@/lib/marketplaces/mercadolivre";
import { quadrarCapa, maiorVariacao } from "@/modules/integration/domain/quadrarCapa";
import {
  lerCanalServidor,
  atualizarRefreshTokenServidor,
  clienteDaCredencial,
} from "@/modules/integration/infrastructure/canalServidor";
import { renovarTokenDaRota } from "@/modules/integration/infrastructure/renovacaoDaRota";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { respostaDeErro, mensagemParaONavegador } from "@/lib/http/respostaDeErro";

const API = "https://api.mercadolibre.com";

export const maxDuration = 60;

interface Corpo {
  clienteId?: string;
  itemId?: string;
}

export async function POST(request: Request) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json({ erro: "Integração ML não configurada no servidor." }, { status: 503 });
  }

  let corpo: Corpo;
  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  const clienteId = (corpo.clienteId ?? "").trim();
  const itemId = (corpo.itemId ?? "").trim().toUpperCase().replace(/-/g, "");
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
      oQueFalhou: "ajustar a foto de capa",
    });
    if ("recusa" in renovacao) return renovacao.recusa;
    const tokens = renovacao.tokens;
    await atualizarRefreshTokenServidor(clienteDaCredencial(), clienteId, tokens.refreshToken, "Mercado Livre");
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };

    // 1) As fotos ATUAIS do anúncio, na ordem em que estão.
    //
    // `variations` vem junto porque em anúncio COM VARIAÇÃO o Mercado Livre
    // controla as fotos por variação (`variations[].picture_ids`), e o
    // `pictures` do item passa a ser derivado. Mexer só no item pode não ter
    // efeito nenhum — e foi o que aconteceu em 03/08/2026.
    const rItem = await fetch(`${API}/items/${itemId}?attributes=id,pictures,variations`, {
      headers: auth,
    });
    if (!rItem.ok) {
      return Response.json({ erro: `Não consegui ler o anúncio ${itemId}.` }, { status: 502 });
    }
    const item = (await rItem.json()) as {
      pictures?: { id?: string }[];
      variations?: { id?: number; picture_ids?: string[] }[];
    };
    const fotos = (item.pictures ?? []).map((f) => (f.id ?? "").trim()).filter(Boolean);
    const variacoesDoItem = item.variations ?? [];
    if (fotos.length === 0) {
      return Response.json({ erro: "Este anúncio não tem nenhuma foto." }, { status: 422 });
    }

    // 2) A MAIOR variação da capa — pelo tamanho que o ML declara, nunca pelo
    //    sufixo da URL: medido em 02/08/2026, `-F` é a maior numa imagem e é
    //    492x245 em outra.
    const { variations, maxSize } = await variacoesDaFoto(tokens.accessToken, fotos[0]);
    const maior = maiorVariacao(variations);
    if (!maior) {
      return Response.json(
        { erro: "O Mercado Livre não informou o tamanho de nenhuma variação desta foto." },
        { status: 422 }
      );
    }

    const rImg = await fetch(maior.url);
    if (!rImg.ok) {
      return Response.json({ erro: "Não consegui baixar a foto original." }, { status: 502 });
    }
    const original = Buffer.from(await rImg.arrayBuffer());

    // 3) Quadrar. A recusa vem com motivo e é 422 — não é falha nossa, é a
    //    foto não servindo para este conserto.
    const quadrada = await quadrarCapa(original);
    if (!quadrada.ok) {
      // Se o ORIGINAL é maior que a maior variação servida, o remédio é outro:
      // a foto boa existe e não está sendo entregue. Mandar refotografar nesse
      // caso seria mandar refazer o que ela já tem.
      const areaDe = (t: string) => {
        const m = /^(\d+)x(\d+)$/.exec(t);
        return m ? Number(m[1]) * Number(m[2]) : 0;
      };
      const originalMaior = areaDe(maxSize) > areaDe(maior.size);
      return Response.json(
        {
          erro: originalMaior
            ? `${quadrada.motivo} Obs.: o Mercado Livre diz que o original tem ${maxSize}, mas só entrega ${maior.size} — se você ainda tem o arquivo, reenviá-lo já resolve.`
            : quadrada.motivo,
          naoAplicavel: true,
          servido: maior.size,
          original: maxSize || null,
        },
        { status: 422 }
      );
    }

    // 4) Sobe. Neste ponto nada mudou no anúncio ainda.
    const novaFotoId = await subirFoto(tokens.accessToken, quadrada.imagem, `${itemId}-capa.jpg`);

    // 5) Troca a capa PRESERVANDO todas as antigas atrás dela.
    const novaOrdem = [novaFotoId, ...fotos.filter((f) => f !== novaFotoId)];
    const r = await definirFotosDoItem(tokens.accessToken, itemId, novaOrdem);

    // 6) CONFERE. O `PUT` voltar 200 significa que o ML ACEITOU o pedido, não
    //    que a capa mudou. Em 03/08/2026 eu afirmei "capa ajustada" com base no
    //    200, a lojista reconferiu, e a capa continuava a antiga — o mesmo
    //    defeito que passei o dia arrancando de outros lugares, cometido por
    //    mim no último passo.
    //
    //    A verificação é uma releitura do próprio ML. Custa uma requisição e
    //    troca uma afirmação por um fato.
    const rConfere = await fetch(`${API}/items/${itemId}?attributes=id,pictures`, { headers: auth });
    const depois = rConfere.ok
      ? ((await rConfere.json()) as { pictures?: { id?: string }[] })
      : null;
    const capaAgora = (depois?.pictures ?? [])[0]?.id?.trim() ?? "";
    const trocou = capaAgora === novaFotoId;

    // 7) E O TAMANHO? Trocar a capa não basta: o Mercado Livre REPROCESSA a
    //    imagem no upload, e apara borda branca uniforme. Observado em
    //    03/08/2026: subimos 1200x1200 com faixa branca, a capa trocou (verde),
    //    e a releitura seguinte mediu 995x1200 — a faixa tinha sido cortada.
    //
    //    Cada rodada acrescentava uma foto e não consertava nada. Verificar só
    //    "trocou a capa" deixava isso invisível.
    let tamanhoFinal = "";
    if (trocou) {
      try {
        const { maxSize } = await variacoesDaFoto(tokens.accessToken, novaFotoId);
        tamanhoFinal = maxSize;
      } catch {
        // Sem leitura, `tamanhoFinal` fica vazio — e vazio NÃO vira "deu certo".
      }
    }
    const ficouQuadrada = tamanhoFinal === quadrada.para;

    return Response.json({
      itemId: r.id,
      de: quadrada.de,
      para: quadrada.para,
      novaFotoId,
      // Quantas fotos o anúncio tem AGORA. Se cair, alguma se perdeu — e quem
      // ler a resposta consegue perceber sozinho.
      fotosAntes: fotos.length,
      fotosDepois: r.quantasFotos,
      // A verdade sobre a capa, lida do ML DEPOIS da escrita.
      capaTrocada: trocou,
      capaAgora: capaAgora || null,
      // O tamanho que o ML GUARDOU, lido depois de tudo. Se não bater com o que
      // enviamos, ele reprocessou — e o conserto não aconteceu.
      tamanhoFinal: tamanhoFinal || null,
      ficouQuadrada,
      // Em anúncio com variação, o ML controla as fotos por variação. Se a capa
      // não trocou E há variações, é quase certo que o caminho é outro — e
      // dizer isso é mais útil que repetir a tentativa.
      temVariacoes: variacoesDoItem.length > 0,
    });
  } catch (e) {
    return respostaDeErro("ml/quadrar-capa", e, "Falha ao quadrar a capa.", 502);
  }
}
