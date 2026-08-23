// O BRIEFING de uma imagem — o que se pede ao provedor, e como o feedback
// humano entra na versão seguinte.
//
// Era um prompt fixo por botão ("melhorar" / "infográfico"). Agora cada
// geração parte de um briefing: o slot (capa, infográfico, detalhe…), a
// instrução da pessoa e o FEEDBACK acumulado das versões anteriores da
// mesma linhagem — "fundo branco", "produto maior" — que vira ordem na
// próxima. Rejeitar deixa de ser perder. (Auditoria do Copilot, trilha 5.)
//
// Puro. A fidelidade continua sendo a regra: NUNCA se inventa o produto — a
// imagem parte da foto real (ou da versão anterior, que partiu dela).

import type { PerfilDeConteudo } from "./perfilDeConteudo";

export type SlotDeImagem = "capa" | "infografico" | "detalhe" | "medidas" | "humanizada" | "beneficios";
export const SLOTS: readonly SlotDeImagem[] = ["capa", "infografico", "detalhe", "medidas", "humanizada", "beneficios"];

export interface BriefingDeImagem {
  versao: 1;
  slot: SlotDeImagem;
  produtoNome: string;
  /** O que a pessoa pediu nesta versão. */
  instrucao: string;
  /** O feedback das versões anteriores, do mais antigo ao mais novo. */
  feedback: string[];
  /** De onde parte a imagem: a foto real do produto ou uma versão anterior. */
  fonte: { tipo: "foto"; imagemId: string } | { tipo: "versao"; versaoId: string };
  beneficios?: string;
}

const MAXIMO_DA_INSTRUCAO = 400;
const MAXIMO_DE_FEEDBACK = 6;

export function lerSlot(bruto: unknown): SlotDeImagem | null {
  return SLOTS.includes(bruto as SlotDeImagem) ? (bruto as SlotDeImagem) : null;
}

export function montarBriefing(b: {
  slot: SlotDeImagem;
  produtoNome: string;
  instrucao?: string | null;
  feedbackAnterior?: readonly string[];
  feedbackNovo?: string | null;
  fonte: BriefingDeImagem["fonte"];
  beneficios?: string | null;
}): BriefingDeImagem {
  const feedback = [...(b.feedbackAnterior ?? []), ...(b.feedbackNovo?.trim() ? [b.feedbackNovo.trim().slice(0, MAXIMO_DA_INSTRUCAO)] : [])]
    .filter(Boolean)
    .slice(-MAXIMO_DE_FEEDBACK);
  return {
    versao: 1,
    slot: b.slot,
    produtoNome: b.produtoNome.slice(0, 200),
    instrucao: (b.instrucao ?? "").trim().slice(0, MAXIMO_DA_INSTRUCAO),
    feedback,
    fonte: b.fonte,
    ...(b.beneficios?.trim() ? { beneficios: b.beneficios.trim().slice(0, 600) } : {}),
  };
}

export function lerBriefing(bruto: unknown): BriefingDeImagem | null {
  const b = bruto as Partial<BriefingDeImagem> | null;
  if (!b || b.versao !== 1) return null;
  const slot = lerSlot(b.slot);
  if (!slot || typeof b.produtoNome !== "string") return null;
  const fonte = b.fonte as BriefingDeImagem["fonte"] | undefined;
  if (!fonte || (fonte.tipo !== "foto" && fonte.tipo !== "versao")) return null;
  if (fonte.tipo === "foto" && typeof fonte.imagemId !== "string") return null;
  if (fonte.tipo === "versao" && typeof fonte.versaoId !== "string") return null;
  return montarBriefing({
    slot,
    produtoNome: b.produtoNome,
    instrucao: typeof b.instrucao === "string" ? b.instrucao : "",
    feedbackAnterior: Array.isArray(b.feedback) ? b.feedback.filter((x): x is string => typeof x === "string") : [],
    fonte,
    beneficios: typeof b.beneficios === "string" ? b.beneficios : null,
  });
}

const BASE: Record<SlotDeImagem, string> = {
  capa: "gere a imagem de CAPA para Mercado Livre: fundo BRANCO liso e uniforme, produto centralizado preenchendo ~85% do quadro em proporção 1:1, iluminação de estúdio suave com sombra sutil. Sem texto, logotipos, selos ou marca d'água.",
  infografico: "crie uma imagem QUADRADA (1:1) de e-commerce com um infográfico limpo destacando os benefícios, ícones simples e texto curto em PORTUGUÊS do Brasil. Fundo claro, legível no celular. Não invente característica que o produto não tem; sem selos ou promoções enganosas.",
  detalhe: "gere uma imagem QUADRADA (1:1) em close de um detalhe real do produto (textura, acabamento, solado), fundo neutro, foco nítido. Sem texto.",
  medidas: "gere uma imagem QUADRADA (1:1) do produto com linhas de cota indicando onde se mede (comprimento, largura, altura), sem escrever NÚMEROS — os números vêm da tabela de medidas. Fundo branco.",
  humanizada: "gere uma imagem QUADRADA (1:1) do produto em uso, em cena cotidiana realista, luz natural, sem rosto em destaque. O produto continua 100% fiel.",
  beneficios: "gere uma imagem QUADRADA (1:1) do produto com até três benefícios em texto curto, em PORTUGUÊS do Brasil, só os informados. Fundo claro.",
};

/**
 * O prompt, a partir do briefing. A ordem é a do peso: a regra de fidelidade
 * primeiro, o slot, a instrução desta versão, e o FEEDBACK acumulado como
 * ordens — "a versão anterior foi recusada por X; desta vez, X resolvido".
 */
export function promptDoBriefing(b: BriefingDeImagem, perfil: PerfilDeConteudo | null = null): string {
  const linhas = [
    `A partir da ${b.fonte.tipo === "versao" ? "IMAGEM ANTERIOR" : "FOTO REAL"} do produto "${b.produtoNome}" em anexo, ${BASE[b.slot]}`,
    "Mantenha o produto 100% FIEL: não altere cor, forma, material nem detalhes reais.",
  ];
  if (b.slot === "infografico" || b.slot === "beneficios") {
    linhas.push(`Benefícios a destacar (só estes): ${b.beneficios || "conforto, qualidade e bom custo-benefício"}`);
  }
  if (b.instrucao) linhas.push(`PEDIDO DESTA VERSÃO: ${b.instrucao}`);
  if (b.feedback.length > 0) {
    linhas.push("AS VERSÕES ANTERIORES FORAM RECUSADAS. O que a pessoa disse, em ordem — resolva TODOS os pontos nesta:");
    b.feedback.forEach((f, i) => linhas.push(`${i + 1}. ${f}`));
    linhas.push("Preserve o que ela NÃO reclamou.");
  }
  if (perfil?.publico) linhas.push(`Público da loja: ${perfil.publico}`);
  if (perfil?.palavrasProibidas.length) linhas.push(`Nunca escreva na imagem: ${perfil.palavrasProibidas.join(", ")}.`);
  return linhas.join("\n");
}

export function rotuloDoSlot(slot: SlotDeImagem): string {
  return { capa: "capa", infografico: "infográfico", detalhe: "foto de detalhe", medidas: "imagem de medidas", humanizada: "foto em uso", beneficios: "imagem de benefícios" }[slot];
}
