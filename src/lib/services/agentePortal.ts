// Execução de UM agente do catálogo a partir do Portal do Cliente.
//
// Cada ferramenta de /cliente/otimizar (título, descrição, SEO, medidas,
// ficha, imagens) roda só o SEU agente real — chamada única, rápida, e devolve
// o resultado em Markdown para o cliente revisar/copiar. Reaproveita
// /api/agentes/executar (mesma infra dos Agentes IA da equipe).

import { agentePorFerramenta, type FerramentaPortal } from "../agentes/catalogo";

export interface ResultadoAgentePortal {
  markdown: string;
  tipo: "IA" | "Simulada";
  /** Rótulo do agente usado, ex.: "A3 · Título". */
  agente: string;
}

export async function rodarAgentePortal(
  ferramenta: FerramentaPortal,
  opcoes: { contexto?: string; produto?: string } = {}
): Promise<ResultadoAgentePortal> {
  const agente = agentePorFerramenta(ferramenta);
  if (!agente) throw new Error("Esta ferramenta ainda não tem um agente associado.");

  const rotulo = `${agente.codigo} · ${agente.nome}`;
  const resposta = await fetch("/api/agentes/executar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agente: {
        nome: rotulo,
        area: "Esteira de Anúncio ML",
        objetivo: agente.objetivo,
        quandoUsar: agente.quandoUsar,
        entradaNecessaria: agente.entradaNecessaria,
        saidaEsperada: agente.saidaEsperada,
        promptResumido: agente.promptSistema,
      },
      entrada: opcoes.produto ? `Produto a otimizar: ${opcoes.produto}` : "",
      contexto: opcoes.contexto ?? "",
    }),
  });

  if (resposta.status === 503) {
    return {
      markdown:
        "_A IA não está configurada no servidor — este é um resultado de exemplo. Configure a chave de IA para gerar de verdade._",
      tipo: "Simulada",
      agente: rotulo,
    };
  }

  const dados = (await resposta.json()) as { resultado_markdown?: string; erro?: string };
  if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível gerar. Tente novamente.");

  return { markdown: dados.resultado_markdown ?? "", tipo: "IA", agente: rotulo };
}
