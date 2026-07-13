// Criação de usuário (agência ou cliente) + perfil — SOMENTE SERVIDOR.
//
// F-01: um único fluxo consistente. Autoriza (só EQUIPE), valida o payload,
// e usa o Supabase Admin (service_role, server-only) para criar o usuário no
// Auth e o perfil, com compensação se o perfil falhar. NUNCA retorna senha,
// token, sessão ou service_role ao navegador.

import { getSupabaseAdmin, adminConfigurado } from "@/lib/supabase/admin";
import { exigirEquipe, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import {
  validarPayloadNovoUsuario,
  criarUsuarioComPerfil,
  type DepsCriacaoUsuario,
} from "@/lib/services/usuarios";
import { montarRedirectConvite } from "@/lib/auth/definirSenha";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 30;

/**
 * Monta as dependências reais a partir do Supabase Admin (service_role).
 * `redirectConvite` já vem VALIDADO (https + origin + /definir-senha) — nunca
 * undefined; o handler recusa a operação antes se APP_URL for inválida.
 */
function montarDeps(admin: SupabaseClient, redirectConvite: string): DepsCriacaoUsuario {
  return {
    async empresaExiste(clienteId) {
      const { data } = await admin.from("clientes").select("id").eq("id", clienteId).maybeSingle();
      return Boolean(data);
    },
    async buscarAuthPorEmail(email) {
      // Staging tem poucos usuários; a 1ª página cobre. (Paginação: melhoria futura.)
      const { data } = await admin.auth.admin.listUsers();
      const achado = (data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
      return achado ? { id: achado.id } : null;
    },
    async convidarAuthUser(email, nome) {
      // redirectTo SEMPRE definido (validado no handler). Server-side, nunca do navegador.
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { nome },
        redirectTo: redirectConvite,
      });
      if (error || !data?.user) throw new Error(error?.message ?? "Falha ao convidar usuário.");
      return { id: data.user.id };
    },
    async criarPerfil(userId, papel, clienteId, nome) {
      const { error } = await admin
        .from("perfis")
        .insert({ id: userId, papel, cliente_id: clienteId, nome });
      if (error) throw new Error(error.message);
    },
    async removerAuthUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
    },
  };
}

export async function POST(request: Request) {
  if (!adminConfigurado()) {
    return Response.json({ erro: "Servidor não configurado para criar usuários." }, { status: 503 });
  }

  // 1) Autorização: só usuário de EQUIPE cria usuários (cliente → 403; sem sessão → 401).
  try {
    await exigirEquipe(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  // 2) Payload validado (não confia no objeto cru; rejeita campos privilegiados).
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  const validacao = validarPayloadNovoUsuario(corpo);
  if (!validacao.ok) {
    return Response.json({ erro: validacao.erro, campo: validacao.campo }, { status: 400 });
  }

  // 3) URL de convite server-side OBRIGATÓRIA (APP_URL, https). Sem ela, NÃO
  //    enviamos convite (nada de cair silenciosamente no Site URL) e NÃO criamos
  //    usuário/perfil. Registra só um código sanitizado — nunca o valor.
  const redirectConvite = montarRedirectConvite(process.env.APP_URL);
  if (!redirectConvite) {
    console.error("[usuarios] APP_URL_INVALIDA");
    return Response.json(
      { erro: "O envio de convites está temporariamente indisponível." },
      { status: 503 }
    );
  }

  // 4) Fluxo consistente com compensação.
  const admin = getSupabaseAdmin();
  let resultado;
  try {
    resultado = await criarUsuarioComPerfil(montarDeps(admin, redirectConvite), validacao.dados);
  } catch {
    // Erro inesperado (ex.: convite/SMTP, rede). Mensagem genérica — sem detalhe do Supabase.
    console.error("[usuarios] falha inesperada na criação", { papel: validacao.dados.papel });
    return Response.json({ erro: "Não foi possível criar o usuário agora. Tente novamente." }, { status: 500 });
  }

  // 5) Resposta sanitizada por tipo (nunca senha/token/sessão/APP_URL).
  switch (resultado.tipo) {
    case "convidado":
      console.info("[usuarios] convite criado", { papel: validacao.dados.papel });
      return Response.json({ ok: true, status: "convidado" }, { status: 201 });
    case "ja_existe":
      return Response.json(
        { ok: false, status: "ja_cadastrado", erro: "Este e-mail já tem cadastro no Zion OS." },
        { status: 409 }
      );
    case "empresa_invalida":
      return Response.json({ erro: "Empresa não encontrada." }, { status: 404 });
    case "falha_perfil":
      return Response.json(
        { erro: "Não foi possível concluir o cadastro. Tente novamente." },
        { status: 500 }
      );
    case "inconsistente":
      // Requer intervenção manual: registra só o user_id (sem token/sessão).
      console.error("[usuarios] estado inconsistente — intervir", { userId: resultado.userId });
      return Response.json(
        { erro: "Cadastro em estado inconsistente. Contate o suporte." },
        { status: 500 }
      );
  }
}
