// Autorização SERVER-SIDE do Zion OS (R6).
//
// O app usa o Supabase no NAVEGADOR (a sessão vive no browser). Para autorizar
// no SERVIDOR, o navegador envia o access_token no header `Authorization:
// Bearer <jwt>` (ver src/lib/supabase/sessao.ts). Aqui validamos esse token
// contra o Auth do Supabase e carregamos o PERFIL REAL do banco — NUNCA
// confiamos em papel/clienteId vindos do corpo da requisição.
//
// Regras (ver docs/zion-os-audit/04 R1/R6):
//   * sem token / token inválido          -> 401
//   * autenticado sem perfil               -> 403
//   * perfil inativo                       -> 403
//   * equipe                               -> acessa qualquer cliente
//   * cliente                              -> só o próprio cliente
//   * cliente tentando outro cliente       -> 403 (sem revelar existência)
//
// O RLS do Supabase continua sendo a SEGUNDA camada: as consultas feitas com o
// cliente retornado por `criarClienteComToken` respeitam as políticas por papel.
//
// ⚠️ Server-only. Não importe em componentes do navegador.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** true quando o Supabase está configurado no servidor. Sem isso = modo demo. */
export const autenticacaoConfigurada = Boolean(url && anonKey);

export type Papel = "equipe" | "cliente";
export type Regra = "autenticado" | "equipe" | "cliente";

export interface UsuarioAutenticado {
  id: string;
  email: string | null;
}

export interface PerfilServidor {
  papel: Papel;
  clienteId: string | null;
  ativo: boolean;
  nome: string;
}

export interface ContextoAutorizado {
  usuario: UsuarioAutenticado | null; // null só no modo demo
  perfil: PerfilServidor;
  /** Cliente Supabase com o token do usuário (consultas respeitam o RLS). null no demo. */
  supabase: SupabaseClient | null;
}

