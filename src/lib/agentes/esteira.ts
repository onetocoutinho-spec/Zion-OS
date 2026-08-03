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
import {
  gradePublicavel,
  pendenciasDaGrade,
  type VariacaoDoAnuncio,
} from "../../modules/publication/domain/variacoesDoAnuncio";

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

IDENTIDADE DO PRODUTO NÃO SE ESCREVE — SE LÊ:
Cor, tamanho, SKU, EAN e estoque são DADOS do cadastro, e a grade de variações é montada a partir dele depois da sua resposta. Você não a produz. Use os valores da GRADE REAL do briefing (quando houver) na tabela de medidas, na descrição e na ficha técnica, e NUNCA invente ou complete um número, uma cor ou um código que não esteja lá — nem para "ficar completo". Onde o dado não veio, escreva "⚠️ informação necessária: <o que falta>". Um SKU plausível e falso vira pedido que ninguém sabe despachar.

O QUE O MARKETPLACE EXIGE NÃO É COM VOCÊ:
Você NÃO decide quais atributos são obrigatórios. Essa lista é do Mercado Livre, varia por categoria, e a categoria só é escolhida na hora de publicar — depois desta resposta. Nunca escreva que um atributo é "obrigatório", e nunca reprove por falta de atributo de marketplace.

O que você observar de útil e que MELHORARIA o anúncio (uma foto que falta, uma medida ausente, um dado que enriqueceria a ficha) vai em "sugestoes". Sugestão é conselho para o lojista, não trava.

Preencha "notaDiagnostico" com a nota do A1 (0–100). Defina vereditoA10 = "aprovado" só se passar no checklist de QUALIDADE acima; senão "reprovado" com o motivo. Responda em português do Brasil.

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
          // `obrigatorio` NÃO está aqui — D5 do DES-001, e é o mesmo defeito de
          // `pendencias`: o modelo declarava o que o Mercado Livre exige. Ele
          // não sabe. A lista é do ML, varia por categoria, e a categoria só é
          // escolhida na publicação. A ficha continua listando os atributos;
          // quem é obrigatório se decide onde dá para saber.
        },
        required: ["atributo", "valor"],
        additionalProperties: false,
      },
    },
    tabelaMedidas: { type: "string", description: "Tabela de medidas em Markdown, ou string vazia se não se aplica." },
    comoMedir: { type: "string" },
    forma: { type: "string", enum: ["pequeno", "normal", "grande", "nao_aplicavel"] },
    // `variacoes` NÃO está aqui, e é o ponto do arquivo.
    //
    // Estava — com cor, tamanho, sku, ean, estoque e preco todos `required` — e
    // o que a esteira mandava para o modelo era o nome do produto e um dossiê
    // de texto. Campo obrigatório sem fonte tem uma saída só: ele preencheu.
    // Um babuche branco virou "Arco Iris" com SKU "22591.408-ARCOIRIS-19/20", e
    // um chinelo de três cores virou cinco variações pretas.
    //
    // A grade é montada do cadastro em `publication/domain/variacoesDoAnuncio`.
    // Não pedir é a única correção que funciona: pedir "não invente" a um campo
    // obrigatório sem fonte é pedir o impossível.
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
    // `pendencias` NÃO está aqui, pelo mesmo motivo de `variacoes` — D1 do
    // DES-001.
    //
    // Era `required`, e publicar exige `pendencias.length === 0`. Campo
    // obrigatório sem fonte tem uma saída só: ele preencheu. Medido em quatro
    // regerações reais de 2026-08-01 — 13 pendências, e conferidas contra
    // `GET /categories/{id}/attributes` do próprio ML, ZERO eram obrigatórias.
    // Três nem existiam como atributo da categoria ("Ano de lançamento",
    // "solado", "tipo de bico"), e "Ano de lançamento" apareceu em 4 de 4.
    // Enquanto isso, os 6 que o ML de fato exige — BRAND, MODEL, GENDER, COLOR,
    // SIZE, FOOTWEAR_TYPE — não foram citados uma vez.
    //
    // Uma pendência inventada trava a publicação PARA SEMPRE: não há tela onde
    // alguém resolva um dado que não existe.
    //
    // As pendências passam a ser compostas em `comAGradeDoCadastro`, a partir
    // do cadastro. Pedir "não invente" a um campo obrigatório sem fonte é pedir
    // o impossível — a única correção que funciona é não pedir.
    sugestoes: {
      type: "array",
      items: { type: "string" },
      description:
        "O que MELHORARIA o anúncio (foto que falta, medida ausente, dado que enriqueceria a ficha). Conselho, nunca trava.",
    },
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
    "imagensSugeridas",
    "faq",
    "sugestoes",
    "vereditoA10",
    "motivoVeredito",
  ],
  additionalProperties: false,
} as const;

// ---- Tipos ----

