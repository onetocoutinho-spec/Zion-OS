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
  renovarToken,
  variacoesDaFoto,
  subirFoto,
  definirFotosDoItem,
} from "@/lib/marketplaces/mercadolivre";
import { quadrarCapa, maiorVariacao } from "@/modules/integration/domain/quadrarCapa";
import {
  lerCanalServidor,
  atualizarRefreshTokenServidor,
} from "@/modules/integration/infrastructure/canalServidor";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

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
    const canal = await lerCanalServidor(ctx.supabase, clienteId, "Mercado Livre");
    if (!canal?.refreshToken) {
      return Response.json({ erro: "Cliente não conectado ao Mercado Livre." }, { status: 400 });
    }
    const tokens = await renovarToken({ clientId, clientSecret, refreshToken: canal.refreshToken });
    await atualizarRefreshTokenServidor(ctx.supabase, clienteId, tokens.refreshToken, "Mercado Livre");
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };

    // 1) As fotos ATUAIS do anúncio, na ordem em que estão.
    const rItem = await fetch(`${API}/items/${itemId}?attributes=id,pictures`, { headers: auth });
    if (!rItem.ok) {
      return Response.json({ erro: `Não consegui ler o anúncio ${itemId}.` }, { status: 502 });
    }
    const item = (await rItem.json()) as { pictures?: { id?: string }[] };
    const fotos = (item.pictures ?? []).map((f) => (f.id ?? "").trim()).filter(Boolean);
    if (fotos.length === 0) {
      return Response.json({ erro: "Este anúncio não tem nenhuma foto." }, { status: 422 });
    }

    // 2) A MAIOR variação da capa — pelo tamanho que o ML declara, nunca pelo
    //    sufixo da URL: medido em 02/08/2026, `-F` é a maior numa imagem e é
    //    492x245 em outra.
    const variacoes = await variacoesDaFoto(tokens.accessToken, fotos[0]);
    const maior = maiorVariacao(variacoes);
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
      return Response.json({ erro: quadrada.motivo, naoAplicavel: true }, { status: 422 });
    }

    // 4) Sobe. Neste ponto nada mudou no anúncio ainda.
    const novaFotoId = await subirFoto(tokens.accessToken, quadrada.imagem, `${itemId}-capa.jpg`);

    // 5) Troca a capa PRESERVANDO todas as antigas atrás dela.
    const novaOrdem = [novaFotoId, ...fotos.filter((f) => f !== novaFotoId)];
    const r = await definirFotosDoItem(tokens.accessToken, itemId, novaOrdem);

    return Response.json({
      itemId: r.id,
      de: quadrada.de,
      para: quadrada.para,
      novaFotoId,
      // Quantas fotos o anúncio tem AGORA. Se cair, alguma se perdeu — e quem
      // ler a resposta consegue perceber sozinho.
      fotosAntes: fotos.length,
      fotosDepois: r.quantasFotos,
    });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao quadrar a capa." },
      { status: 502 }
    );
  }
}
