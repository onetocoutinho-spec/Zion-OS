// POST /api/ml/desconectar — apaga a credencial do Mercado Livre da loja.
//
// Existia como `salvarCanal({ ativo: false })` no NAVEGADOR, que gravava
// `refresh_token: null` direto no PostgREST. Desde a migração 059 o papel
// `authenticated` não tem GRANT de escrita nessa coluna — a regra passou a ser
// "o navegador não toca na credencial", e apagar é tocar.
//
// Então o apagamento vem para o servidor, atrás da mesma parede das outras
// rotas /api/ml/*: `exigirAcessoAoCliente` decide se a sessão alcança a loja;
// o admin executa. Finding ZION-SECRET-001.

import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import {
  clienteDaCredencial,
  limparCredencialServidor,
} from "@/modules/integration/infrastructure/canalServidor";
import { adminConfigurado } from "@/lib/supabase/admin";

interface Corpo {
  clienteId?: string;
  marketplace?: string;
}

export async function POST(request: Request) {
  let corpo: Corpo;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }
  const clienteId = String(corpo?.clienteId ?? "").trim();
  if (!clienteId) return Response.json({ erro: "clienteId ausente." }, { status: 400 });
  const marketplace = String(corpo?.marketplace ?? "Mercado Livre").trim() || "Mercado Livre";

  try {
    await exigirAcessoAoCliente(request, clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if (!adminConfigurado()) {
    return Response.json({ erro: "Supabase não configurado no servidor." }, { status: 503 });
  }

  try {
    await limparCredencialServidor(clienteDaCredencial(), clienteId, marketplace);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[ml/desconectar] falhou", e);
    return Response.json({ erro: "Não foi possível desconectar agora." }, { status: 500 });
  }
}