export interface AtributoFicha {
  atributo: string;
  valor: string;
  /** Sem `obrigatorio`: ver D5 do DES-001. Quem exige é o marketplace. */
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

/**
 * O que a IA devolve — TUDO menos a grade e as pendências.
 *
 * O tipo existe para que esquecer de compor uma das duas seja erro de
 * COMPILAÇÃO, e não um anúncio publicado com SKU inventado (grade) ou travado
 * para sempre por uma exigência que ninguém faz (pendências). `AnuncioGerado`
 * abaixo é o resultado final, depois de o domínio pôr as duas no lugar.
 */
export type AnuncioDaIA = Omit<AnuncioGerado, "variacoes" | "pendencias">;

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
  /** O que TRAVA a publicação. Composto pelo domínio, nunca pelo modelo. */
  pendencias: string[];
  /** O que MELHORARIA o anúncio. Do modelo, e não trava nada. */
  sugestoes: string[];
  vereditoA10: "aprovado" | "reprovado";
  motivoVeredito: string;
  /**
   * A IA avaliou este anúncio?
   *
   * `false` nos anúncios IMPORTADOS do marketplace: eles já estavam no ar
   * quando chegaram, e a esteira nunca os diagnosticou.
   *
   * Existe porque `nota_diagnostico` é `integer NOT NULL default 0` no banco,
   * então "não avaliado" e "avaliado e tirou zero" caíam no MESMO valor — e a
   * tela mostrava `0/100` em vermelho ao lado de "Veredito: aprovado", o que é
   * uma contradição na cara de quem lê. Observado em 03/08/2026 em 790 dos 880
   * anúncios da Chinelaria.
   *
   * Ausente nos registros antigos, e `undefined` NÃO significa avaliado — ver
   * `foiAvaliadoPelaIA`.
   */
  avaliadoPelaIA?: boolean;
  /**
   * O que ESTE anúncio custou em tokens, na palavra do provedor.
   *
   * `null`/ausente = não sabemos (provedor não informou, ou o anúncio veio da
   * importação e nunca passou pela IA). Nunca zero: contar desconhecido como
   * grátis faz a média de custo mentir para baixo.
   */
  uso?: {
    entrada: number;
    saida: number;
    total: number;
    modelo: string;
    provedor: string;
  } | null;
}

/**
 * Junta o texto da IA com a grade do CADASTRO — e deixa o veredito honesto.
 *
 * Mora aqui, e não em cada serviço, porque são QUATRO caminhos que rodam a
 * esteira (cadeia multi-agente, passada única, lote e worker). Um deles sem a
 * montagem publicaria SKU inventado, e seria o mais silencioso dos quatro.
 *
 * A trava não é opinião do modelo: grade incompleta reprova, por melhor que
 * esteja o texto. E era justamente o texto bom que fazia o problema passar —
 * descrição impecável, FAQ caprichada, SKU falso no meio.
 *
 * DESDE O DES-001 as pendências vêm SÓ daqui. Antes, as do modelo eram
 * concatenadas às da grade — e como publicar exige `pendencias.length === 0`,
 * qualquer coisa que ele escrevesse virava trava permanente. Ele escrevia
 * "Ano de lançamento", que não existe na categoria. Agora o que ele observa
 * vive em `sugestoes` e não bloqueia nada.
 */
export function comAGradeDoCadastro(
  daIA: AnuncioDaIA,
  grade: VariacaoDoAnuncio[]
): AnuncioGerado {
  const daGrade = pendenciasDaGrade(grade);
  const publicavel = gradePublicavel(grade);
  return {
    ...daIA,
    variacoes: grade,
    pendencias: daGrade,
    vereditoA10: publicavel ? daIA.vereditoA10 : "reprovado",
    motivoVeredito: publicavel
      ? daIA.motivoVeredito
      : [daIA.motivoVeredito, `Grade de variações incompleta: ${daGrade.join(" ")}`]
          .filter(Boolean)
          .join(" "),
  };
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
      { atributo: "Marca", valor: "⚠️ informação necessária" },
      { atributo: "Cor principal", valor: "⚠️ informação necessária" },
    ],
    tabelaMedidas: "",
    comoMedir: "",
    forma: "nao_aplicavel",
    variacoes: [],
    imagensSugeridas: [
      { tipo: "capa", prompt: "[SIMULAÇÃO] Prompt de capa 1:1 com o produto em destaque." },
    ],
    faq: [{ pergunta: "Qual o prazo de envio?", resposta: "[SIMULAÇÃO] Exemplo de resposta." }],
    // Pendência de GRADE — é o que o domínio produziria com a grade vazia
    // acima. Uma simulação que devolvesse pendências de outro tipo ensinaria
    // uma forma que não existe mais.
    pendencias: [
      "⚠️ informação necessária: grade de variações do produto (cor, tamanho, SKU, EAN e estoque de cada uma).",
    ],
    sugestoes: ["Configure a ANTHROPIC_API_KEY para rodar a esteira de verdade."],
    vereditoA10: "reprovado",
    motivoVeredito: "Execução simulada — faltam dados reais e a chave da API. Nada foi publicado.",
  };
}
