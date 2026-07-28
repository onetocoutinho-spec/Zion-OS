// PATCH /api/loja/renomear — o lojista muda o nome da própria loja.
//
// Antes isto era um bilhete: "Para alterar o e-mail de acesso, a loja ou
// adicionar outro marketplace, fale com a equipe Zion". Num SaaS sem equipe no
// caminho crítico, um cliente que não consegue corrigir o próprio nome fica
// preso a um erro de digitação para sempre.
//
// POR QUE UMA ROTA, E NÃO UM UPDATE DIRETO DO NAVEGADOR
//
// `clientes` é fechada por RLS: o cliente não lê nem escreve nela (migração
// 005). E é assim de propósito — uma política de update na tabela deixaria o
// lojista alterar plano, status, risco e limite da própria conta. Poder que ele
// não deve ter.
//
// Então o servidor abre exatamente UM campo. É a mesma ideia da função
// `portal_definir_margem_minima` (migração 029), resolvida em rota para não
// exigir uma migração nova só por causa de um nome.

import { getSupabaseAdmin, adminConfigurado } from "@/lib/supabase/admin";
import { exigirCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { validarPedidoDeLoja } from "@/modules/onboarding/domain/criacaoDeLoja";

export async function PATCH(request: Request) {
  // Só CLIENTE renomeia loja, e só a dele: o clienteId vem do perfil no
  // servidor, nunca do corpo. Sem isso, bastaria mandar outro id no JSON para
  // renomear a loja de qualquer concorrente.
  let contexto;
  try {
    contexto = await exigirCliente(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  const clienteId = contexto.perfil.clienteId;
  if (!clienteId) {
    return Response.json({ erro: "Sua conta não tem loja." }, { status: 409 });
  }

  if (!adminConfigurado()) {
    return Response.json({ erro: "Indisponível no momento." }, { status: 503 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  // Reusa a validação do cadastro: mesma regra de nome, mesma lista fechada de
  // campos. Duas validações diferentes para o mesmo dado divergem com o tempo.
  const pedido = validarPedidoDeLoja(corpo);
  if (!pedido.ok) {
    return Response.json({ erro: pedido.erro, campo: pedido.campo }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from("clientes")
    .update({ empresa: pedido.nomeDaLoja })
    .eq("id", clienteId);

  if (error) {
    console.error("[loja] falha ao renomear");
    return Response.json({ erro: "Não foi possível salvar agora." }, { status: 500 });
  }
  return Response.json({ ok: true, nomeDaLoja: pedido.nomeDaLoja }, { status: 200 });
}
