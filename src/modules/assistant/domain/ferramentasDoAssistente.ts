// O catálogo do que o assistente pode fazer — e a fronteira que o separa de
// poder estragar alguma coisa.
//
// A INVARIANTE, que vale mais que qualquer prompt:
//
//     o modelo pode PROPOR qualquer coisa · só o clique de um humano GRAVA
//
// Nenhuma ferramenta escreve. As de leitura devolvem dado medido; as de
// proposta montam um cartão que alguém precisa confirmar. Um modelo pior, um
// prompt vazado ou um turno estranho não conseguem tocar no banco, porque não
// existe caminho — não porque foram instruídos a não fazer.
//
// A fronteira mora no tipo `Efeito`, e `ferramentasDoAssistente.test.ts` a
// prende em tempo de COMPILAÇÃO: adicionar um terceiro efeito para o
// `typecheck:test` reprovar a build antes de qualquer teste rodar. Provado
// sabotando o tipo de propósito e vendo o portão fechar.
//
// O teste existe porque proteção que mora só na cabeça de quem escreveu o
// código não sobrevive ao segundo ano.
//
// Medido no EXP-006 contra a API real (gemini-2.5-flash, 8 conversas): 8/8,
// zero escrita indevida, zero número inventado. Mas o que faz isso valer não é
// o 8/8 — é o modelo NÃO TER como fazer diferente.

/**
 * O que uma ferramenta faz com o mundo.
 *
 * `escreve` NÃO EXISTE de propósito. Se um dia alguém precisar de uma
 * ferramenta que grava, vai ter que adicionar o valor aqui — e aí o teste da
 * invariante quebra, a revisão acontece, e a decisão é tomada por gente.
 */
export type Efeito =
  /** Lê dado medido. Não muda nada. */
  | "le"
  /** Monta uma proposta para um humano confirmar. Não muda nada. */
  | "propoe";

export interface Ferramenta {
  nome: string;
  /** O que ela faz, na voz de quem instrui o modelo. */
  descricao: string;
  efeito: Efeito;
  /** Schema dos argumentos, no dialeto do provedor. */
  parametros: Record<string, unknown>;
}

/**
 * As ferramentas de LEITURA.
 *
 * Toda quantidade que o assistente disser tem que vir de uma destas. Ele não vê
 * a loja; vê o que elas devolvem. É o que impede "cerca de 40" quando são 43.
 */
export const FERRAMENTAS_DE_LEITURA: readonly Ferramenta[] = [
  {
    nome: "contar",
    efeito: "le",
    descricao:
      "Quantos produtos estão em alguma condição. Use SEMPRE que precisar de um número — você não tem acesso aos dados e qualquer número seu seria inventado.",
    parametros: {
      type: "OBJECT",
      properties: {
        assunto: {
          type: "STRING",
          enum: ["peso", "custo", "foto", "anuncio", "aprovacao", "publicacao", "precificacao"],
        },
      },
      required: ["assunto"],
    },
  },
  {
    nome: "proximo_passo",
    efeito: "le",
    descricao:
      "O que resolver primeiro para destravar o resto, na ordem em que resolver produz resultado.",
    parametros: { type: "OBJECT", properties: {} },
  },
  {
    nome: "estado_da_loja",
    efeito: "le",
    descricao: "Todos os pontos a resolver na loja, em ordem. Use para dar um panorama.",
    parametros: { type: "OBJECT", properties: {} },
  },
  {
    nome: "o_que_impede",
    efeito: "le",
    descricao: "O que impede a loja de precificar, anunciar ou publicar hoje.",
    parametros: {
      type: "OBJECT",
      properties: { capacidade: { type: "STRING", enum: ["precificar", "anunciar", "publicar"] } },
      required: ["capacidade"],
    },
  },
  {
    nome: "achar_produto",
    efeito: "le",
    descricao:
      "Acha produtos do catálogo pelo nome ou marca. Use SEMPRE antes de propor qualquer coisa sobre um produto — é assim que você descobre se o alvo é único. Se voltar mais de um, PERGUNTE qual; nunca escolha por conta própria.",
    parametros: {
      type: "OBJECT",
      properties: { termos: { type: "STRING", description: "As palavras que o lojista usou." } },
      required: ["termos"],
    },
  },
  {
    nome: "o_que_falta_no_produto",
    efeito: "le",
    descricao:
      "O que falta preencher num produto específico. Precisa de um produtoId vindo de achar_produto.",
    parametros: {
      type: "OBJECT",
      properties: { produtoId: { type: "STRING" } },
      required: ["produtoId"],
    },
  },
];

/**
 * As ferramentas de PROPOSTA.
 *
 * Elas montam o cartão e param. Quem grava é o clique — e a gravação acontece
 * fora deste laço, por `correcaoPeloChat`, recebendo a proposta inteira.
 */
export const FERRAMENTAS_DE_PROPOSTA: readonly Ferramenta[] = [
  {
    nome: "propor_gravacao",
    efeito: "propoe",
    descricao:
      "Monta uma proposta de preenchimento para o lojista confirmar. NÃO grava nada — quem grava é o lojista, clicando. Só use com ids que vieram de achar_produto e um valor que o lojista DISSE nesta conversa. Nunca proponha um valor que você deduziu ou que ele não falou. Para VÁRIOS produtos de uma vez (\"essas Havaianas pesam 420 g\"), passe produtoIds com todos os ids — eu conto quem está sem o dado e mostro o escopo ao lojista antes de qualquer gravação. CUSTO só aceita um produto por vez: produtos parecidos não têm o mesmo custo, e eu não posso supor que têm.",
    parametros: {
      type: "OBJECT",
      properties: {
        produtoId: { type: "STRING", description: "Um produto só. Use este OU produtoIds." },
        produtoIds: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Vários produtos, para aplicar peso em lote. Todos vindos de achar_produto.",
        },
        campo: { type: "STRING", enum: ["peso", "custo"] },
        valor: {
          type: "STRING",
          description:
            "O número EXATAMENTE como o lojista disse, com a vírgula decimal. \"0,3\" é \"0,3\", nunca \"0.3\" nem \"3\".",
        },
        unidade: {
          type: "STRING",
          description: "A unidade que ele disse: g, kg, reais. Vazio se ele não disse nenhuma.",
        },
      },
      required: ["campo", "valor", "unidade"],
    },
  },
  {
    nome: "propor_anuncio",
    efeito: "propoe",
    descricao:
      "Monta uma proposta de GERAR O ANÚNCIO de um produto — título, descrição e ficha técnica. NÃO gera nada: quem dispara é o lojista, clicando, e leva alguns minutos. Antes de propor, ela confere se o produto tem tudo que o anúncio precisa; se faltar algo, devolve o que falta em vez de propor. Use com um produtoId que veio de achar_produto.",
    parametros: {
      type: "OBJECT",
      properties: { produtoId: { type: "STRING" } },
      required: ["produtoId"],
    },
  },
];

export const FERRAMENTAS: readonly Ferramenta[] = [
  ...FERRAMENTAS_DE_LEITURA,
  ...FERRAMENTAS_DE_PROPOSTA,
];

/**
 * Verdadeiro quando nenhuma ferramenta escreve.
 *
 * Existe como função, e não como comentário, para o teste poder chamá-la.
 */
export function nenhumaFerramentaEscreve(fs: readonly Ferramenta[] = FERRAMENTAS): boolean {
  const permitidos: readonly Efeito[] = ["le", "propoe"];
  return fs.every((f) => permitidos.includes(f.efeito));
}
