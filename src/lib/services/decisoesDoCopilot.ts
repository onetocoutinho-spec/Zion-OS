// O JOURNAL DE DECISÕES do Copilot, no SERVIDOR — escrever o que a loja
// aprovou ou recusou, e ler as tendências. Tabela `decisoes` (a mesma do
// adaptive-intelligence), contexto "copilot". ⚠️ Server-only.
//
// `capturarDecisao` do adaptive-intelligence roda no navegador (repositório
// com o cliente do navegador). A confirmação de proposta roda no servidor,
// então a escrita vai pelo admin, com a MESMA forma (`decisaoParaBanco`).

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decisaoParaBanco } from "@/modules/adaptive-intelligence/infrastructure/decision.mapper";
import { tendenciasObservadas, type DecisaoObservada } from "@/modules/assistant/domain/tendenciasObservadas";

export interface DecisaoDoCopilot {
  clienteId: string;
  usuarioId: string | null;
  entidade: { tipo: string; id: string };
  /** tituloAnuncio · descricaoAnuncio · palavrasChaveAnuncio · imagem:feedback · imagem:aprovada:<slot> */
  campo: string;
  valorAnterior: string | null;
  valorNovo: string;
  origem: string;
  correlacao?: string | null;
  metadados?: Record<string, unknown>;
}

/** Nunca lança: uma decisão perdida é ruim; uma confirmação derrubada por causa dela é pior. */
export async function registrarDecisaoDoCopilot(d: DecisaoDoCopilot): Promise<void> {
  if (!d.valorNovo.trim() || d.valorAnterior === d.valorNovo) return;
  try {
    const linha = decisaoParaBanco({
      id: crypto.randomUUID(),
      empresa: d.clienteId,
      autor: d.usuarioId ?? "",
      contexto: "copilot",
      entidade: d.entidade,
      campo: d.campo,
      valorAnterior: d.valorAnterior,
      valorNovo: d.valorNovo.slice(0, 2000),
      origem: d.origem,
      timestamp: new Date().toISOString(),
      correlacao: d.correlacao ?? null,
      ...(d.metadados ? { metadados: d.metadados } : {}),
    });
    const { error } = await getSupabaseAdmin().from("decisoes").insert({ id: crypto.randomUUID(), ...linha });
    if (error) console.error("[decisoes/copilot] falha ao registrar:", error);
  } catch (e) {
    console.error("[decisoes/copilot] falha ao registrar:", e);
  }
}

/** As tendências da loja, a partir das últimas decisões do Copilot. Vazio = sem tendência. */
export async function tendenciasDaLoja(clienteId: string): Promise<string[]> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("decisoes")
      .select("campo, valor_novo, valor_anterior, metadados")
      .eq("empresa", clienteId)
      .eq("contexto", "copilot")
      .order("decidido_em", { ascending: false })
      .limit(300);
    if (error || !data) return [];
    const decisoes: DecisaoObservada[] = (data as { campo: string; valor_novo: string; valor_anterior: string | null; metadados: Record<string, unknown> | null }[]).map(
      (l) => ({ campo: l.campo, valorNovo: l.valor_novo, valorAnterior: l.valor_anterior, metadados: l.metadados })
    );
    return tendenciasObservadas(decisoes);
  } catch (e) {
    console.error("[decisoes/copilot] falha ao ler tendências:", e);
    return [];
  }
}
