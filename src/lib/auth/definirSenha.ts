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

/**
 * Destino após definir a senha, conforme o papel do perfil. Puro.
 *
 * Só o `cliente` vai para o portal. Equipe e AGÊNCIA vão para o painel — as
 * duas operam várias lojas, e a diferença entre elas é o que o RLS deixa cada
 * uma enxergar lá dentro, não a rota.
 */
export function destinoAposSenha(
  papel: "equipe" | "cliente" | "agencia" | null | undefined
): "/" | "/cliente" {
  return papel === "cliente" ? "/cliente" : "/";
}

/** Rota fixa de aceitação de convite (nunca vem do navegador). */
export const ROTA_DEFINIR_SENHA = "/definir-senha";

/**
 * Monta o redirectTo do convite a partir da URL do app (env `APP_URL`,
 * SERVER-SIDE). Usa SOMENTE a ORIGIN da URL + a rota fixa `/definir-senha`:
 * ignora path/query/fragment arbitrário e **exige protocolo https** (Preview/
 * Production). Retorna `null` quando a env é ausente/ inválida/ não-https — nesse
 * caso o convite NÃO deve ser enviado (o chamador falha de forma segura, sem
 * cair silenciosamente no Site URL). Impede open redirect e nunca aceita
 * domínio vindo do navegador.
 */
export function montarRedirectConvite(appUrl: string | undefined | null): string | null {
  if (!appUrl) return null;
  try {
    const u = new URL(appUrl);
    if (u.protocol !== "https:") return null; // só https em Preview/Production
    return `${u.origin}${ROTA_DEFINIR_SENHA}`; // só a origin + rota fixa (normaliza barra)
  } catch {
    return null;
  }
}
