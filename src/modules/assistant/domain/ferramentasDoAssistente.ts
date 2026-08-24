// O catálogo do que o assistente pode fazer — e a fronteira que o separa de
// poder estragar alguma coisa.
//
// A INVARIANTE, que vale mais que qualquer prompt:
//
//     o modelo pode PROPOR qualquer coisa · só o clique de um humano
//     GRAVA NO CATÁLOGO
//
// AS DUAS ÚLTIMAS PALAVRAS ENTRARAM EM 2026-08-03, e elas são a diferença entre
// uma invariante e um slogan. Até aquele dia a frase era "nenhuma ferramenta
// escreve", e ela era literalmente verdadeira. Deixou de ser quando o chat
// ganhou `reativar_anuncio`: essa ferramenta ESCREVE — no Mercado Livre.
//
// Manter a frase antiga teria sido a pior das saídas: uma invariante que o
// código já não cumpre ensina a não acreditar nas outras. Então ela foi
// reescrita para dizer exatamente o que continua absoluto:
//
//     NENHUMA ferramenta tem caminho até `produtos` nem `produto_variantes`
//
// O catálogo da lojista só muda por Proposal → clique humano → revalidação. Um
// modelo pior, um prompt vazado ou um turno estranho não alcançam aquelas duas
// tabelas porque não existe caminho — não porque foram instruídos a não ir.
//
// O QUE ABRIU NÃO ABRIU SOZINHO. Uma ferramenta só age no marketplace se
// cumprir DUAS condições, e as duas são escritas à mão de propósito:
//
//   1. declarar `efeito: "executa"` — o tipo `Efeito` é a fronteira, e
//      `ferramentasDoAssistente.test.ts` a prende em tempo de COMPILAÇÃO:
//      um efeito novo reprova o `typecheck:test` antes de qualquer teste rodar;
//   2. estar nomeada em `EXECUCOES_REVERSIVEIS` — a lista do que se desfaz com
//      um clique. Uma segunda ferramenta `executa` reprova o portão até alguém
//      escrever o nome dela ali e assinar a decisão.
//
// A condição 2 existe porque a 1, sozinha, teria virado uma porta aberta: com
// `executa` já no tipo, toda ferramenta futura passaria calada. A exigência de
// revisão humana não sumiu — mudou de lugar, do EFEITO para o NOME.
//
// Os testes existem porque proteção que mora só na cabeça de quem escreveu o
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
  | "propoe"
  /**
   * EXECUTA uma ação REVERSÍVEL no marketplace, sem esperar clique.
   *
   * Decisão do dono em 03/08/2026: "chat pode agir e propor". Se a lojista tem
   * de resolver tudo pelo chat, exigir que ela saia dele para clicar um botão
   * é devolver a ela o trabalho de roteamento que o software deveria fazer.
   *
   * A LINHA QUE FICA NÃO É agir-vs-propor — é REVERSIBILIDADE, e não fui eu que
   * a inventei: o próprio código já a tinha. `/api/ml/estado-do-anuncio`
   * (paused/active) é uma rota SEPARADA de `/api/ml/encerrar` (closed) porque
   * "closed é terminal e paused é reversível", e juntá-las faria um erro de
   * digitação destruir um anúncio.
   *
   * Então `executa` vale para o que se desfaz com um clique — reativar um
   * anúncio que ela mesma pausou. Encerrar, publicar, gravar custo e gravar
   * preço continuam em `propoe`: erro ali custa dinheiro ou histórico, e o
   * clique humano é barato perto disso.
   *
   * Ampliar esta fronteira exige mudar a linha abaixo e ver a build reprovar —
   * que é o desenho funcionando, não um obstáculo.
   */
  | "executa";

