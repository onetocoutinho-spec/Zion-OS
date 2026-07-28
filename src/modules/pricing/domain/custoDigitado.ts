// Ler um custo que uma PESSOA digitou — puro, sem React, sem rede.
//
// POR QUE ISTO EXISTE
//
// O custo entrava por um caminho só: a planilha. Quando a planilha não casava,
// não sobrava saída nenhuma — 26 produtos ficaram sem custo porque o título de
// marketing do Mercado Livre ("Chinelo Havaianas Masculino Top Max Comfort
// Original") não se parece o bastante com o nome do ERP ("CHINELO HAVAIANAS TOP
// MAX COMFORT"): 71% de semelhança, abaixo do limiar de 85%.
//
// Baixar o limiar não é a saída — foi assim que o custo de um sapato foi parar
// em outro modelo, com 83%. A saída é a pessoa poder digitar.
//
// MAS DIGITAR REABRE A PORTA QUE A CONFERÊNCIA FECHOU
//
// A importação já aprendeu a não gravar em silêncio: um chinelo ficou com
// R$ 30.277.872,00 de custo, com selo de "confiança alta", porque a coluna que
// caiu embaixo de CUSTO era a REFERÊNCIA do modelo. Uma caixa de texto vazia é
// exatamente onde esse mesmo erro volta — só que agora digitado à mão, e sem
// nenhuma planilha para culpar.
//
// Por isso este módulo não devolve um número: devolve um ESTADO. O que é
// claramente inválido não passa; o que é apenas estranho passa, mas depois de a
// pessoa confirmar que é aquilo mesmo. Recusar sozinho seria arrogante — existe
// queima de estoque abaixo do custo, e existe produto caro de verdade.

/** O sinal de que um número grande é código de modelo, não dinheiro. */
const DIGITOS_DE_REFERENCIA = 4;

/**
 * Quantas vezes o preço de venda um custo pode valer antes de ser estranho.
 *
 * Cem vezes é folgado de propósito. O caso real que motivou — R$ 30 milhões num
 * chinelo de R$ 30 — passa de um milhão de vezes; um erro de digitação comum
 * (ponto no lugar da vírgula) passa de cem. No meio ficam os casos legítimos,
 * como um produto ainda sem preço cadastrado, e esses não são incomodados.
 */
const VEZES_O_PRECO = 100;

export type CustoDigitado =
  /** Campo em branco — não é erro, é "deixa como está". */
  | { estado: "vazio" }
  /** Não dá para gravar. `motivo` é o que a pessoa lê. */
  | { estado: "invalido"; motivo: string }
  /** Dá para gravar, mas cheira mal. Só depois de confirmar. */
  | { estado: "suspeito"; valor: number; motivo: string }
  | { estado: "ok"; valor: number };

export interface ContextoDoCusto {
  /** Preço de venda do produto. 0 = ainda não se sabe, e aí não há com o que comparar. */
  precoVenda: number;
  /** O nome do produto — é nele que a referência de modelo se denuncia. */
  nome: string;
}

/**
 * Lê "12,50" / "12.50" / "R$ 1.234,56" / "1.234" → número. PURA.
 *
 * A armadilha é o PONTO sem vírgula: "1.234" pode ser mil duzentos e trinta e
 * quatro (padrão brasileiro) ou um vírgula duzentos e trinta e quatro (padrão
 * americano). A regra que distingue com segurança é a do separador de milhar:
 * ele SEMPRE agrupa de três em três. Então ".234" é milhar e ".90" é decimal.
 *
 * Errar isso lia R$ 1.234 como R$ 1,23 — custo mil vezes menor, e a margem
 * aparecia absurdamente positiva sem ninguém desconfiar.
 *
 * Estava em `lib/services/importacaoCustos`. Mudou de casa quando o custo passou
 * a entrar por dois caminhos (planilha e teclado): regra que dois caminhos usam
 * mora no domínio, senão um dos dois acaba com uma cópia que envelhece sozinha.
 */
