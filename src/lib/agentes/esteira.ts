// Motor da Esteira de Anúncio ML (Fase 1).
//
// Compõe os agentes A1→A2→A9→A4(A3,A5,A6,A7,A8,A12)→A10 em UMA passada, como o
// skill `esteira-anuncio-ml`. Módulo puro (tipos + prompt + schema), importável
// tanto pela rota do servidor quanto pelo cliente. A chamada ao Claude fica só
// na rota /api/agentes/esteira.
//
// Os prompts vêm do CATÁLOGO (fonte única dos prompts reais A0–A12). Aqui só
// compomos a "passada única": cada agente vira uma etapa interna descrita pelo
// seu objetivo real, e a saída é o anúncio estruturado (ESQUEMA_ANUNCIO).

import {
  REGRAS_MAE as REGRAS_MAE_CATALOGO,
  CHECKLIST_QUALIDADE,
  agentesDaEsteira,
} from "./catalogo";

// Re-exporta as regras-mãe do catálogo (compatibilidade com quem importa daqui).
export const REGRAS_MAE = REGRAS_MAE_CATALOGO;

export function montarSystemPromptEsteira(): string {
  const etapas = agentesDaEsteira()
    .map((a) => `${a.codigo} · ${a.nome} — ${a.objetivo}`)
    .join("\n");
  const checklist = CHECKLIST_QUALIDADE.map((c) => `- ${c}`).join("\n");

  return `Você é a ESTEIRA DE ANÚNCIO da Zion Company. A partir do briefing do produto, produza um anúncio de Mercado Livre COMPLETO e pronto para competir, rodando INTERNAMENTE (numa única passada, sem expor etapas intermediárias) a linha de produção dos agentes abaixo, na ordem, usando a saída de um como entrada do próximo. Entregue só o resultado final estruturado.

LINHA DE PRODUÇÃO (agentes internos):
${etapas}

CHECKLIST DE QUALIDADE (o A10 é a trava — só aprove com tudo ✅):
${checklist}

Preencha "notaDiagnostico" com a nota do A1 (0–100). Consolide TODAS as "⚠️ informação necessária" em "pendencias". Defina vereditoA10 = "aprovado" só se passar no checklist; senão "reprovado" com o motivo. Responda em português do Brasil.

${REGRAS_MAE}`;
}

// ---- Schema de saída (o anúncio pronto) ----

export const ESQUEMA_ANUNCIO = {
  type: "object",
  properties: {
    notaDiagnostico: { type: "number", description: "Nota do estado atual do anúncio, de 0 a 100 (A1)." },
    tituloOtimizado: { type: "string", description: "Título final, máximo 60 caracteres, keyword na frente, sem cor/tamanho." },
    palavrasChavePrincipais: { type: "array", items: { type: "string" } },
    palavrasChaveSecundarias: { type: "array", items: { type: "string" } },
    descricaoCompleta: { type: "string" },
    descricaoCurta: { type: "string" },
    fichaTecnica: {
      type: "array",
      items: {
        type: "object",
        properties: {
          atributo: { type: "string" },
          valor: { type: "string" },
          obrigatorio: { type: "boolean" },
        },
        required: ["atributo", "valor", "obrigatorio"],
        additionalProperties: false,
      },
    },
    tabelaMedidas: { type: "string", description: "Tabela de medidas em Markdown, ou string vazia se não se aplica." },
    comoMedir: { type: "string" },
    forma: { type: "string", enum: ["pequeno", "normal", "grande", "nao_aplicavel"] },
    variacoes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          cor: { type: "string" },
          tamanho: { type: "string" },
          sku: { type: "string" },
          ean: { type: "string" },
          estoque: { type: "string" },
          preco: { type: "string" },
          obs: { type: "string" },
        },
        required: ["cor", "tamanho", "sku", "ean", "estoque", "preco", "obs"],
        additionalProperties: false,
      },
    },
    imagensSugeridas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tipo: { type: "string", description: "capa | secundaria | detalhe | medidas | humanizada | beneficios" },
          prompt: { type: "string" },
        },
        required: ["tipo", "prompt"],
        additionalProperties: false,
      },
    },
    faq: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pergunta: { type: "string" },
          resposta: { type: "string" },
        },
        required: ["pergunta", "resposta"],
        additionalProperties: false,
      },
    },
    pendencias: { type: "array", items: { type: "string" }, description: "Lista de '⚠️ informação necessária'." },
    vereditoA10: { type: "string", enum: ["aprovado", "reprovado"] },
    motivoVeredito: { type: "string" },
  },
  required: [
    "notaDiagnostico",
    "tituloOtimizado",
    "palavrasChavePrincipais",
    "palavrasChaveSecundarias",
    "descricaoCompleta",
    "descricaoCurta",
    "fichaTecnica",
    "tabelaMedidas",
    "comoMedir",
    "forma",
    "variacoes",
    "imagensSugeridas",
    "faq",
    "pendencias",
    "vereditoA10",
    "motivoVeredito",
  ],
  additionalProperties: false,
} as const;

