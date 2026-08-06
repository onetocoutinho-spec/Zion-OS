// Decisão de rota por PAPEL (equipe × cliente) — lógica PURA e testável.
//
// Separa claramente o Painel da Agência (equipe) do Portal do Cliente
// (/cliente/*). O AuthGate usa `decidirRota` para redirecionar; o AppShell usa
// `estaNoPortalCliente` para saber quando NÃO renderizar a casca da equipe.
//
// Isto NÃO substitui a segurança: o RLS (migração 016) e a autorização
// server-side continuam sendo as camadas reais. Aqui é só a experiência de UI.

export type PapelPerfil = "equipe" | "cliente";

export interface PerfilRota {
  papel: PapelPerfil;
  clienteId: string | null;
  /** Ausente = tratado como ativo (o meuPerfil já devolve null p/ inativo). */
  ativo?: boolean;
}

export type DecisaoRota =
  | { tipo: "sem_acesso" }
  | { tipo: "ok" }
  | { tipo: "redirect"; para: string };

/**
 * true só para o Portal do Cliente (/cliente e /cliente/…).
 * ⚠️ Usa a barra final para NÃO confundir com a rota da equipe `/clientes`
 * (lista de clientes), que começa com "/cliente" mas não é o portal.
 */
export function estaNoPortalCliente(pathname: string): boolean {
  return pathname === "/cliente" || pathname.startsWith("/cliente/");
}

/**
 * Onde a equipe entra.
 *
 * Era "/" — o painel da agência, que lia sete tabelas e mostrava clientes
 * ativos, tarefas atrasadas e faturamento previsto. A Zion deixou de ser
 * agência (PLANO-003) e seis dessas sete tabelas saíram; a tela perdeu o
 * assunto. Contas é o que resta respondendo "quem são os clientes".
 */
export const ENTRADA_DA_EQUIPE = "/clientes";

/**
 * Decide o destino a partir do perfil real e da rota atual:
 *   - sem perfil / inativo / cliente sem empresa  → "sem_acesso"
 *   - cliente fora de /cliente                     → redirect "/cliente"
 *   - cliente dentro de /cliente                   → "ok"
 *   - equipe dentro de /cliente                    → redirect para a entrada
 *   - equipe na raiz "/"                           → redirect para a entrada
 *   - equipe em qualquer outra rota da equipe      → "ok"
 *
 * ===========================================================================
 * POR QUE A RAIZ É DECIDIDA AQUI, E NÃO COM `redirect()` NA PÁGINA
 * ===========================================================================
 *
 * A primeira tentativa foi um `redirect("/clientes")` dentro de
 * `src/app/page.tsx`, Server Component. **Não dispara.** Medido no log do
 * servidor: `GET / 200`, sempre — nunca um 307.
 *
 * A causa é a ordem das camadas: o `AuthGate` é um Client Component no layout
 * raiz, e quando ele decide mostrar o login os filhos não chegam a ser
 * avaliados. A página com o `redirect` fica atrás dessa porta.
 *
 * Aqui a decisão é pura, roda no mesmo lugar que todas as outras decisões de
 * rota, e tem teste.
 */
export function decidirRota(perfil: PerfilRota | null, pathname: string): DecisaoRota {
  if (!perfil || perfil.ativo === false) return { tipo: "sem_acesso" };

  const noPortal = estaNoPortalCliente(pathname);

  if (perfil.papel === "cliente") {
    if (!perfil.clienteId) return { tipo: "sem_acesso" }; // cliente sem empresa = perfil incompleto
    return noPortal ? { tipo: "ok" } : { tipo: "redirect", para: "/cliente" };
  }

  // equipe: nunca dentro do Portal do Cliente (evita ver a casca do cliente),
  // e nunca parada na raiz, que hoje não tem tela própria.
  if (noPortal || pathname === "/") {
    return { tipo: "redirect", para: ENTRADA_DA_EQUIPE };
  }
  return { tipo: "ok" };
}
