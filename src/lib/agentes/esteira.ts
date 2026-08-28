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
  // `gradePublicavel` saiu daqui em 27/08/2026: ela é, por definição,
  // `pendenciasDaGrade(...).length === 0`, e o veredito passou a olhar a lista
  // de pendências inteira — que inclui a foto, que a grade não conhece.
  pendenciasDaGrade,
  sugestoesDaGrade,
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

CHECKLIST DE QUALIDADE (use para ESCREVER — ele não é veredito seu):
${checklist}

IDENTIDADE DO PRODUTO NÃO SE ESCREVE — SE LÊ:
Cor, tamanho, SKU, EAN e estoque são DADOS do cadastro, e a grade de variações é montada a partir dele depois da sua resposta. Você não a produz. Use os valores da GRADE REAL do briefing (quando houver) na tabela de medidas, na descrição e na ficha técnica, e NUNCA invente ou complete um número, uma cor ou um código que não esteja lá — nem para "ficar completo". Onde o dado não veio, escreva "⚠️ informação necessária: <o que falta>". Um SKU plausível e falso vira pedido que ninguém sabe despachar.

O QUE O MARKETPLACE EXIGE NÃO É COM VOCÊ:
Você NÃO decide quais atributos são obrigatórios. Essa lista é do Mercado Livre, varia por categoria, e a categoria só é escolhida na hora de publicar — depois desta resposta. Nunca escreva que um atributo é "obrigatório", e nunca reprove por falta de atributo de marketplace.

O que você observar de útil e que MELHORARIA o anúncio (uma foto que falta, uma medida ausente, um dado que enriqueceria a ficha) vai em "sugestoes". Sugestão é conselho para o lojista, não trava.

Preencha "notaDiagnostico" com a nota do A1 (0–100) — ela é informação para quem lê, não decisão. VOCÊ NÃO APROVA NEM REPROVA o anúncio: o que impede publicar é verificado no cadastro, sobre dado real, depois desta resposta. Use o checklist para ESCREVER bem, não para julgar. Responda em português do Brasil.

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
    // `vereditoA10` e `motivoVeredito` NÃO estão aqui — 27/08/2026, e é a
    // terceira vez que este arquivo aprende a mesma lição.
    //
    // `variacoes` saiu porque o modelo inventava SKU. `pendencias` saiu porque
    // ele inventava obrigatoriedade. O veredito ficou — e virou o novo lugar
    // por onde o bloqueio passava.
    //
    // MEDIDO sobre 411 anúncios do catálogo real: 307 reprovados, 299 deles
    // (97%) com ZERO pendências. A lojista lia "reprovado" e não havia uma linha
    // do que corrigir, porque publicar exige veredito aprovado E lista vazia.
    //
    // E a opinião não é estável. O MESMO produto, cinco execuções idênticas no
    // mesmo dia: notas 34, 42, 45, 48, 48 — e um "reprovado" entre quatro
    // "aprovados". Uma trava permanente sobre o produto do lojista não pode ser
    // um número que oscila 14 pontos entre chamadas.
    //
    // O veredito agora é DERIVADO das pendências, em `comAGradeDoCadastro`:
    // lista vazia aprova, lista cheia reprova, e o motivo é a própria lista. Um
    // veredito que não pode discordar do que está escrito na tela.
    //
    // A leitura editorial do modelo não se perdeu: ela já vai em `sugestoes`, e
    // sugestão não bloqueia. `notaDiagnostico` continua, como informação.
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
export type AnuncioDaIA = Omit<
  AnuncioGerado,
  "variacoes" | "pendencias" | "vereditoA10" | "motivoVeredito"
