// A VARREDURA que o assistente não tinha: o que está repetido e o que falta.
//
// ===========================================================================
// POR QUE ISTO EXISTE — a recusa honesta de 19/08/2026
// ===========================================================================
//
// A lojista pediu ao chat: "antes de tudo analise os skus de cada anúncio,
// pois temos alguns que estão repetidos e outros faltando derivações".
//
// O assistente respondeu, corretamente, que não conseguia:
//
//   "eu não tenho uma ferramenta que varra o catálogo inteiro procurando SKUs
//    duplicados ou variações sem SKU de uma vez. Não quero inventar um
//    'escaneei tudo' que a ferramenta não me deu."
//
// Essa recusa é o comportamento certo e foi desenhada de propósito. Mas a
// recusa não era a resposta: o DADO EXISTE — a mesma pergunta, feita em SQL no
// mesmo dia, devolveu 143 EANs repetidos em 296 linhas, 17 deles espalhados por
// produtos DIFERENTES e 9 com SKUs diferentes para o mesmo código de barras.
//
// Faltava ferramenta, não informação. Este módulo é a ferramenta.
//
// ===========================================================================
// POR QUE O EAN É A CHAVE, E NÃO O NOME
// ===========================================================================
//
// O EAN é o código do FABRICANTE. Se ele se repete, é fisicamente o mesmo par
// de sapato — não é semelhança, é identidade.
//
// Isso importa porque o casamento por nome já errou nesta base: em 15/08/2026
// ele colou códigos de um tênis Molekinha num chinelo Modare. Nome é palpite;
// EAN é o fabricante falando.
//
// ===========================================================================
// O QUE ESTE MÓDULO NÃO FAZ
// ===========================================================================
//
// Não decide o que apagar, e a razão é medida. Em 18/08/2026 onze linhas
// pareciam duplicatas do banco e cada uma carregava o MLB de um anúncio VIVO
// DIFERENTE: apagá-las teria deixado 11 anúncios no ar sem variante. O que
// parece linha repetida pode ser anúncio repetido, e o remédio é oposto.
//
// Aqui se RELATA. Quem decide é a lojista.

/** O recorte de variante que a varredura precisa. */
export interface VarianteVarrida {
  id: string;
  sku: string;
  ean: string;
  cor: string;
  tamanho: string;
}

export interface ProdutoVarrido {
  id: string;
  nome: string;
  variantes: readonly VarianteVarrida[];
}

/** Uma linha repetida, com tudo que a lojista precisa para julgar. */
export interface Repeticao {
  /** O valor que se repete — o EAN ou o SKU. */
  valor: string;
  ondes: {
    produtoId: string;
    produto: string;
    varianteId: string;
    cor: string;
    tamanho: string;
    sku: string;
  }[];
  /** Verdadeiro quando o mesmo código aparece em produtos DIFERENTES. */
  entreProdutos: boolean;
  /** Verdadeiro quando o mesmo EAN carrega SKUs diferentes. Sempre é erro. */
  skusDivergentes: boolean;
}

export interface FaltandoNoProduto {
  produtoId: string;
  produto: string;
  semSku: number;
  semEan: number;
  variantes: number;
  /** Até 6 exemplos, para a resposta caber numa frase de chat. */
  exemplos: string[];
}

export interface VarreduraDoCatalogo {
  produtosVarridos: number;
  variantesVarridas: number;
  /** EANs que aparecem em mais de uma variante. */
  eansRepetidos: Repeticao[];
  /** SKUs que aparecem em mais de uma variante. */
  skusRepetidos: Repeticao[];
  /** (cor, tamanho) repetido DENTRO do mesmo produto — o rótulo mudou. */
  corTamanhoRepetido: Repeticao[];
  /** Produtos com variante sem SKU ou sem EAN. */
  faltando: FaltandoNoProduto[];
  totalSemSku: number;
  totalSemEan: number;
  /** Quantas linhas a mais existem por causa de repetição. */
  linhasAMais: number;
}

function limpo(s: string | null | undefined): string {
  return (s ?? "").trim();
}

/**
 * A chave de (cor, tamanho): acentos e pontuação fora, dígitos preservados.
 *
 * `39.0 BR`, `39,0 BR` e `39 BR` são o mesmo pé com rótulos diferentes — foi
 * assim que o mesmo tamanho entrou duas vezes no Zaxy Air. Mas `39 - 40` NÃO
 * entra junto: dois números é a faixa, o par, e colapsar os dois esconderia
 * uma diferença real de produto.
 */