export interface Ferramenta {
  nome: string;
  /** O que ela faz, na voz de quem instrui o modelo. */
  descricao: string;
  efeito: Efeito;
  /**
   * Schema dos argumentos, em JSON Schema.
   *
   * MINÚSCULO. Este campo já esteve no dialeto do Gemini (`type: "OBJECT"`), que
   * a Anthropic recusa — JSON Schema é minúsculo. O erro não aparecia em teste
   * nenhum porque o campo era repassado sem olhar, e só a API reclamaria.
   * `naoSobrouDialetoDoGemini` guarda isso agora.
   */
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
      type: "object",
      properties: {
        assunto: {
          type: "string",
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
      "O que resolver primeiro para destravar o resto, na ordem em que resolver produz resultado. Use para \"por onde eu começo?\", \"o que eu faço agora?\" e \"o que rende mais?\".",
    parametros: { type: "object", properties: {} },
  },
  {
    nome: "estado_da_loja",
    efeito: "le",
    descricao: "Todos os pontos a resolver na loja, em ordem. Use para dar um panorama.",
    parametros: { type: "object", properties: {} },
  },
  {
    nome: "o_que_impede",
    efeito: "le",
    descricao: "O que impede a loja de precificar, anunciar ou publicar hoje. Use para \"por que não consigo publicar?\" e \"o que está travando?\".",
    parametros: {
      type: "object",
      properties: { capacidade: { type: "string", enum: ["precificar", "anunciar", "publicar"] } },
      required: ["capacidade"],
    },
  },
  {
    nome: "achar_produto",
    efeito: "le",
    descricao:
      "Acha produtos e variantes do catálogo. Aceita nome, marca, SKU, referência (o modelo, ex. 7178.102) e EAN. Use SEMPRE antes de propor qualquer coisa sobre um produto — é assim que você descobre se o alvo é único. IMPORTANTE: achar por identificador exato NÃO garante um só resultado; nesta base há SKUs e EANs repetidos. Se o desfecho vier \"ambiguo\", PERGUNTE ao lojista qual — nunca escolha. O campo \"casamento\" diz COMO foi achado: \"candidato_textual\" é semelhança de nome e não identifica ninguém.",
    parametros: {
      type: "object",
      properties: {
        termo: { type: "string", description: "O que o lojista disse: nome, SKU, referência ou EAN." },
        tipo: {
          type: "string",
          enum: ["auto", "nome", "sku", "referencia", "ean"],
          description: "Onde procurar. Use \"auto\" quando não tiver certeza do que o termo é.",
        },
        termos: { type: "string", description: "Compatibilidade: o mesmo que termo." },
      },
      required: ["termo"],
    },
  },
  {
    nome: "o_que_falta_no_produto",
    efeito: "le",
    descricao:
      "O que falta preencher num produto específico. Use quando o lojista perguntar sobre UM produto — \"o que falta nesse aí?\". Precisa de um produtoId vindo de achar_produto.",
    parametros: {
      type: "object",
      properties: { produtoId: { type: "string" } },
      required: ["produtoId"],
    },
  },
  {
    nome: "pendencias",
    efeito: "le",
    descricao:
      "O panorama do que está travado no catálogo, já ANALISADO: quantas pendências existem, quantas eu consigo tratar sem pedir dado novo, quantas dependem de decisão do lojista, e quantas estão em conflito. Use para \"o que precisa de mim?\", \"quais produtos estão com problema?\" e \"o que eu resolvo primeiro?\". Com produtoId, explica por que AQUELE produto está travado, descendo até a variante. Os números vêm daqui — nunca escreva um que esta ferramenta não devolveu.",
    parametros: {
      type: "object",
      properties: {
        produtoId: {
          type: "string",
          description:
            "Vazio para o panorama da loja. Preenchido para explicar um produto — id vindo de achar_produto.",
        },
      },
    },
  },
  {
    nome: "preparacao_de_anuncio",
    efeito: "le",
    descricao:
      "O estado REAL da preparação de anúncio. Sem produtoId: quantos produtos já podem virar anúncio, quantos estão travados e por quê — use para \"quais produtos já podem virar anúncio?\" e antes de \"prepare todos que estiverem prontos\". Com produtoId: as etapas daquele produto (identidade, conteúdo, imagens, pricing, publicação), o que cada uma trava e o que falta — use para \"o que falta para esse anúncio?\" e \"por que esse não foi?\". Os números vêm daqui; nunca escreva um que esta ferramenta não devolveu. PREPARAR NÃO É PUBLICAR: nada aqui coloca anúncio no ar.",
    parametros: {
      type: "object",
      properties: {
        produtoId: {
          type: "string",
          description: "Vazio para o panorama da loja. Preenchido para um produto — id de achar_produto.",
        },
      },
    },
  },
  {
    nome: "pricing",
    efeito: "le",
    descricao:
      "Preço, margem e lucro de um produto, calculados pelo motor financeiro do Zion. VOCÊ NÃO FAZ CONTA DE DINHEIRO — pergunte a esta ferramenta e leia o resultado. Sem produtoId: a triagem do catálogo (quantos em prejuízo, quantos abaixo da margem, quantos bloqueados). Com produtoId: a situação do preço de hoje, o menor preço sem prejuízo, o menor preço na margem do lojista, e a decomposição (custo, comissão, frete, imposto, lucro). Com \"precos\": simula os cenários que ele pediu. Com \"margemAlvo\": o preço que entrega aquela margem. MARGEM aqui é sempre MARGEM LÍQUIDA sobre o preço de venda — nunca markup. Use SEMPRE que a conversa envolver preço, margem, lucro ou \"quanto sobra\".",
    parametros: {
      type: "object",
      properties: {
        produtoId: {
          type: "string",
          description: "Vazio para a triagem do catálogo. Preenchido para um produto — id de achar_produto.",
        },
        precos: {
          type: "array",
          items: { type: "string" },
          description:
            "Cenários a simular, como o lojista escreveu: \"79,90\", \"R$ 84,90\". Copie a vírgula decimal.",
        },
        margemAlvo: {
          type: "string",
          description:
            "A margem líquida que ele quer, em % — \"10\", \"12,5\". Só quando ele disser um número.",
        },
      },
    },
  },
  {
    nome: "meus_custos",
    efeito: "le",
    descricao:
      "Os CUSTOS DO LOJISTA e a MARGEM MÍNIMA dela — o que ela paga por venda além do produto e do marketplace: embalagem, etiqueta, informativos, imposto, comissão do gestor, comissão do sistema e cupom. " +
      "Use para \"quanto sai de mim em cada venda?\", \"qual minha margem mínima?\", \"por que o preço mínimo está tão alto?\" e sempre que ela questionar de onde vem um desconto no cálculo. " +
      "IMPORTANTE: estes valores entram em TODA conta de preço do Zion. Se algum estiver errado, todo número que o software dá está errado — então quando ela estranhar um preço, confira estes ANTES de investigar o produto.",
    parametros: { type: "object", properties: {} },
  },
  {
    nome: "tabela_de_medidas",
    efeito: "le",
    descricao:
      "A tabela de medidas de um produto — a grade de tamanhos com as medidas em centímetros, e DE ONDE ela veio. " +
      "Use quando ela perguntar sobre numeração, tamanho, medida, ou o que responder a um comprador que pergunta se serve. " +
      "IMPORTANTE: a resposta traz `fonte`. Override é a tabela que ELA cadastrou; `marca` é referência da fabricante; `padrao` é o BR genérico e pode não bater com a marca. Diga qual está usando — tabela errada vira devolução.",
    parametros: {
      type: "object",
      properties: { produtoId: { type: "string" } },
      required: ["produtoId"],
    },
  },
  {
    nome: "procedencia",
    efeito: "le",
    descricao:
      "De onde veio o valor de um campo: quem informou, por qual caminho, quando, e se existe valor anterior registrado. Use para \"de onde veio esse custo?\", \"quem colocou esse peso?\", \"esse SKU veio da planilha?\". IMPORTANTE: quando a origem não foi registrada, diga exatamente isso — a maior parte desta base é anterior ao registro de procedência, e inventar uma origem provável é pior que admitir que não se sabe.",
    parametros: {
      type: "object",
      properties: {
        produtoId: { type: "string" },
        campo: { type: "string", enum: ["custo", "preco", "peso", "sku", "ean", "estoque"] },
        varianteId: {
          type: "string",
          description: "Quando a pergunta é sobre uma variante específica. Vazio para o produto.",
        },
      },
      required: ["produtoId", "campo"],
    },
  },
  {
    nome: "vendas_da_loja",
    efeito: "le",
    descricao:
      "As vendas da loja no Mercado Livre num período (7, 14, 30, 60 ou 90 dias), COMPARADAS com o período anterior de mesmo tamanho: faturamento, pedidos, unidades, ticket médio, margem, quem mais caiu e quem mais subiu, e o que SUMIU das vendas. Use para \"como estão minhas vendas?\", \"quanto vendi?\", \"por que caíram?\" e \"o que está vendendo mais?\". Ela também devolve o que os dados NÃO cobrem (visitas, conversão) — repita isso quando a pergunta for \"por quê\".",
    parametros: {
      type: "object",
      properties: {
        dias: { type: "integer", enum: [7, 14, 30, 60, 90], description: "O tamanho da janela. Sem pista na pergunta, use 30." },
      },
      required: ["dias"],
    },
  },
  {
    nome: "comparar_lojas",
    efeito: "le",
    descricao:
      "SÓ PARA QUEM OPERA VÁRIAS LOJAS (agência ou equipe). Mede todas as lojas no alcance da conta com a mesma régua — produtos, com custo, com peso, com foto, com anúncio, aguardando aprovação, conectada ao Mercado Livre, infrações — e devolve uma por linha, para comparar. Use para \"compara minhas lojas\", \"qual loja está mais atrasada?\", \"qual tem mais pendência?\". Não traz vendas: vendas se perguntam dentro de cada loja.",
    parametros: { type: "object", properties: {} },
  },
  {
    nome: "anuncios_ativos",
    efeito: "le",
    descricao:
      "OS ANÚNCIOS DA LOJA NO MERCADO LIVRE, por estado: quantos estão ATIVOS (no ar), quantos pausados, em revisão, encerrados ou inativos — na palavra do próprio ML — e quantos nunca tiveram o estado medido. Traz também POR QUE não estão no ar (out_of_stock, forbidden) e HÁ QUANTOS DIAS cada estado foi lido. Use para \"quais anúncios estão ativos?\", \"quantos anúncios tenho no ar?\", \"o que está pausado?\", \"tem anúncio em revisão?\". Para UM produto específico use diagnostico_do_anuncio.",
    parametros: { type: "object", properties: {} },
  },
  {
    nome: "anuncios_a_corrigir",
    efeito: "le",
    descricao:
      "A FILA DE CORREÇÃO: os anúncios que NÃO estão no ar, agrupados pelo MOTIVO que o Mercado Livre deu (waiting_for_patch = o ML pediu uma alteração; paused_by_seller = a loja pausou; out_of_stock = estoque zerou; forbidden = infração; picture_download_pending = fotos ainda baixando). Para cada motivo diz o que significa, em quais produtos se concentra, e O QUE O ZION CONSEGUE FAZER com ele hoje — inclusive quando a resposta é 'não consigo, e é por isto'. Use para \"o que está parado?\", \"por que meus anúncios não estão no ar?\", \"o que preciso corrigir?\", \"resolve o que der\".",
    parametros: { type: "object", properties: {} },
  },
  {
    nome: "o_que_eu_consigo",
    efeito: "le",
    descricao:
      "O QUE EU SEI E NÃO SEI FAZER. Use SEMPRE quando estiver prestes a dizer que não consegue algo, quando o lojista perguntar o que você faz, e antes de prometer qualquer coisa que você não tenha certeza de alcançar. Sem parâmetro, devolve o que eu faço. Com 'assunto', devolve por que aquilo não é possível hoje e o que faria falta — os assuntos são: editar_anuncio_publicado (mudar preço, título, descrição, estoque ou variação de um anúncio JÁ no ar), detalhe_da_moderacao (o que o ML quer que se mude), agrupar_anuncios, outros_marketplaces (TikTok, Shopee, Amazon), erp, perguntas_e_mensagens, anuncios_patrocinados, estado_ao_vivo, excluir. Passe também 'pedido' com a frase do lojista: é assim que a Zion descobre o que falta construir.",
    parametros: {
      type: "object",
      properties: {
        assunto: { type: "string", description: "O assunto da limitação, quando você já sabe qual é." },
        pedido: { type: "string", description: "O que o lojista pediu, nas palavras dele." },
      },
    },
  },
  {
    nome: "diagnostico_de_agrupamento",
    efeito: "le",
    descricao:
      "A GRADE DE CADA PRODUTO NO MERCADO LIVRE: quantos anúncios ele tem, quantos estão no ar, e quanto da grade está comprável hoje. Em calçado o ML NÃO aceita um anúncio com variações — cada numeração é um anúncio próprio — então muitos anúncios para um produto é o formato certo; o defeito é quando só uma parte está no ar (ex.: 16 anúncios e 1 ativo significa que quem procura outro número não acha a loja). Também aponta produtos que compartilham a mesma referência de fabricante, para CONFERIR se é duplicidade de cadastro ou dois materiais do mesmo modelo. Use para \"as variações não estão agrupadas\", \"o que está errado nos meus anúncios?\", \"tem produto duplicado?\", \"por que só aparece um número?\".",
    parametros: { type: "object", properties: {} },
  },
  {
    nome: "diagnostico_do_anuncio",
    efeito: "le",
    descricao:
      "POR QUE um anúncio não vende — lê no Mercado Livre as visitas dos últimos 30 dias, as unidades vendidas, a saúde, o estoque e o estado do anúncio publicado deste produto, e separa EXPOSIÇÃO (ninguém vê: título, categoria, saúde) de CONVERSÃO (veem e não compram: preço, fotos, descrição). Use para \"otimiza esse anúncio\", \"por que esse não vende?\", \"o que está errado com esse anúncio?\" — ANTES de propor título ou preço. Produto sem anúncio publicado não tem diagnóstico, e a ferramenta diz isso.",
    parametros: {
      type: "object",
      properties: { produtoId: { type: "string" } },
      required: ["produtoId"],
    },
  },
  {
    nome: "meu_perfil_de_conteudo",
    efeito: "le",
    descricao:
      "Como ESTA loja gosta de vender, escrito por ela em Configurações: tom de voz, público, palavras preferidas e palavras proibidas. Use para \"como a gente escreve?\", \"qual é o nosso tom?\", \"que palavras eu proibi?\" e antes de explicar por que um título foi recusado por palavra proibida. Perfil vazio significa que a loja ainda não preencheu — diga isso e aponte Configurações; não invente um tom.",
    parametros: { type: "object", properties: {} },
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
      type: "object",
      properties: {
        produtoId: { type: "string", description: "Um produto só. Use este OU produtoIds." },
        produtoIds: {
          type: "array",
          items: { type: "string" },
          description: "Vários produtos, para aplicar peso em lote. Todos vindos de achar_produto.",
        },
        campo: { type: "string", enum: ["peso", "custo"] },
        valor: {
          type: "string",
          description:
            "O número EXATAMENTE como o lojista disse, com a vírgula decimal. \"0,3\" é \"0,3\", nunca \"0.3\" nem \"3\".",
        },
        unidade: {
          type: "string",
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
      type: "object",
      properties: {
        alvo: {
          type: "string",
          description: "O produtoId da preparação, exatamente como `pendencias` devolveu.",
        },
      },
      required: ["alvo"],
    },
  },
  {
    nome: "propor_preco",
    efeito: "propoe",
    descricao:
      "Monta uma proposta de TROCAR O PREÇO de um produto no catálogo do Zion. Passe \"preco\" (o valor que o lojista disse) OU \"margemAlvo\" (a margem líquida que ele quer, e eu calculo o preço). NÃO grava e NÃO publica no Mercado Livre: monta o cartão que ele confirma clicando, e a troca acontece no catálogo do Zion. Se o custo, o peso ou a configuração de imposto mudarem entre a proposta e o clique, a proposta fica obsoleta e nada é gravado. Use quando o lojista disser um preço novo ou a margem que quer atingir.",
    parametros: {
      type: "object",
      properties: {
        produtoId: { type: "string" },
        preco: {
          type: "string",
          description: "O preço EXATAMENTE como ele disse, com a vírgula: \"89,90\".",
        },
        margemAlvo: {
          type: "string",
          description: "A margem líquida desejada em %, quando ele pediu por margem em vez de preço.",
        },
      },
      required: ["produtoId"],
    },
  },
  {
    nome: "propor_publicacao",
    efeito: "propoe",
    descricao:
      "Monta uma proposta de PUBLICAR um anúncio no Mercado Livre. Devolve o ENSAIO — o que subiria: título, preço, estoque, quantas fotos, categoria. NÃO publica: quem publica é a lojista, clicando. " +
      "Recusa sozinha quando falta o que o domínio exige (preço, foto) ou quando o anúncio já está no ar. " +
      "IMPORTANTE: esta é a única ação que muda o que o COMPRADOR vê. Nunca diga que o anúncio está no ar — diga que a proposta está pronta para ela confirmar.",
    parametros: {
      type: "object",
      properties: { produtoId: { type: "string" } },
      required: ["produtoId"],
    },
  },
  {
    nome: "propor_descricao",
    efeito: "propoe",
    descricao:
      "Monta uma proposta de MELHORAR A DESCRIÇÃO de um anúncio que já existe. Devolve a descrição ATUAL e a PROPOSTA, lado a lado. NÃO grava: a lojista lê as duas e confirma clicando. " +
      "Use quando ela pedir para melhorar, reescrever ou completar a descrição. Se o produto ainda não tem anúncio gerado, não há descrição para melhorar — a ferramenta diz isso. " +
      "Não repita o texto proposto na sua resposta: o cartão já mostra os dois lados, e reescrevê-lo faria aparecer uma terceira versão. " +
      "Quando ela pedir um AJUSTE numa descrição já proposta (\"deixa mais curta\", \"tira esse exagero\", \"fala do conforto\"), chame de novo com a instrução em `instrucao` — o resto é preservado.",
    parametros: {
      type: "object",
      properties: { produtoId: { type: "string" }, instrucao: {
          type: "string",
          description:
            "O que o lojista pediu de diferente, nas palavras dele: \"deixa mais curto\", \"mais premium\", \"tira o exagero\", \"põe a cor\". Só quando ele disse algo. Quem recebe isto PRESERVA o que não foi questionado.",
        }, },
      required: ["produtoId"],
    },
  },
  {
    nome: "propor_palavras_chave",
    efeito: "propoe",
    descricao:
      "Monta uma proposta de ACRESCENTAR palavras-chave a um anúncio que já existe. Devolve só os termos NOVOS — os que o anúncio já tem são descartados antes de você ver. NÃO grava: a lojista confirma clicando. " +
      "Use quando ela falar em busca, SEO, ser achada, aparecer nas pesquisas. " +
      "IMPORTANTE: ACRESCENTA, não substitui. Nenhuma palavra atual é removida, e dizer que vai 'trocar' faria ela recusar uma melhoria que não tira nada.",
    parametros: {
      type: "object",
      properties: { produtoId: { type: "string" } },
      required: ["produtoId"],
    },
  },
  {
    nome: "propor_titulo",
    efeito: "propoe",
    descricao:
      "Monta uma proposta de MELHORAR O TÍTULO de um anúncio que já existe. Roda o agente de título da Zion e devolve o título ATUAL e o PROPOSTO, lado a lado. NÃO grava: o lojista lê os dois e confirma clicando. Precisa de um produtoId cujo anúncio já tenha sido gerado — não existe título para melhorar num produto sem anúncio. Use quando ele pedir para melhorar, revisar ou reescrever o título de um anúncio. Quando ele pedir um AJUSTE num título já proposto (\"deixa mais curto\", \"tira a marca\", \"mais premium\"), chame de novo com a instrução em `instrucao` — o resto é preservado.",
    parametros: {
      type: "object",
      properties: { produtoId: { type: "string" }, instrucao: {
          type: "string",
          description:
            "O que o lojista pediu de diferente, nas palavras dele: \"deixa mais curto\", \"mais premium\", \"tira o exagero\", \"põe a cor\". Só quando ele disse algo. Quem recebe isto PRESERVA o que não foi questionado.",
        }, },
      required: ["produtoId"],
    },
  },
  {
    nome: "propor_imagem",
    efeito: "propoe",
    descricao:
      "Monta uma proposta de GERAR UMA IMAGEM do produto pela IA, a partir da FOTO REAL dele: capa (fundo branco, 1:1), infográfico, foto de detalhe, imagem de medidas, foto em uso ou imagem de benefícios. NÃO gera: o lojista confirma clicando, e a imagem gerada fica como rascunho até ele aprovar. Use para \"cria as imagens\", \"faz uma capa\", \"gera um infográfico\". Quando ele disser que NÃO GOSTOU de uma versão (\"quero fundo branco e o produto maior\"), chame de novo com `paiVersaoId` = o id da versão recusada (está no cartão) e `feedback` = o que ele disse — a próxima versão parte daquela e corrige exatamente isso. Produto sem foto real não gera: a IA melhora, não inventa.",
    parametros: {
      type: "object",
      properties: {
        produtoId: { type: "string" },
        slot: { type: "string", enum: ["capa", "infografico", "detalhe", "medidas", "humanizada", "beneficios"] },
        instrucao: { type: "string", description: "O que ele pediu para esta imagem, nas palavras dele. Opcional." },
        paiVersaoId: { type: "string", description: "O id da versão recusada, quando é um ajuste." },
        feedback: { type: "string", description: "O que ele disse da versão recusada." },
        beneficios: { type: "string", description: "Só para infográfico/benefícios: os benefícios que ELE informou. Não invente." },
      },
      required: ["produtoId", "slot"],
    },
  },
  {
    nome: "propor_tarefas",
    efeito: "propoe",
    descricao:
      "Monta uma proposta de CRIAR TAREFAS para a loja — a lista do que ela decidiu fazer a partir de um diagnóstico (\"conferir estoque da Sandália B\", \"revisar o preço dos que caíram\"). NÃO grava: o lojista vê a lista e confirma clicando. Use quando ele pedir \"cria as tarefas\", \"anota isso\", \"me lembra de\" ou aceitar um plano que você propôs. Cada tarefa leva o MOTIVO — o fato que a justifica, com o número que uma ferramenta devolveu. No máximo 10.",
    parametros: {
      type: "object",
      properties: {
        tarefas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string", description: "O que fazer, em uma frase." },
              motivo: { type: "string", description: "Por quê — o fato ou número que motivou." },
              prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
              produtoId: { type: "string", description: "O id do produto, quando a tarefa é sobre um." },
            },
            required: ["titulo", "motivo", "prioridade"],
          },
        },
      },
      required: ["tarefas"],
    },
  },
  {
    nome: "propor_anuncio",
    efeito: "propoe",
    descricao:
      "Monta uma proposta de GERAR O ANÚNCIO de um produto — título, descrição e ficha técnica. NÃO gera nada: quem dispara é o lojista, clicando, e leva alguns minutos. Antes de propor, ela confere se o produto tem tudo que o anúncio precisa; se faltar algo, devolve o que falta em vez de propor. Use com um produtoId que veio de achar_produto.",
    parametros: {
      type: "object",
      properties: { produtoId: { type: "string" } },
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
    nome: "investigar",
    efeito: "rascunha",
    descricao:
      "ABRE UMA INVESTIGAÇÃO que atravessa turnos. Use quando o pedido for AMPLO ou PROFUNDO demais para caber numa resposta — \"descobre o que está errado na loja\", \"arruma os anúncios da Modare\", \"dá uma geral\", \"resolve o que der\" — e você perceber que vai precisar de muitas consultas. Chame no COMEÇO do turno, com a pergunta e o que pretende apurar; depois continue consultando normalmente. O que você descobrir fica guardado e volta no próximo turno, então não precisa terminar tudo agora. Chame de novo com concluida=true quando tiver a resposta. NÃO use para pergunta simples: uma consulta e uma resposta não são investigação.",
    parametros: {
      type: "object",
      properties: {
        pergunta: { type: "string", description: "O que se quer descobrir, em uma frase." },
        proximoPasso: { type: "string", description: "O que ainda falta apurar depois desta rodada." },
        concluida: { type: "boolean", description: "true quando a investigação chegou à resposta." },
      },
    },
  },
  {
    nome: "gerenciar_cadastro",
    efeito: "rascunha",
    descricao:
      "O cadastro de um produto NOVO, em conversa. Acumula o que o lojista já disse e diz o que ainda falta. NÃO cria nada: a criação só acontece depois que ele lê o resumo e clica. Operações: \"iniciar\" abre um cadastro; \"informar\" registra dados que ele DISSE (nunca deduza custo, preço, SKU, EAN ou peso — se ele não disser, pergunte); \"variantes\" monta a grade a partir das cores e tamanhos; \"identificador\" associa um SKU ou EAN a UMA variante (diga a cor e o tamanho; se não souber qual, pergunte); \"resumo\" mostra o estado; \"retomar\" continua um cadastro anterior; \"escolher\" resolve qual, quando eu mostrei uma lista; \"resolver_conflito\" decide entre dois valores que ele deu para o mesmo campo; \"cancelar\" desiste; \"propor_criacao\" monta a autorização para ele confirmar. Use \"propor_criacao\" só quando o resumo disser que está pronto.",
    parametros: {
      type: "object",
      properties: {
        operacao: {
          type: "string",
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
          type: "string",
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
          type: "string",
          description:
            "O que ele disse, EXATAMENTE como disse — com a vírgula decimal e com os zeros à esquerda. \"47,80\" é \"47,80\"; \"01040533\" é \"01040533\", nunca 1040533.",
        },
        unidade: {
          type: "string",
          description: "Só para peso: g, kg. Vazio se ele não disse nenhuma.",
        },
        cores: {
          type: "array",
          items: { type: "string" },
          description: "Para \"variantes\": as cores ditas, uma por item.",
        },
        tamanhos: {
          type: "array",
          items: { type: "string" },
          description: "Para \"variantes\": os tamanhos ditos, um por item.",
        },
        cor: { type: "string", description: "Para \"identificador\": a cor da variante alvo." },
        tamanho: {
          type: "string",
          description: "Para \"identificador\": o tamanho da variante alvo.",
        },
        escolha: {
          type: "string",
          description:
            "Para \"escolher\": o que ele disse — \"o segundo\", \"2\", ou o id, se ele deu o id. Não invente um id.",
        },
        conflito: {
          type: "string",
          enum: ["atual", "novo"],
          description: "Para \"resolver_conflito\": qual dos dois valores vale.",
        },
        dica: {
          type: "string",
          description:
            "Para \"retomar\": o que ele disse sobre qual cadastro (\"o da Modare\"). Vazio se ele não disse.",
        },
      },
      required: ["operacao"],
    },
  },
];

