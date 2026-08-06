// As frases que abrem "Vendas" e "Auditoria".
//
// ===========================================================================
// O MESMO DEFEITO, EM DOIS TAMANHOS
// ===========================================================================
//
// Vendas abre com OITO cartões: faturamento, lucro, pedidos, ticket médio,
// taxas do ML, custo dos produtos, unidades vendidas e margem. Um deles —
// "unidades vendidas" — já aparece como dica dentro de "Pedidos": o mesmo
// número duas vezes, com o mesmo peso.
//
// Auditoria abre com SETE: total auditados, críticos, prioridade alta, score
// médio, e três categorias de problema.
//
// Nos dois casos os números estão certos e a leitura fica por conta da lojista.
// Este módulo faz a leitura: qual é o fato, e o que fica em segundo plano.

// ---------------------------------------------------------------------------
// VENDAS — "como está a loja?"
// ---------------------------------------------------------------------------

export interface MetricasDeVenda {
  faturamento: number;
  lucroLiquido: number;
  /** Percentual. Pode ser negativo. */
  margem: number;
  pedidos: number;
  /** 0 a 100 — quantos dos itens vendidos têm custo cadastrado. */
  coberturaCusto: number;
}

export interface ResumoDoPulso {
  frase: string;
  tom: "ruim" | "atencao" | "ok";
  /** A ressalva sobre o que não se sabe. `null` quando se sabe tudo. */
  detalhe: string | null;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * O que aconteceu no período.
 *
 * O LUCRO É A MANCHETE, NÃO O FATURAMENTO. Faturar muito e perder dinheiro é
 * exatamente o que acontece com 17 produtos vendendo abaixo do piso — e um
 * cartão de faturamento em verde, do mesmo tamanho do lucro, conta a metade
 * bonita da história. Quem abre esta tela quer saber se ganhou dinheiro.
 *
 * E A MARGEM ABAIXO DO PISO VENCE O LUCRO POSITIVO: vender com lucro menor do
 * que o mínimo que ela mesma definiu é o fato, mesmo com o número no azul.
 */
export function resumoDasVendas(
  m: MetricasDeVenda,
  pisoDeMargem: number,
  dias: number
): ResumoDoPulso {
  const detalhe =
    m.pedidos > 0 && m.coberturaCusto < 100
      ? `Parcial: só ${m.coberturaCusto}% dos itens vendidos têm custo cadastrado.`
      : null;

  if (m.pedidos === 0) {
    // Oito zeros não são um diagnóstico. Sem venda, a tela diz isso.
    return {
      frase: `Nenhuma venda nos últimos ${dias} dias.`,
      tom: "atencao",
      detalhe: null,
    };
  }

  if (m.lucroLiquido < 0) {
    return {
      frase: `Você perdeu ${brl(Math.abs(m.lucroLiquido))} em ${dias} dias.`,
      tom: "ruim",
      detalhe,
    };
  }

  if (m.margem < pisoDeMargem) {
    return {
      frase: `Lucro de ${brl(m.lucroLiquido)} em ${dias} dias — margem de ${m.margem}%, abaixo do seu piso de ${pisoDeMargem}%.`,
      tom: "atencao",
      detalhe,
    };
  }

  return {
    frase: `Lucro de ${brl(m.lucroLiquido)} em ${dias} dias — margem de ${m.margem}%.`,
    tom: "ok",
    detalhe,
  };
}

// ---------------------------------------------------------------------------
// AUDITORIA — "o que corrigir primeiro?"
// ---------------------------------------------------------------------------

export interface MetricasDeAuditoria {
  total: number;
  criticos: number;
  altas: number;
  seo: number;
  imagem: number;
  preco: number;
}

/**
 * O que a auditoria encontrou.
 *
 * A CATEGORIA DOMINANTE ENTRA NA FRASE, e é ela que muda o que a lojista faz.
 * É a mesma lição da faixa de Anúncios (06/08): "23 produtos com problema"
 * manda abrir 23 telas; "quase tudo é foto" manda chamar um fotógrafo.
 *
 * Empate resolve pela ordem foto → preço → texto: refazer foto é o trabalho
 * mais caro de agendar, então é o que precisa aparecer primeiro para a pessoa
 * poder começar a organizar.
 */
export function resumoDaAuditoria(m: MetricasDeAuditoria): ResumoDoPulso {
  if (m.total === 0) {
    return { frase: "Nenhuma auditoria ainda.", tom: "atencao", detalhe: null };
  }

  const categorias = [
    { nome: "foto", n: m.imagem },
    { nome: "preço", n: m.preco },
    { nome: "texto do anúncio", n: m.seo },
  ];
  const maior = categorias.filter((c) => c.n > 0).sort((a, b) => b.n - a.n)[0];
  const detalhe = maior
    ? `A causa mais comum é ${maior.nome}: ${maior.n} de ${m.total}.`
    : null;

  if (m.criticos > 0) {
    return {
      frase: `${m.criticos} ${m.criticos === 1 ? "produto precisa" : "produtos precisam"} de atenção urgente.`,
      tom: "ruim",
      detalhe,
    };
  }
  if (m.altas > 0) {
    return {
      frase: `${m.altas} ${m.altas === 1 ? "produto tem" : "produtos têm"} prioridade alta.`,
      tom: "atencao",
      detalhe,
    };
  }
  return {
    frase: `Os ${m.total} auditados estão sem urgência.`,
    tom: "ok",
    detalhe,
  };
}