export function parseNumeroCusto(s: string): number {
  const t = (s ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!t) return 0;

  let normalizado: string;
  if (t.includes(",")) {
    // Com vírgula presente, ela é o decimal e o ponto é milhar. Sem ambiguidade.
    normalizado = t.replace(/\./g, "").replace(",", ".");
  } else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) {
    // Só pontos, todos agrupando de 3 em 3 → separador de milhar.
    //
    // O primeiro grupo não pode começar com zero: ninguém escreve "0.850" para
    // oitocentos e cinquenta. Sem essa guarda, um custo de R$ 0,850 virava
    // R$ 850 — mil vezes maior, e o preço mínimo junto.
    normalizado = t.replace(/\./g, "");
  } else {
    // Um ponto com 1, 2 ou 4+ dígitos depois → decimal.
    normalizado = t;
  }
  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : 0;
}

/**
 * O que foi digitado é o código do modelo que está no nome do produto?
 *
 * Compara o TEXTO CRU, não os dígitos — e é essa escolha que evita o falso
 * positivo. Um custo de R$ 17,16 tem os mesmos dígitos que a referência 1716;
 * comparar por dígitos acusaria um custo perfeitamente normal e ensinaria a
 * pessoa a ignorar o aviso. Já quem copia a referência copia "6371.367"
 * inteiro, com pontuação e tudo, e é assim que ela se denuncia.
 *
 * Mesma regra de `catalog/domain/mapeamentoPlanilha.ehReferenciaDisfarcada`,
 * escrita aqui de novo em vez de importada: são dois módulos sem dependência um
 * do outro, e três linhas custam menos que um ciclo entre eles.
 */
export function pareceReferenciaDeModelo(digitado: string, nome: string): boolean {
  const valor = (digitado ?? "").trim();
  const digitos = (valor.match(/\d+/g) ?? []).join("");
  if (digitos.length < DIGITOS_DE_REFERENCIA) return false;
  return (nome ?? "").includes(valor);
}

/**
 * O que fazer com o que a pessoa digitou.
 *
 * A ordem das checagens é a ordem do que EXPLICA melhor. Um número que é a
 * referência do modelo também costuma ser absurdamente maior que o preço — mas
 * dizer "é o código que está no nome" resolve a dúvida, e dizer "é cem vezes o
 * preço" só a nomeia.
 */
export function lerCustoDigitado(texto: string, ctx: ContextoDoCusto): CustoDigitado {
  const cru = (texto ?? "").trim();
  if (!cru) return { estado: "vazio" };

  if (!/\d/.test(cru)) {
    return { estado: "invalido", motivo: "Digite um valor em reais — por exemplo 36,19." };
  }

  const valor = parseNumeroCusto(cru);

  if (!(valor > 0)) {
    // Zero é "não sei", não "de graça". Tratar um como o outro foi o que fez a
    // tela mostrar lucro de R$ 85 em produto sem custo cadastrado.
    return {
      estado: "invalido",
      motivo: "Custo zero não é custo de graça — é custo desconhecido. Deixe em branco se ainda não souber.",
    };
  }

  if (pareceReferenciaDeModelo(cru, ctx.nome)) {
    return {
      estado: "suspeito",
      valor,
      motivo: "Esse número é o código do modelo que aparece no nome do produto. Isso é referência, não dinheiro.",
    };
  }

  if (ctx.precoVenda > 0 && valor > ctx.precoVenda * VEZES_O_PRECO) {
    return {
      estado: "suspeito",
      valor,
      motivo: `Mais de ${VEZES_O_PRECO} vezes o preço de venda. Confira se o ponto não entrou no lugar da vírgula.`,
    };
  }

  if (ctx.precoVenda > 0 && valor >= ctx.precoVenda) {
    // Não é erro: queima de estoque existe. Mas ninguém quer descobrir isso
    // pela margem negativa três telas adiante.
    return {
      estado: "suspeito",
      valor,
      motivo: "O custo ficou igual ou maior que o preço de venda — este produto sairia no prejuízo.",
    };
  }

  return { estado: "ok", valor };
}

/**
 * O valor gravado, do jeito que se digita de volta.
 *
 * Existe para a caixa abrir com o que já está lá em vez de vazia: campo vazio
 * sobre um custo existente parece "não tem custo", e a pessoa redigita um número
 * que já estava certo.
 */
export function paraEdicao(custo: number): string {
  if (!(custo > 0)) return "";
  return custo.toFixed(2).replace(".", ",");
}
