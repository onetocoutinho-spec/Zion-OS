// O SINAL DE LACUNA — o que os operadores pedem e o Zion ainda não faz.
// ⚠️ Server-only.
//
// ===========================================================================
// POR QUE ISTO PRECISOU EXISTIR
// ===========================================================================
//
// `ia_execucoes` registra o que RODOU. Nada registrava o que foi PEDIDO e não
// tinha caminho — e é justamente esse o dado que responde "o que construir a
// seguir" sem depender de opinião.
//
// A gravação acontece no momento honesto: quando o Copilot confere se sabe
// fazer algo, descobre que não sabe, e vai dizer isso. A checagem e o sinal
// são o mesmo movimento.
//
// ===========================================================================
// POR QUE NO JOURNAL, E EM CONTEXTO PRÓPRIO
// ===========================================================================
//
// Reusa a tabela `decisoes`, que já existe, já tem escrita pelo servidor e já
// carrega o tenant. Uma tabela nova exigiria migração, política de agência
// escrita à mão e classificação na verificação de alcance — peso grande para
// um contador.
//
// Mas o contexto é OUTRO: `copilot-lacuna`, e não `copilot`. As tendências de
// conteúdo leem as últimas 300 decisões do contexto `copilot`; misturar os
// sinais ali empurraria as preferências de título e imagem para fora da janela
// — o medidor de uma coisa estragaria o de outra.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decisaoParaBanco } from "@/modules/adaptive-intelligence/infrastructure/decision.mapper";

export interface SinalDeLacuna {
  clienteId: string;
  usuarioId: string | null;
  /** O assunto do registro de habilidades. É a chave de contagem. */
  assunto: string;
  /** O pedido, nas palavras de quem operou. É o que ensina o próximo passo. */
  pedido: string;
  conversaId?: string | null;
}

/**
 * Registra que alguém pediu algo sem caminho no Zion.
 *
 * NUNCA lança: um sinal perdido é ruim; uma resposta derrubada por causa dele
 * é pior — e a resposta aqui é justamente a explicação honesta da lacuna.
 */
export async function registrarLacuna(s: SinalDeLacuna): Promise<void> {
  const pedido = s.pedido.trim();
  if (!s.assunto.trim()) return;
  try {
    const linha = decisaoParaBanco({
      id: crypto.randomUUID(),
      empresa: s.clienteId,
      autor: s.usuarioId ?? "",
      contexto: "copilot-lacuna",
      entidade: { tipo: "habilidade", id: s.assunto },
      campo: `lacuna:${s.assunto}`,
      valorAnterior: null,
      // O pedido é texto de quem digitou — entra recortado, e como VALOR.
      valorNovo: (pedido || s.assunto).slice(0, 500),
      origem: "copilot",
      timestamp: new Date().toISOString(),
      correlacao: s.conversaId ?? null,
    });
    const { error } = await getSupabaseAdmin().from("decisoes").insert({ id: crypto.randomUUID(), ...linha });
    if (error) console.error("[lacunas/copilot] falha ao registrar:", error);
  } catch (e) {
    console.error("[lacunas/copilot] falha ao registrar:", e);
  }
}

export interface LacunaContada {
  assunto: string;
  vezes: number;
  /** Os pedidos mais recentes, para ler o que as pessoas realmente queriam. */
  exemplos: string[];
}

/**
 * O que mais foi pedido e não tinha caminho, do maior para o menor.
 *
 * Leitura para quem decide o roadmap — não entra em prompt de modelo.
 */
export async function lacunasMaisPedidas(clienteId: string, limite = 200): Promise<LacunaContada[]> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("decisoes")
      .select("campo, valor_novo")
      .eq("empresa", clienteId)
      .eq("contexto", "copilot-lacuna")
      .order("decidido_em", { ascending: false })
      .limit(limite);
    if (error || !data) return [];
    const porAssunto = new Map<string, string[]>();
    for (const l of data as { campo: string; valor_novo: string }[]) {
      const assunto = l.campo.replace(/^lacuna:/, "");
      const e = porAssunto.get(assunto);
      if (e) e.push(l.valor_novo);
      else porAssunto.set(assunto, [l.valor_novo]);
    }
    return [...porAssunto.entries()]
      .map(([assunto, pedidos]) => ({ assunto, vezes: pedidos.length, exemplos: pedidos.slice(0, 3) }))
      .sort((a, b) => b.vezes - a.vezes || a.assunto.localeCompare(b.assunto));
  } catch (e) {
    console.error("[lacunas/copilot] falha ao ler:", e);
    return [];
  }
}
