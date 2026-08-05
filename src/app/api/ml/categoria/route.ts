// Qual categoria do Mercado Livre é esta, e o que ela exige.
//
// ===========================================================================
// A LACUNA QUE ISTO FECHA
// ===========================================================================
//
// O de-calçar (05/08/2026) tirou os obrigatórios de calçado de dentro de
// `resolverObrigatorios` e os transformou em parâmetro. Ficou honesto, e ficou
// incompleto: os cinco caminhos passam `OBRIGATORIOS_CALCADO` à mão porque
// NINGUÉM SABE A CATEGORIA. `categoriaMarketplaceSugerida` é texto livre
// digitado por gente — "cama box", "Camas" — e não é um id.
//
// O id existe e o ML sabe descobri-lo pelo título (`domain_discovery`). Falta
// alguém perguntar. É o que esta rota faz.
//
// ===========================================================================
// POR QUE NO SERVIDOR
// ===========================================================================
//
// `preverCategoria` precisa de token, e o token do lojista mora no servidor —
// o refresh_token nunca desce para o navegador. Já `atributosObrigatorios` NÃO
// precisa de token: `/categories/{id}/attributes` é público. Os dois saem
// juntos daqui porque separá-los faria a tela perguntar duas vezes, e a segunda
// pergunta é a única que interessa: "o que ESTA categoria exige".
//
// ===========================================================================
// O QUE ELA NÃO FAZ
// ===========================================================================
//
// Não grava. A categoria descoberta é uma PROPOSTA do ambiente — quem decide a
// categoria de um produto é a lojista, e o Learning Loop (PR-006) existe
// justamente para registrar quando as duas divergem. Gravar aqui apagaria o
// delta que a decisão dela produz.

import {
  atributosObrigatorios,
  preverCategoria,
  renovarToken,
  RenovacaoRecusadaError,
} from "@/lib/marketplaces/mercadolivre";
import { lerCanalServidor, atualizarRefreshTokenServidor } from "@/modules/integration/infrastructure/canalServidor";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

export async function POST(request: Request) {
  let corpo: { clienteId?: string; titulo?: string; categoriaId?: string; marketplace?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }

  const clienteId = String(corpo.clienteId ?? "").trim();
  const titulo = String(corpo.titulo ?? "").trim();
  // Um id já conhecido pula a adivinhação — e pula a necessidade de token.
  const categoriaInformada = String(corpo.categoriaId ?? "").trim();
  if (!clienteId) return Response.json({ erro: "clienteId ausente." }, { status: 400 });
  if (!titulo && !categoriaInformada) {
    return Response.json({ erro: "Informe o título do produto ou a categoria." }, { status: 400 });
  }

  let ctx: Awaited<ReturnType<typeof exigirAcessoAoCliente>>;
  try {
    ctx = await exigirAcessoAoCliente(request, clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  // Caminho sem token: a categoria já é conhecida, e os atributos são públicos.
  // Ele existe porque a lojista pode digitar o id, e porque um cliente que
  // ainda não conectou o ML não deveria ficar sem a parte que não depende dele.
  if (categoriaInformada) {
    const obrigatorios = await atributosObrigatorios(categoriaInformada);
    return Response.json({ categoriaId: categoriaInformada, obrigatorios, origem: "informada" });
  }

  if (!ctx.supabase) {
    return Response.json({ erro: "Supabase não configurado no servidor." }, { status: 503 });
  }
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json({ erro: "Integração do Mercado Livre não configurada." }, { status: 503 });
  }

  const marketplace = corpo.marketplace ?? "Mercado Livre";
  try {
    const canal = await lerCanalServidor(ctx.supabase, clienteId, marketplace);
    if (!canal?.refreshToken) {
      // NÃO é erro: descobrir a categoria é um ganho, não um pré-requisito. Sem
      // conexão a lojista informa a categoria à mão, e o resto do sistema segue
      // exatamente como seguia antes desta rota existir.
      return Response.json({
        categoriaId: null,
        obrigatorios: [],
        origem: "sem_conexao",
        aviso: "Conecte a conta do Mercado Livre para o Zion descobrir a categoria sozinho.",
      });
    }

    let tokens: Awaited<ReturnType<typeof renovarToken>>;
    try {
      tokens = await renovarToken({ clientId, clientSecret, refreshToken: canal.refreshToken });
    } catch (e) {
      // Mesma distinção da publicação: credencial recusada manda reconectar;
      // ML fora do ar não diz nada sobre a validade do token.
      if (!(e instanceof RenovacaoRecusadaError) || !e.credencialRecusada) throw e;
      return Response.json(
        { erro: `O ${marketplace} recusou a credencial salva. Reconecte a conta.`, motivo: "reconectar" },
        { status: 409 }
      );
    }
    await atualizarRefreshTokenServidor(ctx.supabase, clienteId, tokens.refreshToken, marketplace);

    const categoriaId = await preverCategoria(tokens.accessToken, titulo);
    if (!categoriaId) {
      return Response.json({ categoriaId: null, obrigatorios: [], origem: "nao_prevista" });
    }
    const obrigatorios = await atributosObrigatorios(categoriaId);
    return Response.json({ categoriaId, obrigatorios, origem: "prevista" });
  } catch (e) {
    console.error("[ml/categoria] falhou", e);
    return Response.json(
      { erro: "Não consegui consultar o Mercado Livre agora. Tente de novo em instantes." },
      { status: 502 }
    );
  }
}
