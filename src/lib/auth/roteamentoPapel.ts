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
 * Decide o destino a partir do perfil real e da rota atual:
 *   - sem perfil / inativo / cliente sem empresa  → "sem_acesso"
 *   - cliente fora de /cliente                     → redirect "/cliente"
 *   - cliente dentro de /cliente                   → "ok"
 *   - equipe dentro de /cliente                    → redirect "/" (Painel da Agência)
 *   - equipe fora de /cliente                      → "ok"
 */
export function decidirRota(perfil: PerfilRota | null, pathname: string): DecisaoRota {
  if (!perfil || perfil.ativo === false) return { tipo: "sem_acesso" };

  const noPortal = estaNoPortalCliente(pathname);

  if (perfil.papel === "cliente") {
    if (!perfil.clienteId) return { tipo: "sem_acesso" }; // cliente sem empresa = perfil incompleto
    return noPortal ? { tipo: "ok" } : { tipo: "redirect", para: "/cliente" };
  }

  // equipe: nunca dentro do Portal do Cliente (evita ver a casca do cliente).
  return noPortal ? { tipo: "redirect", para: "/" } : { tipo: "ok" };
}