>;

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
/**
 * Os NOMES dos campos que faltam, a partir das pendências.
 *
 * As pendências têm a forma "⚠️ informação necessária: <campo> — <explicação>",
 * e é o `<campo>` que serve de rótulo. Quando o formato não bate — porque
 * alguém escreveu uma pendência de outro jeito —, a frase inteira entra: perder
 * a informação seria pior que uma frase comprida.
 *
 * O TRAVESSÃO NÃO É O ÚNICO CORTE, e a pendência mais comum é justamente a que
 * não o usa: a da grade vem de `variacoesDoAnuncio.ts`, que escreve "grade de
 * variações do produto (cor, tamanho, SKU, EAN e estoque de cada uma)". Com só
 * o travessão, a frase inteira virava "nome do campo" e ainda ganhava um ponto
 * final duplicado — o texto antigo com um erro de pontuação novo. Parêntese e
 * dois-pontos cortam pelo mesmo motivo que o travessão: dali para a frente é
 * explicação, e quem lê o veredito numa listagem quer a lista dos campos.
 *
 * A pontuação final sai depois do corte porque o pedaço cortado pode terminar
 * em ponto, e o rótulo recebe o seu no fim.
 */
function camposQueFaltam(pendencias: readonly string[]): string {
  const campos = pendencias.map((p) => {
    const semMarca = p.replace(/^⚠️\s*informação necessária:\s*/i, "");
    const ateOCorte = semMarca.split(/[—(:]/)[0].trim().replace(/[.,;]+$/, "");
    return ateOCorte || p;
  });
  const unicos = [...new Set(campos)];
  return unicos.length === 1
    ? `Falta: ${unicos[0]}.`
    : `Faltam ${unicos.length}: ${unicos.join(", ")}.`;
}

export function comAGradeDoCadastro(
  daIA: AnuncioDaIA,
  grade: VariacaoDoAnuncio[],
  /**
   * Quantas fotos o produto tem no cadastro — ou `null` quando NÃO HÁ PRODUTO.
   *
   * OBRIGATÓRIO DE PROPÓSITO, e não opcional com padrão. Três vezes seguidas,
   * neste mesmo fluxo, um caminho recebeu menos contexto que o outro sem que
   * nada quebrasse: o briefing de atributos, o rastro de custo e a contagem de
   * fotos, todos passados por `/cliente/anunciar` e esquecidos pelo worker.
   * Parâmetro obrigatório transforma esquecer em erro de compilação — é o mesmo
   * motivo pelo qual `pendencias` saiu de `AnuncioDaIA`.
   *
   * `null` E `0` SÃO COISAS DIFERENTES, e tratá-los igual foi um defeito.
   *
   * `0` é "este produto não tem foto" — pendência, e das que travam. `null` é
   * "não há produto a que anexar foto": é a tela `/esteira` da equipe, onde se
   * roda um briefing digitado para experimentar o prompt, sem produto nenhum
   * selecionado.
   *
   * Com os dois valendo 0, TODA execução daquela tela voltava reprovada com
   * "este produto não tem nenhuma imagem cadastrada" — sobre um produto que não
   * existe. Um sinal que aparece em 100% das vezes deixa de ser sinal.
   *
   * É a mesma distinção que este repositório paga caro para manter em
   * `largura`/`altura` ("não medimos" não é "não tem") e em `margem`. Aqui ela
   * estava colapsada no tipo, e o tipo é onde ela tinha que aparecer.
   */
  fotosDoProduto: number | null
): AnuncioGerado {
  const daGrade = pendenciasDaGrade(grade);
  // `null` não é "sem foto": é "sem produto". Ver o parâmetro.
  const semFoto = fotosDoProduto !== null && fotosDoProduto <= 0;
  // A FOTO É TRAVA, E A PROVA DISSO JÁ ESTAVA NO REPOSITÓRIO.
  //
  // `api/ml/remover-foto` recusa apagar a última imagem de um anúncio, com a
  // razão escrita: "anúncio sem foto o Mercado Livre não aceita". A mesma
  // verdade nunca tinha chegado à criação — o sistema protegia a última foto de
  // um anúncio no ar e aprovava um anúncio que nunca teve nenhuma.
  //
  // MEDIDO em 27/08/2026: dos 102 anúncios aprovados com zero pendências, 96
  // não tinham foto alguma. "Pronto para publicar" era falso em 94% dos casos,
  // e o lojista só descobriria no erro do ML.
  //
  // Ela entra como PENDÊNCIA, não como veredito: pendência é lista, tem texto,
  // diz o que fazer e some quando resolvida. Foi por não ser assim que 244
  // anúncios foram reprovados por foto sem uma linha do que corrigir — pelo
  // modelo, que nem imagem recebe.
  const pendencias = semFoto
    ? [
        "⚠️ informação necessária: foto — este produto não tem nenhuma imagem cadastrada, e o Mercado Livre exige pelo menos uma para publicar. Envie em Imagens.",
        ...daGrade,
      ]
    : daGrade;
  // O EAN sai da grade como CONSELHO, não como trava — ele não é obrigatório em
  // nenhuma categoria medida, e o ML aceita o motivo no lugar do código. As
  // sugestões do modelo continuam valendo; esta entra junto.
  const conselhos = [...(daIA.sugestoes ?? []), ...sugestoesDaGrade(grade)];

  // O VEREDITO É A LISTA DE PENDÊNCIAS, DITA EM UMA PALAVRA.
  //
  // Ele não é mais do modelo (ver o esquema). Aqui ele é DERIVADO: lista vazia
  // aprova, lista cheia reprova. Não é uma segunda opinião sobre as pendências
  // — é a mesma informação, e por construção não pode discordar do que a tela
  // mostra.
  //
  // Era exatamente essa discordância o defeito: 299 anúncios "reprovados" com
  // zero pendências, e nada escrito para a lojista corrigir. Publicar exige
  // `veredito === "aprovado" && pendencias.length === 0`; com o veredito
  // derivado, as duas condições viraram uma só, e nenhuma pode travar sozinha.
  const publicavel = pendencias.length === 0;
  return {
    ...daIA,
    variacoes: grade,
    pendencias,
    sugestoes: conselhos,
    vereditoA10: publicavel ? "aprovado" : "reprovado",
    // O motivo nomeia os CAMPOS, não repete os textos.
    //
    // A primeira versão concatenava as pendências inteiras. A da foto sozinha
    // tem cerca de 180 caracteres, então um produto sem foto, sem preço e sem
    // SKU produzia mais de 400 — gravados no JSONB de cada anúncio e truncados
    // no meio de uma frase em qualquer listagem, onde o motivo aparece como
    // resumo de uma linha.
    //
    // O detalhe continua tendo dono: é a lista de pendências, logo ali, e é ela
    // que a tela do anúncio mostra. O motivo é o rótulo.
    motivoVeredito: publicavel
      ? "Sem pendências: a grade está completa, há preço e há foto cadastrada."
      : `Não publica ainda. ${camposQueFaltam(pendencias)}`,
  };
}

/** Resultado simulado (fallback sem OPENAI_API_KEY) — demonstra a tela. */
export function anuncioSimulado(nomeProduto: string): AnuncioGerado {
  const nome = nomeProduto || "Produto";
  return {
    notaDiagnostico: 58,
    tituloOtimizado: `[SIMULAÇÃO] ${nome} Premium Conforto`.slice(0, 60),
    palavrasChavePrincipais: ["[simulação] palavra-chave principal"],
    palavrasChaveSecundarias: ["conforto", "qualidade", "envio rápido"],
    descricaoCompleta:
      "[SIMULAÇÃO] Descrição completa gerada pela esteira. Configure a OPENAI_API_KEY no servidor para a geração real com os prompts A1–A12.",
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
    sugestoes: ["Configure a OPENAI_API_KEY para rodar a esteira de verdade."],
    vereditoA10: "reprovado",
    motivoVeredito: "Execução simulada — faltam dados reais e a chave da API. Nada foi publicado.",
  };
}