/**
 * As ferramentas de AÇÃO — as únicas que mexem no mundo sem esperar clique.
 *
 * Elas moram numa lista própria por um motivo estrutural: `FERRAMENTAS_DE_ACAO`
 * é a resposta à pergunta "o que este chat pode fazer sozinho?", e essa
 * pergunta merece um lugar onde a resposta seja lida de uma vez, não garimpada
 * campo a campo dentro da lista de leitura.
 *
 * Entrar aqui não basta para agir: o nome também precisa estar em
 * `EXECUCOES_REVERSIVEIS`.
 */
export const FERRAMENTAS_DE_ACAO: readonly Ferramenta[] = [
  {
    nome: "reativar_anuncio",
    efeito: "executa",
    descricao:
      "Reativa no Mercado Livre um anúncio que a lojista pausou. Use SOMENTE quando ela pedir para voltar ao ar, e SOMENTE para anúncios pausados por ela — nunca para anúncios que o Mercado Livre tirou do ar. A ação é reversível: se ela quiser, pausa de novo.",
    parametros: {
      type: "object",
      properties: {
        mlb: { type: "string", description: "O código MLB do anúncio a reativar." },
      },
      required: ["mlb"],
    },
  },
];

export const FERRAMENTAS: readonly Ferramenta[] = [
  ...FERRAMENTAS_DE_LEITURA,
  ...FERRAMENTAS_DE_RASCUNHO,
  ...FERRAMENTAS_DE_PROPOSTA,
  ...FERRAMENTAS_DE_ACAO,
];

