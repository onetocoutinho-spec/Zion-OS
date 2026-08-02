// Importar anúncios já cadastrados na conta do ML — SOMENTE SERVIDOR.
//
// Recebe o `clienteId`. Autoriza no servidor, busca o refresh_token do canal
// (nunca vem do navegador — R3), renova o token, lista os itens do vendedor e
// devolve o conteúdo enxuto. O client mapeia para produtos/variações/anúncios
// e grava (RLS). O refresh_token é rotacionado e persistido SÓ no servidor.

import {
  renovarToken,
  buscarAnunciosDoVendedor,
  recorteDaCategoria,
} from "@/lib/marketplaces/mercadolivre";
import { lerCanalServidor, atualizarRefreshTokenServidor } from "@/modules/integration/infrastructure/canalServidor";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

export const maxDuration = 60;

interface Corpo {
  clienteId: string;
  marketplace?: string;
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
  if (!corpo?.clienteId) {
    return Response.json({ erro: "clienteId ausente." }, { status: 400 });
  }

  let ctx;
  try {
    ctx = await exigirAcessoAoCliente(request, corpo.clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if (!ctx.supabase) {
    return Response.json({ erro: "Supabase não configurado no servidor." }, { status: 503 });
  }

  const marketplace = corpo.marketplace ?? "Mercado Livre";

  try {
    const canal = await lerCanalServidor(ctx.supabase, corpo.clienteId, marketplace);
    if (!canal?.refreshToken) {
      return Response.json({ erro: "Cliente não conectado ao Mercado Livre." }, { status: 400 });
    }

    const tokens = await renovarToken({ clientId, clientSecret, refreshToken: canal.refreshToken });
    await atualizarRefreshTokenServidor(ctx.supabase, corpo.clienteId, tokens.refreshToken, marketplace);

    const sellerId = canal.sellerId || tokens.userId;
    if (!sellerId) {
      return Response.json({ erro: "seller_id não encontrado." }, { status: 422 });
    }
    const leitura = await buscarAnunciosDoVendedor(tokens.accessToken, sellerId);
    const anuncios = leitura.anuncios;

    // O recorte da ficha vem do ML, por categoria — não de uma lista escrita
    // por nós. Vai junto porque é aqui que as categorias são conhecidas, e
    // porque o endpoint é público: uma chamada a mais no servidor, nenhuma no
    // navegador, e nenhum problema de CORS.
    // Os DOIS recortes numa passada: o que não é ficha do lojista, e o que a
    // categoria EXIGE. Saem da mesma resposta do ML; pedir separado dobraria a
    // rede por nada. Os obrigatórios entraram porque 150 anúncios estavam em
    // `waiting_for_patch` — o ML pedindo correção — e ninguém sabia qual campo.
    const { foraDaFicha, obrigatorios } = await recorteDaCategoria(
      anuncios.map((a) => a.categoria)
    );

    // `leitura` vai junto porque a diferença entre o que o ML DIZ ter e o que
    // nós lemos precisa chegar à tela. Enquanto ela morria aqui, a importação
    // parava nos 500 e ninguém sabia — inclusive nós.
    return Response.json({
      anuncios,
      sellerId,
      foraDaFicha,
      obrigatorios,
      leitura: {
        total: leitura.total,
        ids: leitura.ids,
        perdidos: leitura.perdidos,
        parede: leitura.parede,
      },
    });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao importar anúncios do ML." },
      { status: 502 }
    );
  }
}
