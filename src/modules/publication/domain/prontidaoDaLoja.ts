// O que falta na loja inteira — puro, sem React, sem banco.
//
// POR QUE ISTO EXISTE
//
// A jornada (`jornada.ts`) responde "o que falta NESTE produto". Faltava quem
// respondesse "o que falta na LOJA" — e a ausência custou caro.
//
// A tela inicial sugeria "importe sua base", "otimize seus produtos", "rode a
// auditoria". Nunca mencionava peso nem custo. O lojista seguia as sugestões,
// gerava anúncios, e nunca entendia por que o preço mínimo dizia "falta frete".
// Medido na base real: 73 produtos, 0 com peso, e a precificação inteira muda —
// sem uma linha na tela dizendo isso.
//
// AS DUAS REGRAS QUE MANDAM AQUI
//
// 1. Cada lacuna diz O QUE ELA TRAVA, não o que falta preencher. "43 produtos
//    sem custo" é dado; "sem custo não há margem nem preço mínimo" é o motivo
//    de alguém se levantar da cadeira. Sem a consequência, a lista vira uma
//    burocracia que o lojista aprende a ignorar.
//
// 2. A ordem é por QUANTO DESTRAVA, não por quantidade. Peso vem antes de
//    custo mesmo quando faltam mais custos: sem peso não há frete para produto
//    nenhum, então preencher custo primeiro não faz preço aparecer em lugar
//    algum. Ordenar por volume mandaria a pessoa para o trabalho que não
//    produz resultado visível — e é assim que se perde a confiança na lista.

// ===========================================================================
// O MUNDO DEPOIS DA PUBLICAÇÃO — por que ele entrou aqui em 24/08/2026
// ===========================================================================
//
// Até esta data os nove tipos abaixo descreviam UM mundo só: o de preparar um
// produto e colocá-lo no ar. Nenhum deles falava de anúncio JÁ PUBLICADO.
//
// Medido na conta real da lojista, no mesmo dia:
//
//     26  anúncios no ar
//     90  anúncios com problemas
//     70  pendências abertas
//   2708  peças paradas atrás delas
//
// E `lacunasDaLoja` devolvia `[]`. Com a lista vazia, `aberturaDoHoje` dizia a
// única coisa que pode dizer sobre lista vazia — "Nada travado. Sua loja está
// em dia." — e a telha "Próximas ações" mostrava 0. O chat, perguntado "o que
// eu resolvo primeiro?", consultou `proximo_passo`, recebeu "nada travado",
// acreditou e improvisou cinco sugestões genéricas.
//
// TRÊS SUPERFÍCIES MENTINDO EM CORO, e nenhuma delas com defeito próprio: as
// três liam esta função, e esta função era cega para o trabalho que existe
// depois que o anúncio sobe.
//
// A causa é histórica e vale registrar: a operação migrou para o anúncio no ar
// — diagnóstico, capa, SKU, preço — e o modelo de prontidão ficou descrevendo
// o produto de julho.
export type TipoLacuna =
  | "sem_produtos"
  | "sem_conexao"
  | "pendencias_abertas"
  | "no_ar_sem_otimizacao"
  | "sem_peso"
  | "peso_incompleto"
  | "sem_custo"
  | "sem_foto"
  | "sem_anuncio"
  | "para_aprovar"
  | "para_publicar";