/**
 * As ações que o chat pode executar sem clique — pelo NOME, escritas à mão.
 *
 * Esta lista é a segunda tranca, e a que passou a carregar o peso que o tipo
 * `Efeito` carregava sozinho até 2026-08-03. Enquanto `executa` não existia,
 * qualquer poder novo tinha de crescer o tipo, e crescer o tipo reprovava a
 * build. Com `executa` já no tipo, uma ferramenta nova entraria calada — e é
 * exatamente esse silêncio que esta lista impede.
 *
 * O CRITÉRIO PARA ENTRAR É REVERSIBILIDADE, e não fui eu que o inventei: o
 * código já o tinha. `/api/ml/estado-do-anuncio` (paused/active) é uma rota
 * SEPARADA de `/api/ml/encerrar` (closed) porque closed é terminal e paused se
 * desfaz — juntá-las faria um erro de digitação destruir um anúncio.
 *
 * Encerrar, publicar, gravar custo e gravar preço NÃO entram: errar ali custa
 * dinheiro ou histórico, e o clique humano é barato perto disso.
 */
export const EXECUCOES_REVERSIVEIS: readonly string[] = ["reativar_anuncio"];

/**
 * Verdadeiro quando nenhuma ferramenta escreve NO CATÁLOGO DO LOJISTA —
 * `produtos` e `produto_variantes`.
 *
 * Existe como função, e não como comentário, para o teste poder chamá-la. A
 * lista de permitidos é escrita à mão de propósito: derivá-la do tipo faria o
 * QUINTO efeito passar sozinho, e é justamente o efeito novo que precisa de uma
 * pessoa olhando.
 *
 * `executa` está entre os permitidos porque ele age no MARKETPLACE, não no
 * catálogo — a distinção inteira desta invariante. Quem guarda o que `executa`
 * pode fazer é `todaExecucaoEReversivel`, não esta função.
 */
