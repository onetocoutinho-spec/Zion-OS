// Criação de usuário (agência ou cliente) + perfil — SOMENTE SERVIDOR.
//
// F-01: um único fluxo consistente. Autoriza, valida o payload, e usa o
// Supabase Admin (service_role, server-only) para criar o usuário no Auth e o
// perfil, com compensação se o perfil falhar. NUNCA retorna senha, token,
// sessão ou service_role ao navegador.
//
// A rota exigia `equipe`, e por isso uma conta de loja era MONOUSUÁRIO: a
// segunda pessoa da loja virava um chamado para a Zion, num produto vendido a
// "lojas com equipe própria". Agora a sessão basta, e QUEM pode convidar QUEM é
// `decidirConvite` — que tira a loja do perfil do autor, nunca do corpo. Sem
// essa troca, abrir a rota seria criar acesso em qualquer loja mudando um
// parâmetro; ver `src/modules/onboarding/domain/quemPodeConvidar.ts`.

import { getSupabaseAdmin, adminConfigurado } from "@/lib/supabase/admin";
import {
  exigirAutenticado,
  exigirAcessoAoCliente,
  respostaErroAutorizacao,
} from "@/lib/auth/serverAuthorization";
import { decidirConvite } from "@/modules/onboarding/domain/quemPodeConvidar";
import { alcanceDosAcessos } from "@/modules/onboarding/domain/alcanceDosAcessos";
import { lerTudoPaginado } from "@/lib/supabase/paginado";
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
    async agenciaExiste(agenciaId) {
      const { data } = await admin.from("agencias").select("id").eq("id", agenciaId).maybeSingle();
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
    async criarPerfil(userId, papel, clienteId, nome, agenciaId) {
      const { error } = await admin
        .from("perfis")
        .insert({ id: userId, papel, cliente_id: clienteId, agencia_id: agenciaId ?? null, nome });
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

  // 1) Autorização: sessão com perfil. Quem pode convidar QUEM é decidido no
  //    passo 2.b, depois de saber o que o corpo pediu — a equipe cria qualquer
  //    acesso, e o lojista só dentro da própria loja.
  let ctx;
  try {
    ctx = await exigirAutenticado(request);
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

  // 2.b) O VÍNCULO EFETIVO sai do perfil do autor, não do corpo.
  //
  // Enquanto só equipe chegava aqui, confiar no `clienteId` do corpo era
  // seguro. Não é mais: seria a vulnerabilidade da 055 de novo — criar acesso
  // em qualquer loja trocando um parâmetro. `decidirConvite` devolve o alvo, e
  // é ele que segue daqui para baixo.
  //
  // A agência é o ÚNICO caso em que o corpo escolhe a loja — ela opera várias e
  // precisa dizer qual. Por isso a escolha é conferida no banco antes, e a
  // conferência é a que já existe: `exigirAcessoAoCliente` responde "não" tanto
  // para loja de outra agência quanto para loja que não existe, sem revelar a
  // diferença. `decidirConvite` recebe a resposta pronta e nega por omissão.
  let agenciaAlcancaALoja = false;
  if (
    ctx.perfil.papel === "agencia" &&
    validacao.dados.papel === "cliente" &&
    validacao.dados.clienteId
  ) {
    try {
      await exigirAcessoAoCliente(request, validacao.dados.clienteId);
      agenciaAlcancaALoja = true;
    } catch {
      agenciaAlcancaALoja = false; // a recusa sai de `decidirConvite`, uma só
    }
  }

  const decisao = decidirConvite(
    { papel: ctx.perfil.papel, clienteId: ctx.perfil.clienteId, agenciaId: ctx.perfil.agenciaId },
    validacao.dados,
    { agenciaAlcancaALoja }
  );
  if (!decisao.ok) {
    return Response.json({ erro: decisao.motivo }, { status: decisao.status });
  }
  const dados = { ...validacao.dados, ...decisao.alvo };

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
    resultado = await criarUsuarioComPerfil(montarDeps(admin, redirectConvite), dados);
  } catch {
    // Erro inesperado (ex.: convite/SMTP, rede). Mensagem genérica — sem detalhe do Supabase.
    console.error("[usuarios] falha inesperada na criação", { papel: dados.papel });
    return Response.json({ erro: "Não foi possível criar o usuário agora. Tente novamente." }, { status: 500 });
  }

  // 5) Resposta sanitizada por tipo (nunca senha/token/sessão/APP_URL).
  switch (resultado.tipo) {
    case "convidado":
      console.info("[usuarios] convite criado", { papel: dados.papel });
      return Response.json({ ok: true, status: "convidado" }, { status: 201 });
    case "ja_existe":
      return Response.json(
        { ok: false, status: "ja_cadastrado", erro: "Este e-mail já tem cadastro no Zion OS." },
        { status: 409 }
      );
    case "empresa_invalida":
      return Response.json({ erro: "Loja não encontrada." }, { status: 404 });
    case "agencia_invalida":
      return Response.json({ erro: "Agência não encontrada." }, { status: 404 });
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

/**
 * GET /api/usuarios — quem tem acesso, no recorte de quem pergunta.
 *
 * Existe porque a agência NÃO lê `perfis` pelo RLS, e não deve: a 054 barrou
 * isso para toda consulta operacional, e uma política nova valeria também para
 * as que ela queria barrar. Aqui o caminho é estreito — sessão validada,
 * recorte decidido em `alcanceDosAcessos`, e só os campos que a tela mostra.
 *
 * Não devolve e-mail: ele mora no Auth, e esta rota lê `perfis`.
 */
export async function GET(request: Request) {
  if (!adminConfigurado()) {
    return Response.json({ pessoas: [] }, { status: 200 });
  }

  let ctx;
  try {
    ctx = await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  const alcance = alcanceDosAcessos({
    papel: ctx.perfil.papel,
    clienteId: ctx.perfil.clienteId,
    agenciaId: ctx.perfil.agenciaId,
  });
  if (alcance.tipo === "nenhum") {
    return Response.json({ pessoas: [] }, { status: 200 });
  }

  const admin = getSupabaseAdmin();
  const colunas = "id, nome, papel, cliente_id, agencia_id, ativo";

  // As DUAS leituras são paginadas. Uma agência com muitas lojas passa de 1.000
  // em qualquer das duas, e o PostgREST corta sem avisar — o defeito que
  // `lerTudoPaginado` existe para impedir, e que já custou quatro vezes neste
  // repositório. Numa lista de ACESSOS, cortar em silêncio esconde quem entra.
  let linhas: LinhaDePerfil[];
  try {
    if (alcance.tipo === "loja") {
      linhas = await lerTudoPaginado<LinhaDePerfil>("perfis", (de, ate) =>
        admin.from("perfis").select(colunas).eq("cliente_id", alcance.clienteId).order("nome").range(de, ate)
      );
    } else if (alcance.tipo === "agencia") {
      // As lojas da carteira saem do BANCO, não do pedido — é o mesmo princípio
      // do resto desta rota: o navegador não afirma o alcance.
      const lojas = await lerTudoPaginado<{ id: string }>("clientes", (de, ate) =>
        admin.from("clientes").select("id").eq("agencia_id", alcance.agenciaId).order("id").range(de, ate)
      );
      const ids = lojas.map((l) => l.id);
      linhas = await lerTudoPaginado<LinhaDePerfil>("perfis", (de, ate) => {
        const q = admin.from("perfis").select(colunas).order("nome").range(de, ate);
        // `in.()` com lista vazia é recusado pelo PostgREST. Sem lojas na
        // carteira, o alcance é só a própria agência.
        return ids.length
          ? q.or(`agencia_id.eq.${alcance.agenciaId},cliente_id.in.(${ids.join(",")})`)
          : q.eq("agencia_id", alcance.agenciaId);
      });
    } else {
      linhas = await lerTudoPaginado<LinhaDePerfil>("perfis", (de, ate) =>
        admin.from("perfis").select(colunas).order("nome").range(de, ate)
      );
    }
  } catch {
    console.error("[usuarios] falha ao listar acessos");
    return Response.json({ erro: "Não foi possível ler os acessos agora." }, { status: 500 });
  }

  return Response.json({
    pessoas: linhas.map((l) => ({
      id: l.id,
      nome: l.nome ?? "",
      papel: l.papel,
      clienteId: l.cliente_id,
      agenciaId: l.agencia_id,
      ativo: l.ativo !== false,
    })),
  });
}

/** A linha de `perfis` como esta rota a lê. */
interface LinhaDePerfil {
  id: string;
  nome: string | null;
  papel: string;
  cliente_id: string | null;
  agencia_id: string | null;
  ativo: boolean | null;
}