export interface EstadoDaLoja {
  produtos: number;
  /**
   * Produtos com o cadastro de peso COMPLETO — todas as variações preenchidas —
   * mais os que não têm grade (não há o que preencher).
   *
   * NÃO é "tem algum peso". Confundir as duas coisas escondia o estado parcial:
   * um produto com 1 de 39 variações pesadas contava como pronto. Ver INC-001.
   */
  comPeso: number;
  /**
   * Produtos com peso em PARTE das variações. Ficam fora de `comPeso` e fora de
   * `semPeso`: o frete deles sai, então a frase de "sem peso" seria falsa.
   */
  comPesoIncompleto: number;
  comCusto: number;
  /**
   * Produtos com custo E peso — os únicos que produzem preço mínimo.
   *
   * Vem MEDIDO de quem tem a lista, nunca deduzido de `comCusto` e `comPeso`:
   * o menor dos dois parece um teto honesto e é chute, porque os conjuntos
   * podem não se sobrepor. Nesta base já se gravou R$ 1,77 de piso e R$ 30
   * milhões de custo por deduzir o que dava para medir.
   */
  prontosParaPrecificar: number;
  comFoto: number;
  /** Produtos que já têm algum anúncio gerado. */
  comAnuncio: number;
  /**
   * As infrações da conta (migração 052). OPCIONAIS de propósito.
   *
   * `undefined` significa "ainda não lemos" e `0` significa "lemos e não há".
   * Colapsar os dois faria o assistente afirmar conta limpa sem ter olhado —
   * o mesmo silêncio que a AUD-001 passou o dia arrancando das telas.
   */
  infracoes?: number;
  anunciosComInfracao?: number;
  /**
   * O QUE O MERCADO LIVRE COBRA, agrupado por produto — o número da tela
   * "Pendências", e o mesmo que a Visão geral mostra.
   *
   * OPCIONAL pela regra desta interface: `undefined` é "não levantamos", `0` é
   * "levantamos e não há". Quem chama sem ler a memória do marketplace não
   * pode fazer a tela afirmar conta limpa.
   *
   * AS INFRAÇÕES JÁ ESTÃO AQUI DENTRO. `pendenciasDaConta` recebe
   * `InfracoesPorAnuncio` e as dobra nos grupos — então `infracoes` acima é o
   * detalhe do mesmo fato, não um fato ao lado. Uma lacuna separada para
   * infração contaria a mesma coisa duas vezes, e duas lacunas para um fato só
   * é como a lista perde a confiança de quem a lê.
   */
  pendenciasAbertas?: number;
  /**
   * Peças de estoque paradas atrás dessas pendências.
   *
   * Não é uma lacuna própria: é a CONSEQUÊNCIA da de cima, e é ela que move
   * alguém. "70 pendências" é um número sobre a nossa lista; "2708 peças
   * paradas" é um fato sobre o dinheiro dela.
   */
  pecasParadas?: number;
  /**
   * PRODUTOS cujo anúncio está no ar e nunca passou pela IA.
   *
   * A UNIDADE É PRODUTO, e isto não é detalhe: `estadoDeOtimizacao` devolve um
   * `Map` chaveado por `produtoId` — um produto com cinco anúncios conta UMA
   * vez, e o anúncio mais recente decide o estado dele. Chamar isto de
   * "anúncios" produz o mesmo defeito que o cartão vizinho tinha: um número
   * maior que o de anúncios no ar, sem nada na tela explicando por quê.
   *
   * Vem daquela função, a mesma que Meus Produtos e Relatórios usam — e não de
   * uma quarta conta escrita aqui. Três telas já discordaram sobre esta
   * palavra em 03/08/2026; a quarta versão não nasce neste arquivo.
   */
  noArSemOtimizacao?: number;
  /** Anúncios aguardando o aval do lojista. */
  aguardandoAprovacao: number;
  /** Anúncios aprovados e ainda não publicados. */
  aprovadosNaoPublicados: number;
  conectadoAoMarketplace: boolean;
  /**
   * OS NOMES POR TRÁS DOS NÚMEROS.
   *
   * ===========================================================================
   * POR QUE ISTO EXISTE
   * ===========================================================================
   *
   * "23 produtos sem peso" é um número honesto e inútil sozinho: a pergunta
   * seguinte é sempre **quais**, e até 14/08/2026 o chat não sabia responder.
   * Ela contava e mandava a lojista caçar na tabela de 80 linhas.
   *
   * OPCIONAL de propósito, e pela mesma razão de `infracoes`: `undefined`
   * significa "não levantamos os nomes", não "não há nenhum". Quem não juntou
   * a lista não pode dizer que a lista é vazia.
   */
  quaisSao?: Partial<Record<CondicaoNomeavel, AmostraDeNomes>>;
}

/** As condições cujos nomes valem ser ditos. Fechada: o resto é só número. */
export type CondicaoNomeavel =
  | "peso"
  | "custo"
  | "foto"
  | "anuncio"
  | "precificacao"
  | "aprovacao"
  | "publicacao";

/**
 * Quantos nomes cabem numa resposta de chat antes de virar ruído.
 *
 * Cinco. Uma lista de oitenta nomes não é uma resposta — é a mesma tabela que
 * ela já não conseguia ler, agora dentro da conversa.
 */
export const LIMITE_DE_NOMES = 5;

export interface AmostraDeNomes {
  /** Até `LIMITE_DE_NOMES` nomes. */
  nomes: readonly string[];
  /** Quantos ficaram de fora. NUNCA corte calado — ver `omitidos` na frase. */
  omitidos: number;
}

/**
 * A amostra, com o corte declarado.
 *
 * Ordena por nome para a resposta ser a MESMA entre duas perguntas iguais.
 * Amostra sorteada faria a lojista achar que a lista mudou quando nada mudou.
 */
