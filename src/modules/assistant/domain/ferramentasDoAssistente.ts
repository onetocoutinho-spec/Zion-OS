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
 *
 * ---------------------------------------------------------------------------
 * `rascunha` FOI ADICIONADO EM 2026-07-29, e o mecanismo funcionou: o
 * `typecheck:test` reprovou a build, a revisão aconteceu, e esta é a decisão.
 *
 * O cadastro conversacional precisa acumular estado entre turnos — fatos,
 * grade, conflitos. Esse estado é da CONVERSA, não do catálogo: ele mora em
 * `copilot_cadastros`, ao lado de `copilot_mensagens`, que a rota já grava a
 * cada turno sem que ninguém chame isso de escrita.
 *
 * A garantia que importa continua exatamente onde estava:
 *
 *     NENHUMA ferramenta toca em `produtos` nem em `produto_variantes`
 *
 * Uma ferramenta `rascunha` recebe o Draft e DEVOLVE o Draft modificado. Ela não
 * persiste — quem persiste é a rota, com o tenant da sessão, do mesmo jeito que
 * já persiste conversa e proposta. `executarFerramenta` continua puro.
 *
 * O produto continua nascendo por um caminho só: Proposal → clique humano →
 * `/api/assistente/proposta` → revalidação → reserva atômica → criação.
 */
