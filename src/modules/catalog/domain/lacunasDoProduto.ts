// O que falta NESTE produto — puro, sem React, sem banco.
//
// POR QUE ISTO EXISTE
//
// A tela inicial já diz o que falta na LOJA ("70 produtos sem peso"). Mas para
// descobrir quais, e para resolver, o lojista precisava sair da lista e visitar
// outra tela — uma para foto, outra para peso, outra para medidas. Quatro telas
// para responder uma pergunta que a própria lista deveria responder.
//
// É por isso que o Catálogo tinha quatro portas: a lista não era o centro de
// nada, era só um inventário. Colocar a lacuna na linha do produto é o que
// transforma a lista no lugar onde o trabalho acontece — e é o primeiro passo
// real de fundir aquelas telas, porque remove o motivo de existirem separadas.
//
// A ORDEM É POR QUANTO DESTRAVA
//
// A mesma regra da tela inicial: primeiro o que impede tudo, não o que é mais
// fácil. Sem custo e sem peso não há preço mínimo; sem foto não há publicação.
// Listar por ordem alfabética mandaria a pessoa para o trabalho que não produz
// resultado visível, e é assim que se perde a confiança na lista.

export type TipoLacunaProduto = "custo" | "peso" | "foto" | "preco";

export interface LacunaProduto {
  tipo: TipoLacunaProduto;
  /** Duas ou três palavras — cabe numa célula de tabela. */
  rotulo: string;
  /** O que isto impede. Vai no title, para quem quiser saber por quê. */
  impede: string;
  /** Onde se resolve. */
  href: string;
}

export interface EstadoDoProduto {
  custo: number;
  precoVenda: number;
  /** Em gramas, agregado das variantes. 0 = não informado. */
  pesoGramas: number;
  temFoto: boolean;
  /**
   * O vendedor paga o frete? `false` dispensa o peso — sem custo de envio, não
   * faltar peso não impede nada.
   */
  vendedorPagaFrete?: boolean;
}

/**
 * As lacunas deste produto, na ordem em que resolvê-las produz resultado.
 *
 * Devolve `[]` quando não falta nada — e aí a linha mostra que está pronta, em
 * vez de uma célula vazia que se confunde com "não sei".
 */
export function lacunasDoProduto(p: EstadoDoProduto): LacunaProduto[] {
  const lacunas: LacunaProduto[] = [];

  if (!(p.custo > 0)) {
    lacunas.push({
      tipo: "custo",
      rotulo: "custo",
      impede: "Sem o custo não dá para saber se o preço dá lucro nem qual é o piso.",
      href: "/cliente/produtos",
    });
  }

  // Peso só é lacuna quando o frete é custo do lojista. Com o comprador
  // pagando, cobrar esse dado seria pedir algo que nunca vai ser usado.
  if (p.vendedorPagaFrete !== false && !(p.pesoGramas > 0)) {
    lacunas.push({
      tipo: "peso",
      rotulo: "peso",
      impede: "O frete do Mercado Livre é cobrado por peso. Sem ele, não há preço mínimo.",
      href: "/cliente/peso",
    });
  }

  if (!p.temFoto) {
    lacunas.push({
      tipo: "foto",
      rotulo: "foto",
      impede: "O Mercado Livre não aceita anúncio sem imagem.",
      href: "/cliente/imagens",
    });
  }

  if (!(p.precoVenda > 0)) {
    lacunas.push({
      tipo: "preco",
      rotulo: "preço",
      impede: "Sem preço de venda não há o que analisar nem o que publicar.",
      href: "/cliente/precificacao",
    });
  }

  return lacunas;
}

/** Este produto está completo? Serve para a lista mostrar o que já está pronto. */
export function produtoCompleto(p: EstadoDoProduto): boolean {
  return lacunasDoProduto(p).length === 0;
}
