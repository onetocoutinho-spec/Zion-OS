// Início do OAuth do Mercado Livre — agora com TICKET, e por isso com POST.
//
// ===========================================================================
// POR QUE DEIXOU DE SER UM GET
// ===========================================================================
//
// A tela fazia `window.location.href = "/api/ml/autorizar?clienteId=X"`. Isso é
// NAVEGAÇÃO, não `fetch`: o navegador não manda o header `Authorization`, e a
// sessão deste app vive no localStorage, não em cookie. A rota era, na prática,
// anônima — ela só montava uma URL.
//
// Funcionava porque a segurança estava do outro lado: o callback ignorava o
// `state` e usava a loja da SESSÃO. Uma loja por usuário, nenhuma escolha a
// fazer.
//
// Com agência isso acaba: ela opera dez lojas e nenhuma é "a dela". Alguém
// precisa dizer QUAL, e essa afirmação não pode vir do navegador. Então:
//
//   1. a tela chama esta rota com `fetch` autenticado e o `clienteId`
//   2. aqui se confere que a pessoa opera aquela loja (403 se não)
//   3. grava-se um ticket opaco amarrado a (usuário, loja), 15 minutos
//   4. devolve-se a URL do ML com `state = ticket`
//   5. a tela navega
//
// O `state` que trafega pelo navegador deixa de dizer qualquer coisa: quem sabe
// de qual loja se trata é a linha no banco (migração 055).

import { randomUUID } from "node:crypto";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

// Brasil usa "mercadoliVre.com.br" (com V). Os outros países do ML usam
// "mercadolibre" — só o BR é "Mercado Livre".
const AUTH_URL = "https://auth.mercadolivre.com.br/authorization";

function origem(request: Request): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return `${proto}://${host}`;
}

interface Corpo {
  clienteId: string;
  marketplace?: string;
}

export async function POST(request: Request) {
  const clientId = process.env.ML_CLIENT_ID;
  if (!clientId) {
    return Response.json({ erro: "ML_CLIENT_ID não configurado no servidor." }, { status: 503 });
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

  // A PRIMEIRA DAS DUAS CONFERÊNCIAS. A segunda está em `/api/ml/conectar`, na
  // hora de gravar o token — de propósito: um ticket válido cuja loja saiu do
  // alcance da pessoa no meio do caminho ainda precisa ser recusado.
  let ctx;
  try {
    ctx = await exigirAcessoAoCliente(request, corpo.clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if (!ctx.supabase || !ctx.usuario) {
    return Response.json({ erro: "Supabase não configurado no servidor." }, { status: 503 });
  }

  const redirectUri = process.env.ML_REDIRECT_URI ?? `${origem(request)}/cliente/conectar-ml`;

  // O ML recusa `redirect_uri` que não seja HTTPS, e a recusa acontece na
  // BORDA: o vendedor recebe uma página branca da CloudFront com "403 ERROR",
  // sem nenhuma pista do que houve. Barrar aqui troca esse beco sem saída por
  // uma frase que explica — em desenvolvimento o redirect vira http://localhost
  // e isso nunca vai funcionar.
  if (!redirectUri.startsWith("https://")) {
    return Response.json(
      {
        erro:
          "A conexão com o Mercado Livre só funciona pelo site publicado (https). " +
          "Em ambiente local o endereço gerado seria " +
          redirectUri +
          ", que o Mercado Livre recusa antes mesmo da tela de login. " +
          "Configure ML_REDIRECT_URI com a URL de produção ou faça a conexão por lá.",
      },
      { status: 400 }
    );
  }

  // O ticket é opaco: não carrega informação nenhuma, nem sobre a loja nem
  // sobre quem pediu. Quem carrega é a linha.
  const ticket = `${randomUUID()}${randomUUID()}`.replace(/-/g, "");
  const marketplace = corpo.marketplace ?? "Mercado Livre";

  // A política de INSERT (055) confere de novo, no banco: só nasce ticket para
  // loja que a pessoa alcança, e só em nome dela. Se esta linha passar, as duas
  // camadas concordaram.
  const { error } = await ctx.supabase.from("ml_conexoes_pendentes").insert({
    ticket,
    cliente_id: corpo.clienteId,
    usuario_id: ctx.usuario.id,
    marketplace,
  });
  if (error) {
    return Response.json(
      { erro: "Não foi possível iniciar a conexão com o Mercado Livre." },
      { status: 403 }
    );
  }

  const url = new URL(AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  // offline_access é OBRIGATÓRIO para o ML devolver refresh_token (sem ele, o
  // servidor não consegue renovar o token e publicar). read/write cobrem
  // leitura e publicação/edição de anúncios.
  url.searchParams.set("scope", "offline_access read write");
  url.searchParams.set("state", ticket);

  // Devolve a URL em vez de redirecionar: quem navega é a tela, depois de já
  // ter o ticket gravado. Um 302 aqui obrigaria o `fetch` a seguir o redirect
  // para o domínio do ML, que não é o que se quer de uma chamada de API.
  return Response.json({ url: url.toString() });
}
