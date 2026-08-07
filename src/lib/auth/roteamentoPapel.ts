// Decisão de rota por PAPEL (equipe × cliente) — lógica PURA e testável.
//
// Separa claramente o Painel da Agência (equipe) do Portal do Cliente
// (/cliente/*). O AuthGate usa `decidirRota` para redirecionar; o AppShell usa
// `estaNoPortalCliente` para saber quando NÃO renderizar a casca da equipe.
//
// Isto NÃO substitui a segurança: o RLS (migração 016) e a autorização
// server-side continuam sendo as camadas reais. Aqui é só a experiência de UI.

export type PapelPerfil = "equipe" | "cliente" | "agencia";

/** Os papéis que o sistema reconhece. Qualquer outro valor NÃO é papel. */
const PAPEIS: readonly PapelPerfil[] = ["equipe", "cliente", "agencia"];

/**
 * Lê o `papel` do banco — e devolve `null` para o que não reconhece.
 *
 * ===========================================================================
 * O DEFEITO QUE ESTA FUNÇÃO EXISTE PARA MATAR
 * ===========================================================================
 *
 * Os dois lugares que liam o papel faziam isto, em duas cópias:
 *
 *     papel: data.papel === "cliente" ? "cliente" : "equipe"
 *
 * Qualquer valor que não fosse exatamente "cliente" virava **"equipe"** — o
 * papel MAIS privilegiado. Não só o papel novo: um erro de digitação no banco
 * ("clientes", "Cliente", ""), um papel de um recurso futuro, qualquer coisa.
 * Falha ABERTA, e no lugar onde falhar aberto custa mais caro.
 *
 * A consequência com a migração 054 aplicada seria concreta: um perfil
 * `papel = 'agencia'` seria lido como equipe da Zion, e `avaliarAcesso`
 * libera equipe para QUALQUER `clienteAlvo` — em rotas que depois usam
 * `service_role`, que passa por cima do RLS.
 *
 * O banco já tinha corrigido exatamente esta classe de erro: `eh_equipe()`
 * carrega o comentário "sem perfil = SEM ACESSO (antes era true = equipe)".
 * O aplicativo tinha ficado para trás.
 *
 * `null` significa "não sei o que é isto", e quem não se sabe o que é não
 * entra.
 */
export function lerPapel(bruto: unknown): PapelPerfil | null {
  return typeof bruto === "string" && (PAPEIS as readonly string[]).includes(bruto)
    ? (bruto as PapelPerfil)
    : null;
}

export interface PerfilRota {
  papel: PapelPerfil;
  clienteId: string | null;
  /** Preenchido só quando `papel === "agencia"`. */
  agenciaId?: string | null;
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

  // A AGÊNCIA MORA NO MESMO PAINEL QUE A EQUIPE, e vê outra coisa nele.
  //
  // As telas de `/clientes`, `/esteira` e `/otimizar-lote` são operações sobre
  // VÁRIAS lojas — que é o trabalho de uma agência. Elas não filtram por papel:
  // consultam as tabelas e o RLS decide o que volta. Com a migração 054, a
  // equipe recebe tudo por `equipe_total` e a agência recebe as lojas dela por
  // `agencia_escopo`. A MESMA tela serve as duas, com conteúdos diferentes.
  //
  // Agência sem vínculo é perfil incompleto, pela mesma razão que cliente sem
  // empresa é: não há sobre o que operar.
  if (perfil.papel === "agencia") {
    if (!perfil.agenciaId) return { tipo: "sem_acesso" };
    return noPortal ? { tipo: "redirect", para: "/" } : { tipo: "ok" };
  }

  // equipe: nunca dentro do Portal do Cliente (evita ver a casca do cliente).
  return noPortal ? { tipo: "redirect", para: "/" } : { tipo: "ok" };
}
