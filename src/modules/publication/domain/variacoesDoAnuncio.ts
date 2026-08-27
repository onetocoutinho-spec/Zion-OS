// A grade do anúncio vem da BASE, nunca do modelo — puro, sem rede, sem React.
//
// POR QUE ISTO EXISTE
//
// A esteira pedia `variacoes` como saída da IA, com `cor`, `tamanho`, `sku`,
// `ean`, `estoque` e `preco` todos marcados `required` no schema. E o que ela
// mandava para o modelo era o NOME do produto e um dossiê de texto — nenhuma
// variação de verdade.
//
// Um campo obrigatório sem fonte tem uma saída só. O modelo preencheu:
//
//   Babuche Molekinha Arco Iris 22591.408
//     base:    6 variações, cor "Branco",  tamanhos 25/26…35/36, SKU 01040525…
//     anúncio: 6 variações, cor "Arco Iris", tamanhos 19/20…29/30, SKU
//              "22591.408-ARCOIRIS-19/20", estoque "15" em todas
//
//   Chinelo Havaianas Slim Liso
//     base:    cores Rosa, Bege e Preto — 6 variações
//     anúncio: 5 variações, TODAS "Preto", SKU "HAVASLIMLISO-PR-3334"
//
// "Arco Iris" saiu do nome do produto, não da variação. Os SKUs foram
// sintetizados no padrão marca-modelo-cor-tamanho — eles PARECEM SKUs, e é
// exatamente isso que os torna perigosos. Publicado assim, entra pedido de um
// SKU que não existe no ERP e ninguém sabe o que despachar: quebra o pós-venda,
// não só o anúncio.
//
// A CORREÇÃO NÃO É PEDIR PARA O MODELO NÃO INVENTAR
//
// É não pedir. Identidade — cor, tamanho, SKU, EAN, estoque — é DADO: sai da
// base ou não sai. Onde falta, sai marcado, e a marca vira pendência que trava
// o A10. É a mesma regra que já governa o preço em `pricing/domain`: onde falta
// dado, o resultado é null; nunca uma estimativa com cara de fato.
//
// O que o modelo escreve continua sendo dele: título, descrição, FAQ, ficha
// técnica, prompts de imagem. É onde ele é bom de verdade.

/** O que uma variação da base traz. Só o que a grade do anúncio precisa. */
export interface VarianteDaBase {
  cor: string;
  tamanho: string;
  sku: string;
  ean: string;
  estoque: number;
  /** Preço próprio da variação. 0 = usa o preço do produto pai. */
  precoBase: number;
}

/** Uma linha da grade do anúncio, do jeito que a tela e o ML esperam. */
export interface VariacaoDoAnuncio {
  cor: string;
  tamanho: string;
  sku: string;
  ean: string;
  estoque: string;
  preco: string;
  obs: string;
}

/**
 * A marca de ausência. É a MESMA string que a esteira já usava para o EAN —
 * reaproveitada de propósito: o consolidador de pendências procura por ela, e
 * inventar um segundo jeito de dizer "falta" faria metade das lacunas sumir do
 * relatório.
 */
export const FALTA = "⚠️ informação necessária";

const marcar = (campo: string) => `${FALTA}: ${campo}`;

/** Texto não-vazio, ou a marca de ausência. */
function ou(valor: string | undefined | null, campo: string): string {
  const t = (valor ?? "").trim();
  return t ? t : marcar(campo);
}

/**
 * A grade do anúncio, montada da base.
 *
 * Sem variação nenhuma devolve `[]` — e isso é honesto: produto sem grade
 * cadastrada não tem grade. Inventar uma linha "padrão" aqui seria repetir, em
 * código, o erro que o modelo cometia.
 *
 * `estoque` zero sai como zero, não como ausente: zero é um fato (esgotado), e
 * tratá-lo como desconhecido esconderia justamente o que precisa ser visto.
 * Já o preço zero é ausência — produto sem preço não tem preço "de graça".
 */