export function amostraDeNomes(todos: readonly string[]): AmostraDeNomes {
  const limpos = [...new Set(todos.map((n) => (n ?? "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
  return {
    nomes: limpos.slice(0, LIMITE_DE_NOMES),
    omitidos: Math.max(0, limpos.length - LIMITE_DE_NOMES),
  };
}

/**
 * A frase que nomeia — ou string vazia quando não há o que nomear.
 *
 * O corte entra na frase, e não só no objeto: é a frase que a lojista lê, e
 * "são estes cinco" sobre vinte e três é a mentira por omissão que este
 * repositório passou o mês arrancando.
 */
export function fraseDosNomes(a: AmostraDeNomes | undefined): string {
  if (!a || a.nomes.length === 0) return "";
  const lista = a.nomes.join(", ");
  if (a.omitidos === 0) {
    return a.nomes.length === 1 ? ` É o ${lista}.` : ` São eles: ${lista}.`;
  }
  return ` Os primeiros são ${lista} — e mais ${a.omitidos}.`;
}

export interface Lacuna {
  tipo: TipoLacuna;
  /** O que falta, em uma linha. */
  titulo: string;
  /** A CONSEQUÊNCIA — por que isso importa. É o que move alguém. */
  trava: string;
  /** Quantos produtos/anúncios estão nessa condição. 0 quando não se conta. */
  quantos: number;
  /** Para onde ir resolver. */
  href: string;
  cta: string;
  /** true quando nada mais anda enquanto isso não for resolvido. */
  bloqueiaTudo: boolean;
}

/**
 * As lacunas da loja, na ordem em que resolvê-las produz resultado.
 *
 * Devolve `[]` quando não há nada travado — e aí a tela diz isso, em vez de
 * inventar tarefa para parecer útil.
 */
export function lacunasDaLoja(e: EstadoDaLoja): Lacuna[] {
  // Sem produto não existe nada para travar. É a única lacuna que se apresenta
  // sozinha: listar "sem peso" numa base vazia seria ruído.
  if (e.produtos <= 0) {
    return [
      {
        tipo: "sem_produtos",
        titulo: "Sua base está vazia",
        trava: "Nada acontece sem produto. Importe do Mercado Livre ou por planilha.",
        quantos: 0,
        href: "/cliente/produtos",
        cta: "Trazer produtos",
        bloqueiaTudo: true,
      },
    ];
  }

  const lacunas: Lacuna[] = [];

  if (!e.conectadoAoMarketplace) {
    lacunas.push({
      tipo: "sem_conexao",
      titulo: "Sua conta do Mercado Livre não está conectada",
      trava:
        "Sem conexão nada vai ao ar, e as taxas de comissão e frete usadas no cálculo não vêm da sua conta real.",
      quantos: 0,
      href: "/cliente/conectar-ml",
      cta: "Conectar",
      bloqueiaTudo: true,
    });
  }

  // ===========================================================================
  // O ANÚNCIO NO AR VEM ANTES DO PRODUTO NA BANCADA
  // ===========================================================================
  //
  // A ordem deste arquivo é "por quanto destrava, não por quantidade", e é ela
  // que põe estas duas aqui, acima de peso e custo.
  //
  // Uma pendência do Mercado Livre é dinheiro JÁ PARADO: o estoque está lá, o
  // anúncio existe, e alguma coisa impede a venda agora. "23 produtos sem peso"
  // é dinheiro que ainda não começou. Mandar a lojista pesar caixa enquanto
  // 2708 peças estão travadas é exatamente o erro que a regra proíbe — o
  // trabalho que não produz resultado visível.
  //
  // NÃO são `bloqueiaTudo`. A loja continua andando: dá para cadastrar, pesar e
  // publicar com pendência aberta. `bloqueiaTudo` é parede — só base vazia e
  // conta desconectada são — e usá-lo aqui faria `aberturaDoHoje` esconder
  // todas as outras lacunas atrás desta.
  if ((e.pendenciasAbertas ?? 0) > 0) {
    const n = e.pendenciasAbertas as number;
    const paradas = e.pecasParadas ?? 0;
    lacunas.push({
      tipo: "pendencias_abertas",
      titulo: `${n} produto(s) com pendência no Mercado Livre`,
      // A consequência é o estoque, não a contagem — e ela só entra quando foi
      // MEDIDA. Sem o número, a frase para de prometer o que não sabe.
      trava:
        paradas > 0
          ? `São ${paradas} peças paradas: o anúncio está no ar e alguma coisa impede a venda agora.`
          : "O anúncio está no ar e alguma coisa impede a venda agora.",
      quantos: n,
      href: "/cliente/pendencias",
      cta: "Ver o que o ML cobra",
      bloqueiaTudo: false,
    });
  }

  // "No ar, sem otimização" é o núcleo do produto NÃO APLICADO: o anúncio está
  // competindo com o texto que veio do ERP, e a esteira nunca o viu. Vem depois
  // da pendência porque pendência impede vender e isto só vende menos.
  if ((e.noArSemOtimizacao ?? 0) > 0) {
    const n = e.noArSemOtimizacao as number;
    lacunas.push({
      tipo: "no_ar_sem_otimizacao",
      titulo: `${n} produto(s) com anúncio no ar sem passar pela IA`,
      trava:
        "Estão competindo com o título e a descrição que vieram de fora. A esteira reescreve os dois a partir do que você já cadastrou.",
      quantos: n,
      href: "/cliente/otimizar",
      cta: "Otimizar",
      bloqueiaTudo: false,
    });
  }

  // Ausência TOTAL e incompletude são consequências diferentes, e juntá-las
  // produzia uma frase falsa (INC-001). Para quem tem alguma variação pesada, o
  // frete SAI — pela maior caixa — e o preço mínimo existe. Dizer que ele "não
  // sai" ensinaria a pessoa a desconfiar da tela quando ela vê o preço aparecer.
  const semPeso = e.produtos - e.comPeso - e.comPesoIncompleto;
  if (semPeso > 0) {
    lacunas.push({
      tipo: "sem_peso",
      titulo: `${semPeso} produto(s) sem peso da caixa`,
      // A consequência é dupla e vale dizer inteira: não é só "falta um campo",
      // é que o preço mínimo NÃO EXISTE sem isso.
      trava:
        "O frete do Mercado Livre é cobrado por peso. Sem ele não há frete, e sem frete o preço mínimo não sai — nem para quem já tem custo.",
      quantos: semPeso,
      href: "/cliente/peso",
      cta: "Informar peso",
      bloqueiaTudo: e.comPeso === 0,
    });
  }

  if (e.comPesoIncompleto > 0) {
    lacunas.push({
      tipo: "peso_incompleto",
      titulo: `${e.comPesoIncompleto} produto(s) com peso só em parte das variações`,
      // O risco aqui não é o preço faltar — é ele sair BAIXO. O frete usa o
      // maior peso conhecido, e o maior conhecido pode não ser o maior real.
      trava:
        "O preço sai, mas o frete é calculado só sobre as variações que têm peso. " +
        "Se as que faltam forem mais pesadas, o preço mínimo fica abaixo do que você paga.",
      quantos: e.comPesoIncompleto,
      href: "/cliente/peso",
      cta: "Completar o peso",
      bloqueiaTudo: false,
    });
  }

  const semCusto = e.produtos - e.comCusto;
  if (semCusto > 0) {
    lacunas.push({
      tipo: "sem_custo",
      titulo: `${semCusto} produto(s) sem custo`,
      trava: "Sem quanto você paga, não dá para dizer se o preço dá lucro nem qual é o piso.",
      quantos: semCusto,
      href: "/cliente/produtos",
      cta: "Importar custos",
      bloqueiaTudo: false,
    });
  }

  const semFoto = e.produtos - e.comFoto;
  if (semFoto > 0) {
    lacunas.push({
      tipo: "sem_foto",
      titulo: `${semFoto} produto(s) sem foto`,
      trava: "O Mercado Livre não aceita anúncio sem imagem.",
      quantos: semFoto,
      href: "/cliente/imagens",
      cta: "Enviar fotos",
      bloqueiaTudo: false,
    });
  }

  const semAnuncio = e.produtos - e.comAnuncio;
  if (semAnuncio > 0) {
    lacunas.push({
      tipo: "sem_anuncio",
      titulo: `${semAnuncio} produto(s) ainda sem anúncio`,
      trava: "A IA escreve título, descrição e ficha técnica a partir do que você já cadastrou.",
      quantos: semAnuncio,
      href: "/cliente/anunciar",
      cta: "Criar anúncio",
      bloqueiaTudo: false,
    });
  }

  if (e.aguardandoAprovacao > 0) {
    lacunas.push({
      tipo: "para_aprovar",
      titulo: `${e.aguardandoAprovacao} anúncio(s) esperando seu aval`,
      trava: "Nada vai ao ar sem você ler e aprovar.",
      quantos: e.aguardandoAprovacao,
      href: "/cliente/anuncios",
      cta: "Revisar",
      bloqueiaTudo: false,
    });
  }

  if (e.aprovadosNaoPublicados > 0) {
    lacunas.push({
      tipo: "para_publicar",
      titulo: `${e.aprovadosNaoPublicados} anúncio(s) prontos para publicar`,
      trava: "Estão aprovados e parados. Publicar leva um clique.",
      quantos: e.aprovadosNaoPublicados,
      href: "/cliente/anuncios",
      cta: "Publicar",
      bloqueiaTudo: false,
    });
  }

  return lacunas;
}

/**
 * A loja está sem nada travado?
 *
 * Não confundir com "tudo publicado": significa que não há lacuna conhecida
 * esperando ação do lojista.
 */
export function semLacunas(e: EstadoDaLoja): boolean {
  return lacunasDaLoja(e).length === 0;
}
