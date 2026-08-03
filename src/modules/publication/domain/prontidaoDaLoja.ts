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

export type TipoLacuna =
  | "sem_produtos"
  | "sem_conexao"
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
  /** Anúncios aguardando o aval do lojista. */
  aguardandoAprovacao: number;
  /** Anúncios aprovados e ainda não publicados. */
  aprovadosNaoPublicados: number;
  conectadoAoMarketplace: boolean;
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
