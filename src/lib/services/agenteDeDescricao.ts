// Os agentes de DESCRIÇÃO e de PALAVRAS-CHAVE, no molde do de título.
//
// ===========================================================================
// A MESMA TRAVA CONTRA FABRICAÇÃO
// ===========================================================================
//
// O que vai na mensagem são FATOS DO CADASTRO. Material, garantia, tecnologia
// e origem NÃO estão aqui, e é por isso que o modelo não tem como afirmá-los.
//
// A trava importa mais na descrição do que no título: título curto raramente
// tem espaço para inventar; descrição longa é justamente onde a invenção cabe.
// E afirmação errada ao comprador é onde o Mercado Livre pune esta conta —
// 110 infrações DOMAIN, a mais recente de 03/08/2026.
//
// ===========================================================================
// QUEM JULGA O RESULTADO NÃO É ESTE ARQUIVO
// ===========================================================================
//
// Estes agentes GERAM. Vazio, igual ao atual, curto demais, lista cheia — tudo
// isso é decidido por `avaliarDescricaoProposta` e `avaliarPalavrasChave`, no
// domínio. Aqui só se devolve `null` quando não houve resposta: provedor
// ausente, agente ausente, chamada falhou.

import { agentePorFerramenta } from "../agentes/catalogo";
import { chamarIAEstruturada, provedorConfigurado } from "../agentes/provedorIA";
import {
  LIMITE_DE_DESCRICAO,
  MAXIMO_DE_PALAVRAS_CHAVE,
} from "../../modules/publication/domain/preparacaoDoAnuncio";

const SEM_INVENTAR =
  "Use SOMENTE os dados acima. Não afirme material, tecnologia, garantia, origem, " +
  "certificação nem qualquer característica que não esteja listada. Se um dado não " +
  "está acima, ele não existe para esta resposta.";

const ESQUEMA_DESCRICAO = {
  type: "object",
  properties: {
    descricao: {
      type: "string",
      description: `A descrição recomendada, com no máximo ${LIMITE_DE_DESCRICAO} caracteres.`,
    },
    justificativa: {
      type: "string",
      description: "Uma linha explicando por que esta descrição é melhor que a atual.",
    },
  },
  required: ["descricao", "justificativa"],
  additionalProperties: false,
} as const;

export interface EntradaDoTexto {
  nome: string;
  marca: string;
  modelo: string;
  /** O que existe hoje. Vazio quando o anúncio ainda não tem. */
  atual: string;
}

export async function gerarDescricaoOtimizada(
  e: EntradaDoTexto
): Promise<{ descricao: string; justificativa: string } | null> {
  if (!provedorConfigurado()) return null;
  const agente = agentePorFerramenta("descricao");
  if (!agente) return null;

  const dados = [
    `Produto: ${e.nome}`,
    e.marca ? `Marca: ${e.marca}` : "Marca: não informada",
    e.modelo ? `Modelo: ${e.modelo}` : "Modelo: não informado",
    e.atual ? `Descrição atual: ${e.atual}` : "Descrição atual: (vazia)",
    "",
    SEM_INVENTAR,
    "Responda com UMA descrição recomendada e uma linha de justificativa.",
  ].join("\n");

  try {
    const { json } = await chamarIAEstruturada({
      system: agente.promptSistema,
      mensagem: dados,
      schema: ESQUEMA_DESCRICAO,
      maxTokens: 1600,
    });
    const r = JSON.parse(json) as { descricao?: string; justificativa?: string };
    if (!r.descricao) return null;
    return { descricao: r.descricao, justificativa: r.justificativa ?? "" };
  } catch (err) {
    console.error("[copilot/descricao] falha ao gerar:", err);
    return null;
  }
}

const ESQUEMA_PALAVRAS = {
  type: "object",
  properties: {
    palavras: {
      type: "array",
      items: { type: "string" },
      description: `Termos de busca, no máximo ${MAXIMO_DE_PALAVRAS_CHAVE}.`,
    },
    justificativa: {
      type: "string",
      description: "Uma linha explicando o critério dos termos escolhidos.",
    },
  },
  required: ["palavras", "justificativa"],
  additionalProperties: false,
} as const;

export interface EntradaDasPalavras {
  nome: string;
  marca: string;
  modelo: string;
  /** As que o anúncio já tem — para o agente não repetir. */
  atuais: readonly string[];
}

export async function gerarPalavrasChave(
  e: EntradaDasPalavras
): Promise<{ palavras: string[]; justificativa: string } | null> {
  if (!provedorConfigurado()) return null;
  // O agente de SEO é quem sabe de busca. Reusar o de descrição aqui daria
  // termo bonito em vez de termo procurado.
  const agente = agentePorFerramenta("seo");
  if (!agente) return null;

  const dados = [
    `Produto: ${e.nome}`,
    e.marca ? `Marca: ${e.marca}` : "Marca: não informada",
    e.modelo ? `Modelo: ${e.modelo}` : "Modelo: não informado",
    e.atuais.length > 0
      ? `Palavras-chave que o anúncio já tem: ${e.atuais.join(", ")}`
      : "O anúncio ainda não tem palavras-chave.",
    "",
    SEM_INVENTAR,
    `Responda com no máximo ${MAXIMO_DE_PALAVRAS_CHAVE} termos de busca que ACRESCENTEM aos que já existem, e uma linha de justificativa.`,
  ].join("\n");

  try {
    const { json } = await chamarIAEstruturada({
      system: agente.promptSistema,
      mensagem: dados,
      schema: ESQUEMA_PALAVRAS,
      maxTokens: 600,
    });
    const r = JSON.parse(json) as { palavras?: string[]; justificativa?: string };
    if (!Array.isArray(r.palavras) || r.palavras.length === 0) return null;
    return { palavras: r.palavras, justificativa: r.justificativa ?? "" };
  } catch (err) {
    console.error("[copilot/seo] falha ao gerar:", err);
    return null;
  }
}