export function nenhumaFerramentaEscreveNoCatalogo(
  fs: readonly Ferramenta[] = FERRAMENTAS
): boolean {
  const permitidos: readonly Efeito[] = ["le", "rascunha", "propoe", "executa"];
  return fs.every((f) => permitidos.includes(f.efeito));
}

/**
 * Verdadeiro quando toda ferramenta que age está NOMEADA em
 * `EXECUCOES_REVERSIVEIS`.
 *
 * É o portão que uma ferramenta `encerrar_anuncio` — ou qualquer ação que não
 * se desfaça — encontra fechado. Ela não falha por ser irreversível: o código
 * não tem como saber isso. Ela falha por ser DESCONHECIDA, e a única forma de
 * ficar conhecida é alguém escrever o nome dela na lista, o que obriga a
 * revisão que a mudança merece.
 */
export function todaExecucaoEReversivel(fs: readonly Ferramenta[] = FERRAMENTAS): boolean {
  return fs
    .filter((f) => f.efeito === "executa")
    .every((f) => EXECUCOES_REVERSIVEIS.includes(f.nome));
}

/**
 * As ferramentas que podem ser a PRIMEIRA ação de um turno — INC-003.
 *
 * ===========================================================================
 * POR QUE ESTA LISTA EXISTE
 * ===========================================================================
 *
 * O agente respondeu à Leilane que a Rasteira Vizzano tinha "2 variações sem
 * peso" e que o peso médio era "300 g", e que havia "preparado um cartão".
 * O real era 3, 410 g e nenhuma proposta — e ele não chamou ferramenta nenhuma.
 * O prompt já proibia isso; proibir não é impedir.
 *
 * A partir daqui o primeiro passo roda com `mode: "ANY"`, que obriga o modelo a
 * chamar uma função em vez de escrever texto. Só que ANY, sozinho, deixaria o
 * modelo escolher QUALQUER uma das 17 — inclusive `propor_preco`, e um
 * "obrigado" poderia deixar um cartão de troca de preço na tela de alguém.
 *
 * Desde 2026-08-03 a aposta ficou mais cara: com `reativar_anuncio` no catálogo,
 * um ANY irrestrito deixaria um "obrigado" colocar um anúncio no ar. A derivação
 * abaixo já barra isso sozinha — mas o motivo agora é este, e não só o cartão.
 *
 * Daí `allowedFunctionNames`: no primeiro passo, só as que LEEM.
 *
 * ===========================================================================
 * DERIVADA, NÃO ESCRITA À MÃO
 * ===========================================================================
 *
 * Vem de `efeito === "le"`, que já é a metadata autoritativa deste módulo —
 * dez strings copiadas aqui seriam uma segunda verdade, e uma ferramenta nova
 * classificada como `propoe` entraria na primeira ação por esquecimento.
 *
 * A DERIVAÇÃO JÁ PAGOU. `reativar_anuncio` nasceu em 03/08/2026 e ficou fora
 * desta lista sem que ninguém precisasse lembrar: ela não é `le`, e isso bastou.
 * Uma lista copiada à mão teria precisado de alguém atento no dia certo.
 *
 * O oposto de `nenhumaFerramentaEscreveNoCatalogo` e de
 * `EXECUCOES_REVERSIVEIS`, manuais DE PROPÓSITO: lá o que se quer é que um poder
 * novo reprove e obrigue alguém a olhar. Aqui o que se quer é que um efeito novo
 * fique fora sozinho.
 */