// ---- Tipos ----

export interface AtributoFicha {
  atributo: string;
  valor: string;
  obrigatorio: boolean;
}
export interface VariacaoAnuncio {
  cor: string;
  tamanho: string;
  sku: string;
  ean: string;
  estoque: string;
  preco: string;
  obs: string;
}
export interface ImagemSugerida {
  tipo: string;
  prompt: string;
}
export interface PerguntaFaq {
  pergunta: string;
  resposta: string;
}

export interface AnuncioGerado {
  notaDiagnostico: number;
  tituloOtimizado: string;
  palavrasChavePrincipais: string[];
  palavrasChaveSecundarias: string[];
  descricaoCompleta: string;
  descricaoCurta: string;
  fichaTecnica: AtributoFicha[];
  tabelaMedidas: string;
  comoMedir: string;
  forma: "pequeno" | "normal" | "grande" | "nao_aplicavel";
  variacoes: VariacaoAnuncio[];
  imagensSugeridas: ImagemSugerida[];
  faq: PerguntaFaq[];
  pendencias: string[];
  vereditoA10: "aprovado" | "reprovado";
  motivoVeredito: string;
}

/** Resultado simulado (fallback sem ANTHROPIC_API_KEY) — demonstra a tela. */
export function anuncioSimulado(nomeProduto: string): AnuncioGerado {
  const nome = nomeProduto || "Produto";
  return {
    notaDiagnostico: 58,
    tituloOtimizado: `[SIMULAÇÃO] ${nome} Premium Conforto`.slice(0, 60),
    palavrasChavePrincipais: ["[simulação] palavra-chave principal"],
    palavrasChaveSecundarias: ["conforto", "qualidade", "envio rápido"],
    descricaoCompleta:
      "[SIMULAÇÃO] Descrição completa gerada pela esteira. Configure a ANTHROPIC_API_KEY no servidor para a geração real com os prompts A1–A12.",
    descricaoCurta: "[SIMULAÇÃO] Descrição curta de exemplo.",
    fichaTecnica: [
      { atributo: "Marca", valor: "⚠️ informação necessária", obrigatorio: true },
      { atributo: "Cor principal", valor: "⚠️ informação necessária", obrigatorio: true },
    ],
    tabelaMedidas: "",
    comoMedir: "",
    forma: "nao_aplicavel",
    variacoes: [],
    imagensSugeridas: [
      { tipo: "capa", prompt: "[SIMULAÇÃO] Prompt de capa 1:1 com o produto em destaque." },
    ],
    faq: [{ pergunta: "Qual o prazo de envio?", resposta: "[SIMULAÇÃO] Exemplo de resposta." }],
    pendencias: [
      "⚠️ informação necessária: dados reais do produto (custo, material, grade)",
      "Configure a ANTHROPIC_API_KEY para rodar a esteira de verdade",
    ],
    vereditoA10: "reprovado",
    motivoVeredito: "Execução simulada — faltam dados reais e a chave da API. Nada foi publicado.",
  };
}
