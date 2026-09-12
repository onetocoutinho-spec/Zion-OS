// POST /api/loja/provisionar — a porta de entrada do SaaS.
//
// Cria a loja (linha em `clientes`) e o perfil de cliente de quem acabou de se
// cadastrar. É o que substitui o item "cliente liberado para operação" da
// checklist manual da equipe: agora quem libera é o próprio cadastro.
//
// AS TRÊS DECISÕES DE SEGURANÇA
//
// 1. **Exige sessão, mas NÃO exige perfil.** `exigirAutenticado` não serve
//    aqui: ele reprova quem não tem perfil, que é exatamente todo mundo que
//    chega nesta rota. Então validamos o token direto com
//    `obterUsuarioAutenticado`. Continua fechada para anônimo — o que não dá
//    para exigir é justamente a coisa que a rota vai criar.
//
// 2. **Só provisiona para o próprio usuário do token.** O corpo da requisição
//    não escolhe usuário, papel nem cliente; ele traz só o nome da loja. O
//    `papel: "cliente"` é decidido AQUI, no servidor. Um corpo que pudesse
//    dizer `papel` seria a diferença entre um lojista novo e um invasor com
//    acesso total.
//
// 3. **`service_role` fica atrás da sessão.** A escrita usa admin porque
//    `clientes` e `perfis` são fechados por RLS ao próprio cliente — e quem
//    ainda não é cliente não passa. Mas o admin só entra DEPOIS do token ser
//    validado. Uma rota pública com service_role seria porta aberta.
//
// Idempotente: o navegador repete (recarregou, clicou duas vezes, a rede
// engasgou) e a segunda chamada não cria uma segunda loja.

import { getSupabaseAdmin, adminConfigurado } from "@/lib/supabase/admin";
import {
  obterUsuarioAutenticado,
  obterPerfilDoUsuario,
} from "@/lib/auth/serverAuthorization";
import {
  decidirProvisionamento,
  validarPedidoDeLoja,
} from "@/modules/onboarding/domain/criacaoDeLoja";
// Plano e cota de quem entra sozinho: vêm do vocabulário do produto, nunca do
// corpo da requisição. Eram dois literais aqui dentro, e "Essencial" acabou
// fora de `PLANOS` sem ninguém perceber.
import { PLANO_INICIAL, LIMITE_ESTEIRA_INICIAL } from "@/lib/constantes";


export async function POST(request: Request) {
  // 1) Sessão válida — sem perfil, que é o estado normal de quem chega aqui.
  //
  // A autenticação vem ANTES da checagem de configuração de propósito: quem não
  // tem sessão recebe a mesma resposta com o servidor configurado ou não, e a
  // rota fica testável sem depender do ambiente. Nada vaza — "não autenticado"
  // é sobre quem chama, não sobre o servidor.
  const auth = await obterUsuarioAutenticado(request);
  if (!auth) {
    return Response.json({ erro: "Não autenticado." }, { status: 401 });
  }

  if (!adminConfigurado()) {
    return Response.json({ erro: "Cadastro indisponível no momento." }, { status: 503 });
  }

  // 2) Corpo com lista fechada de campos (só o nome da loja).
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  const pedido = validarPedidoDeLoja(corpo);
  if (!pedido.ok) {
    return Response.json({ erro: pedido.erro, campo: pedido.campo }, { status: 400 });
  }

  // 3) Já tem loja? Já é equipe? O domínio decide.
  let perfil;
  try {
    perfil = await obterPerfilDoUsuario(auth.supabase, auth.usuario.id);
  } catch {
    console.error("[loja] falha ao ler perfil");
    return Response.json({ erro: "Não foi possível concluir agora." }, { status: 500 });
  }
  const decisao = decidirProvisionamento({
    temPerfil: Boolean(perfil),
    ...(perfil ? { papelExistente: perfil.papel } : {}),
  });
  if (decisao.acao === "ja_provisionado") {
    return Response.json({ ok: true, status: "ja_provisionado" }, { status: 200 });
  }
  if (decisao.acao === "recusar") {
    return Response.json({ erro: decisao.motivo }, { status: 409 });
  }

  // 4) Cria a loja e o perfil. Com compensação: uma loja sem dono é lixo que
  //    ninguém consegue ver nem apagar depois (RLS fecha para todo mundo).
  const admin = getSupabaseAdmin();
  const { data: cliente, error: erroCliente } = await admin
    .from("clientes")
    .insert({
      empresa: pedido.nomeDaLoja,
      responsavel: auth.usuario.email ?? "",
      plano: PLANO_INICIAL,
      status: "Ativo",
      limite_esteira_mes: LIMITE_ESTEIRA_INICIAL,
      marketplaces: ["Mercado Livre"],
    })
    .select("id")
    .single();

  if (erroCliente || !cliente) {
    console.error("[loja] falha ao criar cliente");
    return Response.json({ erro: "Não foi possível criar sua loja agora." }, { status: 500 });
  }

  const { error: erroPerfil } = await admin.from("perfis").insert({
    id: auth.usuario.id,
    papel: "cliente", // decidido AQUI, nunca pelo corpo da requisição
    cliente_id: cliente.id,
    nome: pedido.nomeDaLoja,
    ativo: true,
  });

  if (erroPerfil) {
    // Compensação: desfaz a loja órfã. Se a compensação falhar, registramos —
    // o usuário pode tentar de novo, e a tentativa seguinte cria outra loja
    // limpa em vez de travar para sempre num estado impossível.
    const { error: erroLimpeza } = await admin.from("clientes").delete().eq("id", cliente.id);
    if (erroLimpeza) console.error("[loja] loja órfã não removida", { clienteId: cliente.id });
    console.error("[loja] falha ao criar perfil");
    return Response.json({ erro: "Não foi possível concluir seu cadastro." }, { status: 500 });
  }

  console.info("[loja] provisionada");
  return Response.json({ ok: true, status: "provisionado" }, { status: 201 });
}