export const PRIMEIRA_ACAO: readonly string[] = FERRAMENTAS.filter(
  (f) => f.efeito === "le"
).map((f) => f.nome);

// ---------------------------------------------------------------------------
// O CATÁLOGO POR PAPEL
// ---------------------------------------------------------------------------
//
// Até 2026-08-22 a rota mandava `FERRAMENTAS` inteiro para todo mundo — e era
// inócuo porque só o papel `cliente` passava do 403. No dia em que agência e
// equipe entram no Copilot, "vê tudo" vira o padrão silencioso, e o poder de
// reativar um anúncio no Mercado Livre (a única ação sem clique) chegaria a
// quem opera a loja de terceiros sem ninguém ter decidido isso.
//
// A decisão, escrita à mão:
//   - leitura, rascunho e proposta: os três papéis. Propor não grava; quem
//     grava é o clique, e o clique passa pela Proposal com o tenant conferido.
//   - `reativar_anuncio` (executa, sem clique): lojista e agência — os dois
//     operam a loja no dia a dia, e a trava de posse + infração já vale para
//     ambos. A EQUIPE fica de fora: ela audita e dá suporte; recolocar um
//     anúncio de terceiro no ar sem o clique dele não é suporte.
//
// Uma ferramenta nova que não declare `papeis` vale para os três — é a regra
// padrão para leitura e proposta, e `executa` é barrado pelo teste de fonte
// que exige declaração explícita.