export type Efeito =
  /** Lê dado medido. Não muda nada. */
  | "le"
  /** Acumula estado da CONVERSA. Não toca no catálogo do lojista. */
  | "rascunha"
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
      "Acha produtos e variantes do catálogo. Aceita nome, marca, SKU, referência (o modelo, ex. 7178.102) e EAN. Use SEMPRE antes de propor qualquer coisa sobre um produto — é assim que você descobre se o alvo é único. IMPORTANTE: achar por identificador exato NÃO garante um só resultado; nesta base há SKUs e EANs repetidos. Se o desfecho vier \"ambiguo\", PERGUNTE ao lojista qual — nunca escolha. O campo \"casamento\" diz COMO foi achado: \"candidato_textual\" é semelhança de nome e não identifica ninguém.",
    parametros: {
      type: "OBJECT",
      properties: {
        termo: { type: "STRING", description: "O que o lojista disse: nome, SKU, referência ou EAN." },
        tipo: {
          type: "STRING",
          enum: ["auto", "nome", "sku", "referencia", "ean"],
          description: "Onde procurar. Use \"auto\" quando não tiver certeza do que o termo é.",
        },
        termos: { type: "STRING", description: "Compatibilidade: o mesmo que termo." },
      },
      required: ["termo"],
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
  {
    nome: "pendencias",
    efeito: "le",
    descricao:
      "O panorama do que está travado no catálogo, já ANALISADO: quantas pendências existem, quantas eu consigo tratar sem pedir dado novo, quantas dependem de decisão do lojista, e quantas estão em conflito. Use para \"o que precisa de mim?\", \"quais produtos estão com problema?\" e \"o que eu resolvo primeiro?\". Com produtoId, explica por que AQUELE produto está travado, descendo até a variante. Os números vêm daqui — nunca escreva um que esta ferramenta não devolveu.",
    parametros: {
      type: "OBJECT",
      properties: {
        produtoId: {
          type: "STRING",
          description:
            "Vazio para o panorama da loja. Preenchido para explicar um produto — id vindo de achar_produto.",
        },
      },
    },
  },
  {
    nome: "procedencia",
    efeito: "le",
    descricao:
      "De onde veio o valor de um campo: quem informou, por qual caminho, quando, e se existe valor anterior registrado. Use para \"de onde veio esse custo?\", \"quem colocou esse peso?\", \"esse SKU veio da planilha?\". IMPORTANTE: quando a origem não foi registrada, diga exatamente isso — a maior parte desta base é anterior ao registro de procedência, e inventar uma origem provável é pior que admitir que não se sabe.",
    parametros: {
      type: "OBJECT",
      properties: {
        produtoId: { type: "STRING" },
        campo: { type: "STRING", enum: ["custo", "preco", "peso", "sku", "ean", "estoque"] },
        varianteId: {
          type: "STRING",
          description: "Quando a pergunta é sobre uma variante específica. Vazio para o produto.",
        },
      },
      required: ["produtoId", "campo"],
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
    nome: "preparar_resolucao",
    efeito: "propoe",
    descricao:
      "Monta a correção de UMA pendência que eu consigo preparar sem te perguntar o valor — hoje: variantes sem peso num produto cujas outras variantes já foram pesadas com o MESMO valor. NÃO grava: monta o cartão que o lojista confirma clicando. Use o `alvo` que veio de `pendencias` (o produtoId da preparação). \"Preparar sem perguntar\" NÃO é \"aplicar sem confirmar\": o lojista continua clicando.",
    parametros: {
      type: "OBJECT",
      properties: {
        alvo: {
          type: "STRING",
          description: "O produtoId da preparação, exatamente como `pendencias` devolveu.",
        },
      },
      required: ["alvo"],
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

/**
 * As ferramentas de RASCUNHO — o cadastro em conversa.
 *
 * UMA ferramenta com operações, e não vinte microferramentas
 * (`adicionar_cor`, `adicionar_tamanho`, `informar_sku`…). Vinte nomes fariam o
 * modelo escolher entre vinte caminhos parecidos a cada frase, e cada nome novo
 * seria uma chance a mais de ele escolher errado. Uma ferramenta com `operacao`
 * fechada deixa a interpretação com o Gemini e a TRANSIÇÃO com o domínio, que é
 * a divisão que este sistema inteiro usa.
 */
export const FERRAMENTAS_DE_RASCUNHO: readonly Ferramenta[] = [
  {
    nome: "gerenciar_cadastro",
    efeito: "rascunha",
    descricao:
      "O cadastro de um produto NOVO, em conversa. Acumula o que o lojista já disse e diz o que ainda falta. NÃO cria nada: a criação só acontece depois que ele lê o resumo e clica. Operações: \"iniciar\" abre um cadastro; \"informar\" registra dados que ele DISSE (nunca deduza custo, preço, SKU, EAN ou peso — se ele não disser, pergunte); \"variantes\" monta a grade a partir das cores e tamanhos; \"identificador\" associa um SKU ou EAN a UMA variante (diga a cor e o tamanho; se não souber qual, pergunte); \"resumo\" mostra o estado; \"retomar\" continua um cadastro anterior; \"escolher\" resolve qual, quando eu mostrei uma lista; \"resolver_conflito\" decide entre dois valores que ele deu para o mesmo campo; \"cancelar\" desiste; \"propor_criacao\" monta a autorização para ele confirmar. Use \"propor_criacao\" só quando o resumo disser que está pronto.",
    parametros: {
      type: "OBJECT",
      properties: {
        operacao: {
          type: "STRING",
          enum: [
            "iniciar",
            "informar",
            "variantes",
            "identificador",
            "resumo",
            "retomar",
            "escolher",
            "resolver_conflito",
            "cancelar",
            "propor_criacao",
          ],
        },
        campo: {
          type: "STRING",
          enum: [
            "nome",
            "marca",
            "modelo",
            "categoria",
            "sku",
            "ean",
            "custo",
            "precoVenda",
            "estoque",
            "cor",
            "tamanho",
            "pesoGramas",
            "alturaCm",
            "larguraCm",
            "comprimentoCm",
          ],
          description:
            "Para \"informar\" e \"resolver_conflito\". \"modelo\" é o que o lojista chama de referência (ex. 7178.102).",
        },
        valor: {
          type: "STRING",
          description:
            "O que ele disse, EXATAMENTE como disse — com a vírgula decimal e com os zeros à esquerda. \"47,80\" é \"47,80\"; \"01040533\" é \"01040533\", nunca 1040533.",
        },
        unidade: {
          type: "STRING",
          description: "Só para peso: g, kg. Vazio se ele não disse nenhuma.",
        },
        cores: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Para \"variantes\": as cores ditas, uma por item.",
        },
        tamanhos: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Para \"variantes\": os tamanhos ditos, um por item.",
        },
        cor: { type: "STRING", description: "Para \"identificador\": a cor da variante alvo." },
        tamanho: {
          type: "STRING",
          description: "Para \"identificador\": o tamanho da variante alvo.",
        },
        escolha: {
          type: "STRING",
          description:
            "Para \"escolher\": o que ele disse — \"o segundo\", \"2\", ou o id, se ele deu o id. Não invente um id.",
        },
        conflito: {
          type: "STRING",
          enum: ["atual", "novo"],
          description: "Para \"resolver_conflito\": qual dos dois valores vale.",
        },
        dica: {
          type: "STRING",
          description:
            "Para \"retomar\": o que ele disse sobre qual cadastro (\"o da Modare\"). Vazio se ele não disse.",
        },
      },
      required: ["operacao"],
    },
  },
];

export const FERRAMENTAS: readonly Ferramenta[] = [
  ...FERRAMENTAS_DE_LEITURA,
  ...FERRAMENTAS_DE_RASCUNHO,
  ...FERRAMENTAS_DE_PROPOSTA,
];

/**
 * Verdadeiro quando nenhuma ferramenta escreve NO CATÁLOGO DO LOJISTA.
 *
 * Existe como função, e não como comentário, para o teste poder chamá-la. A
 * lista de permitidos é escrita à mão de propósito: derivá-la do tipo faria o
 * quarto efeito passar sozinho, e é justamente o quarto efeito que precisa de
 * uma pessoa olhando.
 */
export function nenhumaFerramentaEscreve(fs: readonly Ferramenta[] = FERRAMENTAS): boolean {
  const permitidos: readonly Efeito[] = ["le", "rascunha", "propoe"];
  return fs.every((f) => permitidos.includes(f.efeito));
}
