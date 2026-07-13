// Máquina de estados de autenticação/carregamento de perfil (lógica PURA).
//
// Separa explicitamente os estados que antes eram confundidos (A-01):
// uma falha de rede/timeout NÃO pode ser tratada como "sem acesso". Só é
// "acesso não liberado" quando a consulta ao perfil TERMINOU com sucesso e o
// perfil não existe / está inativo.
//
// Esta função é pura e testável; o AuthGate a usa para decidir a tela.

/** Fase da sessão do Supabase. */
export type FaseSessao = "restaurando" | "ausente" | "presente";

/** Fase do carregamento do perfil (só relevante quando a sessão está presente). */
export type FasePerfil = "carregando" | "ok" | "sem_perfil" | "inativo" | "erro";

/** Estado final que o AuthGate renderiza. */
export type EstadoAuth =
  | "restaurando_sessao" // sessão ainda sendo restaurada → loading
  | "sem_sessao" //         não autenticado → login
  | "carregando_perfil" //  autenticado, perfil carregando → loading
  | "autorizado" //         perfil ok e ativo → app
  | "sem_perfil" //         perfil inexistente → "Acesso não liberado"
  | "perfil_inativo" //     perfil ativo=false → "Acesso desativado"
  | "erro_perfil"; //       rede/timeout/erro → erro temporário (com retry)

/**
 * Decide o estado a partir da fase da sessão e da fase do perfil. PURA.
 *
 * Regra central de A-01: erro/timeout (`fasePerfil="erro"`) vira
 * `erro_perfil`, NUNCA `sem_perfil`. Só `sem_perfil`/`perfil_inativo` negam
 * acesso — e apenas com a sessão presente e a consulta concluída.
 */
export function decidirEstadoAuth(sessao: FaseSessao, perfil: FasePerfil): EstadoAuth {
  if (sessao === "restaurando") return "restaurando_sessao";
  if (sessao === "ausente") return "sem_sessao";
  // sessão presente:
  switch (perfil) {
    case "carregando":
      return "carregando_perfil";
    case "ok":
      return "autorizado";
    case "sem_perfil":
      return "sem_perfil";
    case "inativo":
      return "perfil_inativo";
    case "erro":
      return "erro_perfil";
  }
}