export function montarVariacoes(
  variantes: readonly VarianteDaBase[],
  precoDoProduto: number
): VariacaoDoAnuncio[] {
  return variantes.map((v) => {
    const preco = v.precoBase > 0 ? v.precoBase : precoDoProduto;
    return {
      cor: ou(v.cor, "cor da variação"),
      tamanho: ou(v.tamanho, "tamanho da variação"),
      sku: ou(v.sku, "SKU da variação"),
      ean: ou(v.ean, "EAN da variação"),
      estoque: Number.isFinite(v.estoque) ? String(v.estoque) : marcar("estoque da variação"),
      preco: preco > 0 ? preco.toFixed(2) : marcar("preço de venda"),
      obs: "",
    };
  });
}

/**
 * As pendências que a grade revela, sem repetir a mesma frase por variação.
 *
 * Um produto de 26 variações sem EAN geraria 26 linhas idênticas de pendência,
 * e uma lista assim não é lida — ela é ignorada. Uma linha por CAMPO, dizendo
 * em quantas variações falta, é o que se consegue agir em cima.
 *
 * A ausência da grade inteira é a primeira da lista, porque é a que impede
 * todas as outras: sem variação cadastrada não há o que faltar dentro dela.
 */
export function pendenciasDaGrade(variacoes: readonly VariacaoDoAnuncio[]): string[] {
  if (variacoes.length === 0) {
    return [
      `${FALTA}: grade de variações do produto (cor, tamanho, SKU, EAN e estoque de cada uma).`,
    ];
  }

  // O EAN NÃO ESTÁ AQUI, E ISSO FOI MEDIDO — 27/08/2026.
  //
  // Estes campos TRAVAM a publicação: sem cor, tamanho, SKU, estoque ou preço, o
  // anúncio não sobe. O EAN não trava, e o próprio Mercado Livre diz isso:
  //
  //     GET /categories/MLB273770/attributes
  //     GTIN: required=false · catalog_required=false · conditional_required
  //     EMPTY_GTIN_REASON: "O produto não tem código cadastrado", ...
  //
  // Ou seja: o ML aceita publicar sem código de barras, declarando o motivo. Os
  // obrigatórios da categoria são outros seis (BRAND, MODEL, GENDER, COLOR,
  // SIZE, FOOTWEAR_TYPE) e GTIN não é um deles.
  //
  // Enquanto ele estava nesta lista, um produto pronto era reprovado por 2 EANs
  // faltando em 15 variações — nota 86, tudo no lugar, barrado por uma exigência
  // que o marketplace não faz. É a mesma forma do INC-011: cobrar o que o ML não
  // cobra.
  //
  // O EAN ausente vira SUGESTÃO, em `sugestoesDaGrade`: conselho, nunca trava.
  const campos: { chave: keyof VariacaoDoAnuncio; nome: string }[] = [
    { chave: "cor", nome: "cor" },
    { chave: "tamanho", nome: "tamanho" },
    { chave: "sku", nome: "SKU" },
    { chave: "estoque", nome: "estoque" },
    { chave: "preco", nome: "preço" },
  ];

  const pendencias: string[] = [];
  for (const { chave, nome } of campos) {
    const faltando = variacoes.filter((v) => String(v[chave]).startsWith(FALTA)).length;
    if (faltando === 0) continue;
    pendencias.push(
      faltando === variacoes.length
        ? `${FALTA}: ${nome} — nenhuma das ${variacoes.length} variações tem.`
        : `${FALTA}: ${nome} — falta em ${faltando} de ${variacoes.length} variações.`
    );
  }
  return pendencias;
}

/**
 * O que MELHORARIA a grade, sem impedir a publicação.
 *
 * Hoje é só o EAN. Ele não é obrigatório em nenhuma das categorias medidas — o
 * ML o marca como `conditional_required` e oferece `EMPTY_GTIN_REASON` como
 * alternativa. Então a ausência dele é conselho, e o conselho diz o que fazer:
 * ou trazer o código do ERP, ou declarar o motivo na publicação.
 */
