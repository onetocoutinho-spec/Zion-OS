// Lógica PURA do fluxo "definir senha do convite" (F-01 / aceitação de convite).
//
// Sem React/rede — testável. Cobre: validação da nova senha, destino após o
// sucesso (por papel) e a montagem SEGURA do redirectTo do convite (a partir de
// uma variável controlada no servidor, nunca de valor livre do navegador).

export const SENHA_MIN = 8;

export type ValidacaoSenha = { ok: true } | { ok: false; erro: string };

/** Valida a nova senha e a confirmação. Puro. */
export function validarNovaSenha(senha: string, confirmacao: string): ValidacaoSenha {
  if (typeof senha !== "string" || senha.length < SENHA_MIN) {
    return { ok: false, erro: `A senha deve ter ao menos ${SENHA_MIN} caracteres.` };
  }
  if (senha !== confirmacao) {
    return { ok: false, erro: "As senhas não coincidem." };
  }
  return { ok: true };
}

/** Destino após definir a senha, conforme o papel do perfil. Puro. */
export function destinoAposSenha(papel: "equipe" | "cliente" | null | undefined): "/" | "/cliente" {
  return papel === "cliente" ? "/cliente" : "/";
}

/**
 * Monta o redirectTo do convite a partir da URL do app (env, server-side).
 * Usa SOMENTE a ORIGIN da URL configurada + a rota fixa — ignora path/query
 * arbitrário e rejeita esquemas não-http(s). Retorna null quando a env não é
 * uma URL http(s) válida (aí o Supabase usa o Site URL). Impede open redirect
 * e não aceita domínio vindo do navegador.
 */
export function montarRedirectConvite(
  appUrl: string | undefined | null,
  rota = "/definir-senha"
): string | null {
  if (!appUrl) return null;
  try {
    const u = new URL(appUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `${u.origin}${rota}`;
  } catch {
    return null;
  }
}