function chaveCorTamanho(cor: string, tamanho: string): string {
  const norm = (s: string) =>
    limpo(s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const digitos = (limpo(tamanho).match(/\d+/g) ?? []).join("-");
  return `${norm(cor)}|${digitos || norm(tamanho)}`;
}

function montarRepeticoes(
  chaveDe: (v: VarianteVarrida) => string,
  produtos: readonly ProdutoVarrido[],
  dentroDoProduto: boolean
): Repeticao[] {
  const mapa = new Map<string, Repeticao["ondes"]>();
  for (const p of produtos) {
    for (const v of p.variantes) {
      const k = chaveDe(v);
      if (!k) continue;
      const escopo = dentroDoProduto ? `${p.id}::${k}` : k;
      const lista = mapa.get(escopo) ?? [];
      lista.push({
        produtoId: p.id,
        produto: p.nome,
        varianteId: v.id,
        cor: limpo(v.cor),
        tamanho: limpo(v.tamanho),
        sku: limpo(v.sku),
      });
      mapa.set(escopo, lista);
    }
  }

  const saida: Repeticao[] = [];
  for (const [escopo, ondes] of mapa) {
    if (ondes.length < 2) continue;
    const skus = new Set(ondes.map((o) => o.sku).filter(Boolean));
    saida.push({
      valor: dentroDoProduto ? escopo.split("::")[1] : escopo,
      ondes,
      entreProdutos: new Set(ondes.map((o) => o.produtoId)).size > 1,
      skusDivergentes: skus.size > 1,
    });
  }

  // A ORDEM É A GRAVIDADE, não o alfabeto.
  //
  // O mesmo EAN com SKUs diferentes é sempre erro: um dos dois códigos está
  // errado e vai para o estoque dela. Em seguida vem o mesmo código em produtos
  // diferentes, que é confusão de cadastro. Só depois o resto, que costuma ser
  // rótulo de tamanho.
  return saida.sort(
    (a, b) =>
      Number(b.skusDivergentes) - Number(a.skusDivergentes) ||
      Number(b.entreProdutos) - Number(a.entreProdutos) ||
      b.ondes.length - a.ondes.length ||
      a.valor.localeCompare(b.valor)
  );
}

/** A varredura inteira. Pura: nada de rede, nada de banco. */
export function varrerCatalogo(produtos: readonly ProdutoVarrido[]): VarreduraDoCatalogo {
  const eansRepetidos = montarRepeticoes((v) => limpo(v.ean), produtos, false);
  const skusRepetidos = montarRepeticoes((v) => limpo(v.sku), produtos, false);
  const corTamanhoRepetido = montarRepeticoes(
    (v) => chaveCorTamanho(v.cor, v.tamanho),
    produtos,
    true
  );

  const faltando: FaltandoNoProduto[] = [];
  let totalSemSku = 0;
  let totalSemEan = 0;
  let variantesVarridas = 0;
  for (const p of produtos) {
    const semSku = p.variantes.filter((v) => !limpo(v.sku));
    const semEan = p.variantes.filter((v) => !limpo(v.ean));
    variantesVarridas += p.variantes.length;
    totalSemSku += semSku.length;
    totalSemEan += semEan.length;
    if (semSku.length === 0 && semEan.length === 0) continue;
    faltando.push({
      produtoId: p.id,
      produto: p.nome,
      semSku: semSku.length,
      semEan: semEan.length,
      variantes: p.variantes.length,
      exemplos: semSku
        .slice(0, 6)
        .map((v) => `${limpo(v.cor)} ${limpo(v.tamanho)}`.trim())
        .filter(Boolean),
    });
  }
  faltando.sort((a, b) => b.semSku - a.semSku || b.semEan - a.semEan);

  const linhasAMais = eansRepetidos.reduce((t, r) => t + r.ondes.length - 1, 0);

  return {
    produtosVarridos: produtos.length,
    variantesVarridas,
    eansRepetidos,
    skusRepetidos,
    corTamanhoRepetido,
    faltando,
    totalSemSku,
    totalSemEan,
    linhasAMais,
  };
}

/**
 * A FRASE. Sem ela o modelo recebe listas e inventa a leitura delas.
 *
 * Ela diz o que foi VARRIDO antes do que foi achado: "nada repetido" só é uma
 * afirmação legítima quando se sabe sobre quantos itens ela vale.
 */
export function fraseDaVarredura(v: VarreduraDoCatalogo): string {
  const base = `Varri ${v.variantesVarridas} variações em ${v.produtosVarridos} produtos.`;
  const partes: string[] = [];

  const graves = v.eansRepetidos.filter((r) => r.skusDivergentes);
  if (graves.length > 0) {
    partes.push(
      `${graves.length} código(s) de barras têm SKUs DIFERENTES — um dos dois está errado`
    );
  }
  const entre = v.eansRepetidos.filter((r) => r.entreProdutos && !r.skusDivergentes);
  if (entre.length > 0) {
    partes.push(`${entre.length} código(s) de barras aparecem em produtos diferentes`);
  }
  const rotulo = v.corTamanhoRepetido.length;
  if (rotulo > 0) {
    partes.push(`${rotulo} cor+tamanho repetidos dentro do mesmo produto (rótulo mudou)`);
  }
  if (v.skusRepetidos.length > 0) {
    partes.push(`${v.skusRepetidos.length} SKU(s) em mais de uma variação`);
  }
  if (v.totalSemSku > 0) partes.push(`${v.totalSemSku} variação(ões) sem SKU`);
  if (v.totalSemEan > 0) partes.push(`${v.totalSemEan} sem código de barras`);

  if (partes.length === 0) {
    return `${base} Nada repetido e nada faltando.`;
  }
  return `${base} ${partes.join("; ")}.`;
}