export function sugestoesDaGrade(variacoes: readonly VariacaoDoAnuncio[]): string[] {
  if (variacoes.length === 0) return [];
  const faltando = variacoes.filter((v) => String(v.ean).startsWith(FALTA)).length;
  if (faltando === 0) return [];
  const quantas =
    faltando === variacoes.length
      ? `nenhuma das ${variacoes.length} variações tem`
      : `falta em ${faltando} de ${variacoes.length} variações`;
  return [
    `EAN (código de barras): ${quantas}. Não impede publicar — o Mercado Livre ` +
      `aceita o motivo no lugar do código ("O produto não tem código cadastrado"). ` +
      `Com o EAN, o anúncio ganha o catálogo do ML e aparece em mais buscas.`,
  ];
}

/**
 * A grade cabe num anúncio publicável?
 *
 * Só quando existe e nenhum campo de identidade falta. Serve para o veredito:
 * um anúncio com grade incompleta não pode sair como "aprovado", por melhor que
 * esteja o texto — e era o texto bom que fazia o problema passar despercebido.
 */
export function gradePublicavel(variacoes: readonly VariacaoDoAnuncio[]): boolean {
  return variacoes.length > 0 && pendenciasDaGrade(variacoes).length === 0;
}

/**
 * O resumo da grade REAL para o briefing do modelo.
 *
 * O modelo continua precisando conhecer a grade — é dela que saem a tabela de
 * medidas e o "como medir". Ele só não a escreve mais. Sem isto, a tabela de
 * medidas do Babuche saiu com 19/20 a 29/30 enquanto a base tem 25/26 a 35/36:
 * o texto certo para o produto errado.
 */
export function briefingDaGrade(variacoes: readonly VariacaoDoAnuncio[]): string {
  const REGRA =
    "NÃO escreva a lista de variações e NÃO liste pendências sobre cor, tamanho, SKU, EAN, " +
    "estoque ou preço de variação: a grade é montada do cadastro e já reporta o que falta nela. " +
    "Pendência sua é só sobre o que VOCÊ não conseguiu escrever (material, medida, foto, atributo).";

  if (variacoes.length === 0) {
    return `GRADE REAL: nenhuma variação cadastrada para este produto.\n${REGRA}`;
  }

  const lista = (chave: keyof VariacaoDoAnuncio) =>
    [...new Set(variacoes.map((v) => String(v[chave])).filter((x) => !x.startsWith(FALTA)))];

  const cores = lista("cor");
  const tamanhos = lista("tamanho");
  // Dizer que SKU e EAN JÁ ESTÃO resolvidos é o que impede a pendência falsa.
  // Sem isto o modelo pedia "SKU para a variação 25/26" de um produto cujo SKU
  // está no cadastro — e pendência falsa trava a publicação para sempre, porque
  // publicar exige a lista vazia.
  const temSku = variacoes.filter((v) => !v.sku.startsWith(FALTA)).length;
  const temEan = variacoes.filter((v) => !v.ean.startsWith(FALTA)).length;
  const situacao = (quantos: number, campo: string) =>
    quantos === variacoes.length
      ? `- ${campo}: já cadastrado nas ${variacoes.length} variações — não peça.`
      : quantos === 0
        ? `- ${campo}: ausente em todas. Já está reportado; não repita.`
        : `- ${campo}: cadastrado em ${quantos} de ${variacoes.length}. Já está reportado; não repita.`;

  return [
    `GRADE REAL (${variacoes.length} variações cadastradas no Zion OS):`,
    `- Cores: ${cores.length > 0 ? cores.join(", ") : "não cadastradas"}`,
    `- Tamanhos: ${tamanhos.length > 0 ? tamanhos.join(", ") : "não cadastrados"}`,
    situacao(temSku, "SKU"),
    situacao(temEan, "EAN"),
    "Use SOMENTE estes valores em tabela de medidas, descrição e ficha técnica.",
    REGRA,
  ].join("\n");
}
