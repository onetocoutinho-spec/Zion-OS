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

/**
 * O único jeito de sair daqui sem resposta — e ele SEMPRE diz por quê.
 *
 * ===========================================================================
 * Medido em 11/08/2026, investigando o incidente de 01:57
 * ===========================================================================
 *
 * A lojista leu "a ferramenta não conseguiu montar o comparativo — deu erro
 * sem detalhar o motivo". A frase era honesta: quatro causas diferentes
 * (provedor ausente, agente ausente, JSON sem o campo, exceção) devolviam o
 * MESMO `null`, e três delas não deixavam registro nenhum. Descobrir qual
 * tinha sido exigiu datar a mensagem no banco e cruzar com o log do git.
 *
 * Com a causa escrita, a mesma investigação leva o tempo de abrir o log. O
 * comportamento não muda — quem julga vazio continua sendo o domínio.
 */
function semResposta(causa: string, detalhe?: unknown): null {
  console.error(`[copilot/texto] sem resposta: ${causa}`, detalhe ?? "");
  return null;
}

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
  if (!provedorConfigurado()) return semResposta("provedor de IA não configurado");
  const agente = agentePorFerramenta("descricao");
  if (!agente) return semResposta('agente "descricao" ausente do catálogo');

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
      // ===================================================================
      // O TETO É DO TAMANHO DA COISA GERADA, NÃO UM NÚMERO REDONDO
      // ===================================================================
      //
      // Estava 1.600, copiado do agente de TÍTULO — onde 400 sobra porque um
      // título tem 60 caracteres. Descrição não é título.
      //
      // Medido em produção em 10/08/2026: o JSON voltou cortado no meio de uma
      // string, `JSON.parse` estourou, o `catch` devolveu `null`, e a lojista
      // leu "não consegui gerar uma descrição agora" — uma frase honesta sobre
      // um defeito que não tinha nada de temporário.
      //
      // As descrições reais desta base têm 1.600 a 1.900 caracteres. Com
      // acentuação, envelope JSON e a justificativa, 8.000 dá folga de sobra
      // sem chegar perto do limite de 50.000 do ML.
      maxTokens: 8000,
    });
    const r = JSON.parse(json) as { descricao?: string; justificativa?: string };
    if (!r.descricao) {
      return semResposta("JSON válido, mas sem o campo `descricao`", json.slice(0, 200));
    }
    return { descricao: r.descricao, justificativa: r.justificativa ?? "" };
  } catch (err) {
    // O CASO DE 10/08: `JSON.parse` estourando num JSON cortado pelo teto de
    // saída. Sem a mensagem do erro aqui, o corte é indistinguível de uma
    // queda de rede.
    return semResposta("a chamada ao agente de descrição falhou", err);
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
  if (!provedorConfigurado()) return semResposta("provedor de IA não configurado");
  // O agente de SEO é quem sabe de busca. Reusar o de descrição aqui daria
  // termo bonito em vez de termo procurado.
  const agente = agentePorFerramenta("seo");
  if (!agente) return semResposta('agente "seo" ausente do catálogo');

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
    if (!Array.isArray(r.palavras) || r.palavras.length === 0) {
      return semResposta("JSON válido, mas `palavras` veio vazio", json.slice(0, 200));
    }
    return { palavras: r.palavras, justificativa: r.justificativa ?? "" };
  } catch (err) {
    return semResposta("a chamada ao agente de SEO falhou", err);
  }
}
