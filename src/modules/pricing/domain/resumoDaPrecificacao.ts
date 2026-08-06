// A frase que abre a tela de Precificação.
//
// ===========================================================================
// O DEFEITO: QUATRO NÚMEROS COM O MESMO PESO
// ===========================================================================
//
// A tela abre com quatro cartões idênticos — Saudável, Atenção, Risco,
// Prejuízo — mesma borda, mesmo fundo, mesmo tamanho. Na conta real: 2 · 6 ·
// **17** · 0.
//
// "Risco 17" e "Prejuízo 0" têm exatamente o mesmo peso visual. Um é o motivo
// de abrir a tela; o outro é boa notícia. Quando os quatro gritam igual, a
// lojista tem que fazer a leitura que a tela deveria ter feito por ela.
//
// ===========================================================================
// E UM SEGUNDO, PIOR: OS QUATRO SOMAM 25 DE 80
// ===========================================================================
//
// 50 dos 80 produtos não têm custo, e sem custo não há margem. Os quatro
// números descrevem UM TERÇO da loja e parecem descrever a loja inteira.
//
// Omitir o que não se sabe é a forma mais silenciosa de mentir num painel — a
// mesma lei da migração 050, aqui aplicada a uma tela: `null` é "não sei", e
// "não sei" tem que aparecer.

export interface ContagemDeSaude {
  Saudável: number;
  Atenção: number;
  Risco: number;
  Prejuízo: number;
}

export interface ResumoDePreco {
  /** O fato principal. Um só. */
  frase: string;
  tom: "ruim" | "atencao" | "ok";
  /** O que NÃO dá para calcular. `null` quando dá para calcular tudo. */
  detalhe: string | null;
  /** Quantos produtos os quatro números realmente descrevem. */
  calculaveis: number;
}

const produtos = (n: number) => `${n} produto${n === 1 ? "" : "s"}`;

/**
 * Monta a abertura da tela.
 *
 * A ORDEM É POR GRAVIDADE, E O ZERO NUNCA VIRA DESTAQUE. Prejuízo vence risco,
 * risco vence atenção. Um balde vazio não tem o que anunciar — dar manchete a
 * "Prejuízo 0" seria transformar boa notícia em alarme, e é assim que a pessoa
 * aprende a ignorar a manchete.
 *
 * O DETALHE NÃO É OPCIONAL quando existe. Ele é o que impede os quatro números
 * de parecerem a loja inteira.
 */
export function resumoDaPrecificacao(
  contagem: ContagemDeSaude,
  semCusto: number,
  total: number
): ResumoDePreco {
  const calculaveis =
    contagem.Saudável + contagem["Atenção"] + contagem.Risco + contagem["Prejuízo"];

  const detalhe =
    semCusto > 0
      ? `De ${produtos(semCusto)} não dá para dizer: falta o custo.`
      : null;

  if (contagem["Prejuízo"] > 0) {
    return {
      frase: `${produtos(contagem["Prejuízo"])} vendem com prejuízo.`,
      tom: "ruim",
      detalhe,
      calculaveis,
    };
  }
  if (contagem.Risco > 0) {
    return {
      frase: `${produtos(contagem.Risco)} vendem abaixo do seu piso.`,
      tom: "atencao",
      detalhe,
      calculaveis,
    };
  }
  if (contagem["Atenção"] > 0) {
    return {
      frase: `${produtos(contagem["Atenção"])} estão perto do seu piso.`,
      tom: "atencao",
      detalhe,
      calculaveis,
    };
  }
  if (calculaveis > 0) {
    return {
      frase: `Os ${calculaveis} que consigo calcular estão saudáveis.`,
      tom: "ok",
      detalhe,
      calculaveis,
    };
  }

  // Nada calculável: a tela não tem número nenhum para dar, e dizer isso é a
  // única resposta honesta. `total` entra aqui porque sem ele a frase seria
  // "não sei de nada" sem dizer de quantos.
  return {
    frase:
      total > 0
        ? `Ainda não consigo calcular a margem de nenhum dos seus ${total} produtos.`
        : "Nenhum produto cadastrado ainda.",
    tom: "atencao",
    detalhe,
    calculaveis: 0,
  };
}
