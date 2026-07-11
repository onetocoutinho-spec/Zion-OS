// Criação de usuário (agência ou cliente) + perfil — LÓGICA PURA e testável.
//
// F-01: garante um único fluxo server-side consistente. Este módulo NÃO importa
// Supabase — recebe as operações por injeção de dependência (`DepsCriacaoUsuario`),
// para ser testável com mocks. A rota /api/usuarios liga estas funções ao
// Supabase Admin (service_role, só no servidor).
//
// Modelo real do projeto: papel ∈ {equipe, cliente} em `perfis`; cliente é
// escopado por `cliente_id` (não há `team_id`/`company_id`). O "tenant" é a
// própria agência Zion — só usuário de equipe pode criar usuários.

export const PAPEIS_PERMITIDOS = ["equipe", "cliente"] as const;
export type PapelNovo = (typeof PAPEIS_PERMITIDOS)[number];

export interface DadosNovoUsuario {
  nome: string;
  email: string;
  papel: PapelNovo;
  /** Obrigatório e válido para cliente; sempre null para equipe. */
  clienteId: string | null;
}

export type ValidacaoPayload =
  | { ok: true; dados: DadosNovoUsuario }
  | { ok: false; erro: string; campo: string };

// Só estes campos são aceitos do navegador. Qualquer outro (team_id, user_id,
// ativo, role, service_role, etc.) é REJEITADO — o cliente não decide privilégio.
const CAMPOS_PERMITIDOS = new Set(["nome", "email", "papel", "clienteId"]);
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NOME = 120;
const MAX_EMAIL = 254;

/** Valida e normaliza o payload do navegador. Puro. */
export function validarPayloadNovoUsuario(bruto: unknown): ValidacaoPayload {
  if (!bruto || typeof bruto !== "object") {
    return { ok: false, erro: "Payload inválido.", campo: "_" };
  }
  const obj = bruto as Record<string, unknown>;

  // Rejeita campos desconhecidos/privilegiados.
  for (const chave of Object.keys(obj)) {
    if (!CAMPOS_PERMITIDOS.has(chave)) {
      return { ok: false, erro: `Campo não permitido: ${chave}.`, campo: chave };
    }
  }

  const nome = typeof obj.nome === "string" ? obj.nome.trim() : "";
  if (!nome) return { ok: false, erro: "Nome é obrigatório.", campo: "nome" };
  if (nome.length > MAX_NOME) return { ok: false, erro: "Nome muito longo.", campo: "nome" };

  const email = typeof obj.email === "string" ? obj.email.trim().toLowerCase() : "";
  if (!email || !RE_EMAIL.test(email) || email.length > MAX_EMAIL) {
    return { ok: false, erro: "E-mail inválido.", campo: "email" };
  }

  const papel = obj.papel;
  if (papel !== "equipe" && papel !== "cliente") {
    return { ok: false, erro: "Papel inválido.", campo: "papel" };
  }

  let clienteId: string | null = null;
  if (papel === "cliente") {
    if (typeof obj.clienteId !== "string" || !RE_UUID.test(obj.clienteId)) {
      return { ok: false, erro: "Empresa obrigatória e válida para cliente.", campo: "clienteId" };
    }
    clienteId = obj.clienteId;
  } else {
    // Equipe não recebe empresa; se vier valor, rejeita (não decide livremente).
    if (obj.clienteId != null && obj.clienteId !== "") {
      return { ok: false, erro: "Usuário de equipe não recebe empresa.", campo: "clienteId" };
    }
  }

  return { ok: true, dados: { nome, email, papel, clienteId } };
}

// ---- Orquestração (dependências injetadas → testável sem Supabase) ----

export interface DepsCriacaoUsuario {
  /** A empresa (cliente) existe? (mesmo tenant = existe em `clientes`). */
  empresaExiste(clienteId: string): Promise<boolean>;
  /** Usuário do Auth já existe para este e-mail? (idempotência) */
  buscarAuthPorEmail(email: string): Promise<{ id: string } | null>;
  /** Convida (cria) o usuário no Auth. Retorna o id. NÃO retorna senha/token. */
  convidarAuthUser(email: string, nome: string): Promise<{ id: string }>;
  /** Cria o perfil (id = user_id do Auth). */
  criarPerfil(userId: string, papel: PapelNovo, clienteId: string | null, nome: string): Promise<void>;
  /** Compensação: remove SOMENTE o usuário recém-criado nesta operação. */
  removerAuthUser(userId: string): Promise<void>;
}

export type ResultadoCriacao =
  | { tipo: "convidado"; userId: string } //         sucesso (Auth + perfil)
  | { tipo: "ja_existe" } //                          e-mail já cadastrado (idempotente)
  | { tipo: "empresa_invalida" } //                   cliente sem empresa válida
  | { tipo: "falha_perfil" } //                       Auth criado, perfil falhou, usuário removido (compensado)
  | { tipo: "inconsistente"; userId: string }; //     compensação também falhou (requer intervenção)

/**
 * Fluxo único e consistente. Ordem: valida empresa → checa duplicidade →
 * cria no Auth → cria perfil → compensa se o perfil falhar. Nunca duplica em
 * retry (a checagem por e-mail vem antes). Nunca remove usuário pré-existente.
 */
export async function criarUsuarioComPerfil(
  deps: DepsCriacaoUsuario,
  dados: DadosNovoUsuario
): Promise<ResultadoCriacao> {
  // 1) empresa obrigatória e válida para cliente
  if (dados.papel === "cliente") {
    if (!dados.clienteId || !(await deps.empresaExiste(dados.clienteId))) {
      return { tipo: "empresa_invalida" };
    }
  }

  // 2) idempotência: e-mail já cadastrado → não duplica
  const existente = await deps.buscarAuthPorEmail(dados.email);
  if (existente) return { tipo: "ja_existe" };

  // 3) cria no Auth
  const novo = await deps.convidarAuthUser(dados.email, dados.nome);

  // 4) cria o perfil; 5) compensa se falhar
  try {
    await deps.criarPerfil(novo.id, dados.papel, dados.clienteId, dados.nome);
    return { tipo: "convidado", userId: novo.id };
  } catch {
    try {
      await deps.removerAuthUser(novo.id); // remove só o recém-criado
      return { tipo: "falha_perfil" };
    } catch {
      return { tipo: "inconsistente", userId: novo.id };
    }
  }
}