/** Erro de autorização com status HTTP (401/403). */
export class ErroAutorizacao extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, mensagem: string) {
    super(mensagem);
    this.name = "ErroAutorizacao";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Funções PURAS (testáveis sem rede) — o coração da decisão de acesso.
// ---------------------------------------------------------------------------

/** Extrai o JWT de um header "Authorization: Bearer <token>". Puro. */
export function lerTokenBearer(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const token = m?.[1]?.trim();
  return token ? token : null;
}

export type Decisao = { ok: true } | { ok: false; status: 401 | 403; motivo: string };

/**
 * Decide o acesso a partir do PERFIL já carregado (ou null = sem perfil) e da
 * regra exigida. `clienteAlvo` restringe a um cliente específico. Puro.
 *
 * Pressupõe que o usuário JÁ foi autenticado (token válido). A ausência de
 * autenticação (401) é tratada antes, ao ler o token.
 */
export function avaliarAcesso(params: {
  perfil: PerfilServidor | null;
  regra: Regra;
  clienteAlvo?: string | null;
}): Decisao {
  const { perfil, regra, clienteAlvo } = params;

  // Autenticado, mas sem perfil = SEM ACESSO (R1).
  if (!perfil) return { ok: false, status: 403, motivo: "Usuário sem perfil." };
  if (!perfil.ativo) return { ok: false, status: 403, motivo: "Perfil inativo." };

  if (regra === "equipe" && perfil.papel !== "equipe") {
    return { ok: false, status: 403, motivo: "Requer perfil de equipe." };
  }
  if (regra === "cliente" && perfil.papel !== "cliente") {
    return { ok: false, status: 403, motivo: "Requer perfil de cliente." };
  }

  if (clienteAlvo != null && clienteAlvo !== "") {
    // Equipe acessa qualquer cliente; cliente só o próprio.
    if (perfil.papel === "equipe") return { ok: true };
    if (perfil.papel === "cliente" && perfil.clienteId && perfil.clienteId === clienteAlvo) {
      return { ok: true };
    }
    // Não revela se o recurso do outro cliente existe.
    return { ok: false, status: 403, motivo: "Sem permissão para este recurso." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// IO — validação de token e carga de perfil.
// ---------------------------------------------------------------------------

/** Cria um cliente Supabase que envia o token do usuário (consultas via RLS). */
export function criarClienteComToken(token: string): SupabaseClient {
  return createClient(url as string, anonKey as string, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Valida o token e devolve o usuário autenticado (ou null se inválido). */
export async function obterUsuarioAutenticado(
  req: Request
): Promise<{ usuario: UsuarioAutenticado; token: string; supabase: SupabaseClient } | null> {
  if (!autenticacaoConfigurada) return null;
  const token = lerTokenBearer(req.headers.get("authorization"));
  if (!token) return null;
  const supabase = criarClienteComToken(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return {
    usuario: { id: data.user.id, email: data.user.email ?? null },
    token,
    supabase,
  };
}

/** Carrega o perfil real do usuário (via RLS: o usuário lê o próprio perfil). */
export async function obterPerfilDoUsuario(
  supabase: SupabaseClient,
  userId: string
): Promise<PerfilServidor | null> {
  const { data, error } = await supabase
    .from("perfis")
    .select("papel, cliente_id, nome, ativo")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error; // erro real de banco sobe (não vira "sem acesso" silencioso)
  if (!data) return null;
  return {
    papel: data.papel === "cliente" ? "cliente" : "equipe",
    clienteId: (data.cliente_id as string | null) ?? null,
    ativo: (data.ativo as boolean | null) ?? true,
    nome: (data.nome as string | null) ?? "",
  };
}

/** Contexto demo (Supabase não configurado): trata como equipe, sem bloquear. */
function contextoDemo(): ContextoAutorizado {
  return { usuario: null, perfil: { papel: "equipe", clienteId: null, ativo: true, nome: "demo" }, supabase: null };
}

// ---------------------------------------------------------------------------
// Guardas de rota — lançam ErroAutorizacao (401/403). Use com respostaErroAutorizacao.
// ---------------------------------------------------------------------------

async function autorizar(req: Request, regra: Regra, clienteAlvo?: string | null): Promise<ContextoAutorizado> {
  if (!autenticacaoConfigurada) return contextoDemo(); // modo demo: não bloqueia
  const auth = await obterUsuarioAutenticado(req);
  if (!auth) throw new ErroAutorizacao(401, "Não autenticado.");
  const perfil = await obterPerfilDoUsuario(auth.supabase, auth.usuario.id);
  const decisao = avaliarAcesso({ perfil, regra, clienteAlvo });
  if (!decisao.ok) throw new ErroAutorizacao(decisao.status, decisao.motivo);
  return { usuario: auth.usuario, perfil: perfil as PerfilServidor, supabase: auth.supabase };
}

/** Qualquer usuário autenticado com perfil ativo. */
export function exigirAutenticado(req: Request): Promise<ContextoAutorizado> {
  return autorizar(req, "autenticado");
}

/** Somente equipe. */
export function exigirEquipe(req: Request): Promise<ContextoAutorizado> {
  return autorizar(req, "equipe");
}

/** Somente cliente. */
export function exigirCliente(req: Request): Promise<ContextoAutorizado> {
  return autorizar(req, "cliente");
}

/** Autenticado E com acesso ao cliente informado (equipe: qualquer; cliente: só o seu). */
export function exigirAcessoAoCliente(req: Request, clienteId: string): Promise<ContextoAutorizado> {
  return autorizar(req, "autenticado", clienteId);
}

/** Converte um ErroAutorizacao em Response JSON com o status correto. */
export function respostaErroAutorizacao(e: unknown): Response {
  if (e instanceof ErroAutorizacao) {
    return Response.json({ erro: e.message }, { status: e.status });
  }
  // Erro inesperado (ex.: banco): não vaza detalhe, responde 500.
  return Response.json({ erro: "Falha ao autorizar a requisição." }, { status: 500 });
}
