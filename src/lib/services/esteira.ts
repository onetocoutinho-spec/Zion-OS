import { anuncioSimulado, type AnuncioGerado } from "../agentes/esteira";

export interface ResultadoEsteira {
  anuncio: AnuncioGerado;
  tipo: "IA" | "Simulada";
  aviso?: string;
}

export interface OpcoesEsteira {
  /** Bloco de dados do sistema (cliente/produto/anúncio) montado por lib/contexto. */
  contexto?: string;
  /** Nome do produto (para o título simulado e logs). */
  produto?: string;
}

/**
 * Roda a esteira de anúncio (A1→A2→A9→A4→A10) via /api/agentes/esteira.
 * Sem ANTHROPIC_API_KEY no servidor, devolve um anúncio simulado com aviso.
 */
export async function rodarEsteira(
  briefing: string,
  opcoes: OpcoesEsteira = {}
): Promise<ResultadoEsteira> {
  const resposta = await fetch("/api/agentes/esteira", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      briefing,
      contexto: opcoes.contexto,
      produto: opcoes.produto,
    }),
  });

  if (resposta.status === 503) {
    return {
      anuncio: anuncioSimulado(opcoes.produto ?? ""),
      tipo: "Simulada",
      aviso:
        "ANTHROPIC_API_KEY não configurada — a esteira rodou em modo simulado. Configure a chave no .env.local do servidor para a geração real.",
    };
  }

  const dados = (await resposta.json()) as { anuncio?: AnuncioGerado; erro?: string };
  if (!resposta.ok || !dados.anuncio) {
    throw new Error(dados.erro ?? "Falha ao rodar a esteira.");
  }

  return { anuncio: dados.anuncio, tipo: "IA" };
}
