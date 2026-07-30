// "Melhore o título" — SERVIDOR APENAS.
//
// ⚠️ Usa a chave de IA. Nunca no navegador.
//
// NÃO EXISTE UM SEGUNDO MOTOR DE TÍTULO AQUI.
//
// O prompt é o do agente A3 do catálogo (`agentes/catalogo`), o mesmo que a
// tela de Agentes IA usa há tempo. O que este arquivo acrescenta é um chamador:
// o Copilot precisa de UM título e de uma justificativa curta, e a entrega
// original do A3 é markdown com três opções — formato bom para uma pessoa ler
// numa tela, ruim para virar uma Proposal com um valor só.
//
// Escrever um prompt novo aqui produziria dois títulos diferentes para o mesmo
// produto dependendo de onde ele foi pedido, e ninguém saberia qual é o certo.

import { agentePorFerramenta } from "../agentes/catalogo";
import { chamarIAEstruturada, provedorConfigurado } from "../agentes/provedorIA";
import { LIMITE_DE_TITULO } from "../../modules/publication/domain/preparacaoDoAnuncio";

const ESQUEMA_TITULO = {
  type: "object",
  properties: {
    titulo: {
      type: "string",
      description: `O título recomendado, com no máximo ${LIMITE_DE_TITULO} caracteres.`,
    },
    justificativa: {
      type: "string",
      description: "Uma linha explicando por que este título é melhor que o atual.",
    },
  },
  required: ["titulo", "justificativa"],
  additionalProperties: false,
} as const;

export interface EntradaDoTitulo {
  nome: string;
  marca: string;
  modelo: string;
  tituloAtual: string;
}

/**
 * Roda o A3 e devolve UM título com a justificativa.
 *
 * `null` quando não há provedor configurado ou quando a chamada falha — e aí a
 * ferramenta recusa em vez de propor um título inventado por outro caminho.
 *
 * O que vai na mensagem são FATOS DO CADASTRO: nome, marca, modelo e o título
 * de hoje. Nada além — material, garantia e tecnologia não estão aqui, e é por
 * isso que o modelo não tem como afirmá-los.
 */
export async function gerarTituloOtimizado(
  e: EntradaDoTitulo
): Promise<{ titulo: string; justificativa: string } | null> {
  if (!provedorConfigurado()) return null;
  const agente = agentePorFerramenta("titulo");
  if (!agente) return null;

  const dados = [
    `Produto: ${e.nome}`,
    e.marca ? `Marca: ${e.marca}` : "Marca: não informada",
    e.modelo ? `Modelo: ${e.modelo}` : "Modelo: não informado",
    e.tituloAtual ? `Título atual: ${e.tituloAtual}` : "Título atual: (vazio)",
    "",
    // A trava contra fabricação, repetida junto dos dados porque é aqui que ela
    // vale: o que não está acima não existe para esta chamada.
    "Use SOMENTE os dados acima. Não afirme material, tecnologia, garantia, origem nem qualquer característica que não esteja listada.",
    `Responda com UM título recomendado (máximo ${LIMITE_DE_TITULO} caracteres) e uma linha de justificativa.`,
  ].join("\n");

  try {
    const { json } = await chamarIAEstruturada({
      system: agente.promptSistema,
      mensagem: dados,
      schema: ESQUEMA_TITULO,
      maxTokens: 400,
    });
    const r = JSON.parse(json) as { titulo?: string; justificativa?: string };
    if (!r.titulo) return null;
    return { titulo: r.titulo, justificativa: r.justificativa ?? "" };
  } catch (err) {
    // A causa vai para o log. Para quem digitou, "não consegui agora" é o que
    // há de acionável — e a ferramenta já diz isso.
    console.error("[copilot/titulo] falha ao gerar:", err);
    return null;
  }
}