export type PapelDoCopilot = "cliente" | "agencia" | "equipe";

const PAPEIS_POR_EXECUCAO: Readonly<Record<string, readonly PapelDoCopilot[]>> = {
  reativar_anuncio: ["cliente", "agencia"],
};

/**
 * Leituras que só fazem sentido para quem opera VÁRIAS lojas. Para o lojista
 * a ferramenta nem é declarada — oferecer "compare suas lojas" a quem tem uma
 * seria convidar o modelo a responder o que não existe.
 */
const PAPEIS_POR_LEITURA: Readonly<Record<string, readonly PapelDoCopilot[]>> = {
  comparar_lojas: ["agencia", "equipe"],
};

/** As ferramentas que ESTE papel enxerga. Pura. */
export function ferramentasParaPapel(
  papel: PapelDoCopilot,
  fs: readonly Ferramenta[] = FERRAMENTAS
): readonly Ferramenta[] {
  return fs.filter((f) => {
    const restricaoDeLeitura = PAPEIS_POR_LEITURA[f.nome];
    if (restricaoDeLeitura) return restricaoDeLeitura.includes(papel);
    if (f.efeito !== "executa") return true;
    const permitidos = PAPEIS_POR_EXECUCAO[f.nome];
    // Execução sem política declarada não chega a ninguém — melhor uma
    // ferramenta ausente que um poder distribuído por omissão.
    return Boolean(permitidos?.includes(papel));
  });
}
