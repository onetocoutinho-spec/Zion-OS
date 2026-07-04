// Motor da Esteira de Anúncio ML (Fase 1).
//
// Compõe os agentes A1→A2→A9→A4(A3,A5,A6,A7,A8,A12)→A10 em UMA passada, como o
// skill `esteira-anuncio-ml`. Módulo puro (tipos + prompt + schema), importável
// tanto pela rota do servidor quanto pelo cliente. A chamada ao Claude fica só
// na rota /api/agentes/esteira.

// ---- Regras-mãe da Zion (valem para todos os agentes) ----

export const REGRAS_MAE = `Regras-mãe da Zion Company (valem para TODAS as etapas):
- NUNCA inventar dado de produto. Quando faltar, registrar exatamente "⚠️ informação necessária: <campo>" e listar em "pendencias".
- Respeitar a CATEGORIA do produto e seus atributos obrigatórios.
- Título ML: no MÁXIMO 60 caracteres, com a keyword principal na frente, SEM cor nem tamanho (isso é variação/atributo).
- Atributos/ficha técnica são os FILTROS de busca do ML — preencher o máximo possível.
- Margem mínima 5%. Modelo Zion: margem = preço − custo − preço×0,30 − 1,15 − frete (frete leve R$14,15 / pesado R$21,65 só se preço ≥ R$79). Nunca liberar preço abaixo do piso de 5%.
- Defaults Zion (usar automático quando aplicável): garantia = 90 dias (fornecedor); conteúdo da embalagem = 1 par (calçado); frete grátis embutido no preço.
- O anúncio só está pronto se o cliente COMPRA sem precisar perguntar nada.`;

// ---- Etapas internas da esteira (uma passada) ----

const ETAPAS = `Você é a ESTEIRA DE ANÚNCIO da Zion Company. A partir do briefing do produto,
produza um anúncio de Mercado Livre COMPLETO e pronto para competir, rodando internamente estas
etapas (nesta ordem) e entregando só o resultado final estruturado:

1) DIAGNÓSTICO (A1): avalie o estado atual e dê uma nota de 0 a 100 (campo notaDiagnostico).
2) SEO (A2): defina a keyword principal (vai na frente do título) e as secundárias (para descrição/atributos).
3) BENCHMARK (A9): se houver links/dados de concorrentes, use-os; senão, trabalhe com o padrão da categoria e marque pendência.
4) CONSTRUÇÃO (A4 orquestrando):
   - A3 Título: ≤60 caracteres, keyword na frente, sem cor/tamanho.
   - A5 Descrição: completa (benefícios → diferenciais → material/uso → cuidados → envio/garantia → o que vem na caixa → orientação) e uma versão curta.
   - A6 Ficha/Atributos: mapeie cada dado no atributo correto da categoria; marque os obrigatórios que faltam.
   - A7 Tabela de Medidas: se o produto tem numeração/tamanho, monte a tabela + "como medir" + forma (pequeno/normal/grande).
   - A8 Variações/SKU: organize cor/tamanho/SKU/EAN/estoque/preço; todas as derivações no MESMO anúncio; valide margem ≥5%.
   - A12 Imagens: gere PROMPTS de imagem (capa 1:1, detalhe, medidas, humanizada, benefícios) preservando fidelidade ao produto.
5) REVISÃO FINAL (A10 — trava): rode o checklist de qualidade e decida vereditoA10 = "aprovado" ou "reprovado".
   Reprove se: título >60 ou com cor/tamanho; atributos obrigatórios faltando; preço abaixo do piso 5%; pendências bloqueantes.

Consolide TODAS as "⚠️ informação necessária" em "pendencias". Responda em português do Brasil.`;

export function montarSystemPromptEsteira(): string {
  return `${ETAPAS}\n\n${REGRAS_MAE}`;
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
