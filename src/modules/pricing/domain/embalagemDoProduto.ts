// A embalagem de um produto, a partir das variantes dele.
//
// ===========================================================================
// POR QUE ESTE ARQUIVO EXISTE
// ===========================================================================
//
// Esta função vivia privada em `lib/services/precificacaoDoCopilot.ts`. Ela foi
// MOVIDA para cá — não copiada — porque a consequência de um lote de peso
// precisa aplicá-la duas vezes: uma sobre o estado ANTES da escrita e outra
// sobre o de DEPOIS.
//
// Duas implementações da mesma semântica divergiriam, e a divergência apareceria
// como um número errado num cartão que o lojista lê como fato. Uma cópia aqui
// seria o defeito que a própria vertical existe para impedir.
//
// O corpo é idêntico ao que estava no serviço. `embalagemDoProduto.test.ts`
// congela a semântica atual — inclusive as duas partes contraintuitivas dela,
// que estão documentadas abaixo.
//
// ===========================================================================
// A SEMÂNTICA, com as duas surpresas
// ===========================================================================
//
// 1. É O MÁXIMO ENTRE AS VARIANTES, não uma soma nem uma média. Faz sentido para
//    frete: o que vai na caixa é uma unidade, e a mais pesada define o pior caso.
//
// 2. BASTA UM CAMPO. A embalagem existe se QUALQUER um entre peso, altura,
//    largura e comprimento for maior que zero — não é preciso ter os quatro,
//    nem sequer ter peso.
//
// A consequência dessas duas juntas é o que falsificou o desenho anterior desta
// vertical: um produto com CINCO variantes, das quais só UMA tem peso, JÁ TEM
// embalagem. Ele entra no escopo do lote (que seleciona por "tem variante sem
// peso") e mesmo assim NUNCA esteve bloqueado por peso. Contá-lo como
// desbloqueado seria atribuir à operação um efeito que ela não teve.

/** Só o que a embalagem precisa da variante. Estrutural de propósito: qualquer
 *  linha com estes quatro campos serve, venha do banco ou de um teste. */
export interface MedidasDaVariante {
  peso: number | null;
  altura: number | null;
  largura: number | null;
  comprimento: number | null;
}

export interface EmbalagemDoProduto {
  pesoGramas: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
}

/**
 * A embalagem, ou `null` quando não há medida nenhuma.
 *
 * `null` é o que faz `envioDoModelo` devolver `null`, que é o que `avaliar`
 * traduz no bloqueio "o peso da embalagem". É esta função, portanto, que decide
 * se um produto está ou não bloqueado por peso.
 */
export function embalagemDe(
  variantes: readonly MedidasDaVariante[]
): EmbalagemDoProduto | null {
  const maior = (campo: keyof MedidasDaVariante) =>
    variantes.reduce((m, v) => Math.max(m, Number(v[campo] ?? 0)), 0);
  const e = {
    // A coluna guarda KG; o domínio de envio fala GRAMAS.
    pesoGramas: Math.round(maior("peso") * 1000),
    alturaCm: maior("altura"),
    larguraCm: maior("largura"),
    comprimentoCm: maior("comprimento"),
  };
  const temAlgo =
    e.pesoGramas > 0 || e.alturaCm > 0 || e.larguraCm > 0 || e.comprimentoCm > 0;
  return temAlgo ? e : null;
}
