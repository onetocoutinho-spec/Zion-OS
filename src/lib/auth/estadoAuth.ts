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

// ===========================================================================
// QUANDO UM EVENTO DE SESSÃO DEVE RECARREGAR O PERFIL
// ===========================================================================
//
// O DEFEITO, RELATADO PELO USUÁRIO EM 2026-08-01
// ----------------------------------------------
// "eu cliquei em só os anúncios novos mas troquei de aba, e quando troco de aba
//  no navegador o sistema recarrega"
//
// `onAuthStateChange` do Supabase NÃO dispara só em login e logout. Ele dispara
// também quando a aba volta a ficar visível, porque a biblioteca reconfere e
// renova o token. O AuthGate tratava todo evento como "resolveu a sessão" e
// chamava `carregar()`, que começa com `setFasePerfil("carregando")` — e
// `decidirEstadoAuth` devolve `carregando_perfil`, que é a TELA CHEIA de
// carregando.
//
// Efeito: trocar de aba desmontava o app inteiro. No meio de uma importação de
// 781 anúncios, isso apagou a mensagem de resultado — a gravação sobreviveu
// (são `fetch`, não React), mas o usuário ficou sem saber o que aconteceu.
//
// A REGRA
// -------
// Renovar token não é trocar de sessão. Se é o MESMO usuário e o perfil já está
// carregado, não há nada a recarregar e não há por que piscar tela.
//
// Recarrega quando:
//   · o usuário MUDOU (login, logout→login, troca de conta) — aí o perfil
//     anterior é de outra pessoa e manter seria vazamento;
//   · o perfil ainda não chegou (`inicial`) ou falhou (`erro`) — nesses dois o
//     recarregar é a recuperação, e nenhum deles está mostrando app funcionando.
//
// NÃO recarrega em `sem_perfil` e `inativo`: são respostas CONCLUÍDAS do
// servidor, não falhas. Repetir a consulta a cada troca de aba faria a tela de
// "acesso não liberado" piscar sem chance nenhuma de mudar de resposta.

/** O que o AuthGate sabe do perfil quando um evento de sessão chega. */
export type FasePerfilConhecida = FasePerfil | "inicial";

export function precisaRecarregarPerfil(
  usuarioAnterior: string | null,
  usuarioNovo: string | null,
  fasePerfil: FasePerfilConhecida
): boolean {
  if (!usuarioNovo) return false; // sem sessão: quem trata é o ramo de logout
  if (usuarioAnterior !== usuarioNovo) return true; // outra pessoa
  return fasePerfil === "inicial" || fasePerfil === "erro";
}
