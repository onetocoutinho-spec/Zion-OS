// As pendências do catálogo, uma a uma, com alvo real.
//
// POR QUE ISTO EXISTE, se `lacunasDaLoja` e `lacunasDoProduto` já existem
//
// Aquelas duas respondem "quantos" e "o que falta aqui". Nenhuma das duas tem
// ALVO ENDEREÇÁVEL: "43 produtos sem custo" não diz quais, e "falta peso" na
// linha de um produto não diz quais das 39 variantes. Sem alvo não dá para
// preparar correção, agrupar decisão nem montar Proposal — que é tudo o que
// esta vertical precisa fazer.
//
// Então este módulo NÃO é uma taxonomia nova. Ele é o mesmo conjunto de
// lacunas, com o alvo dentro:
//
//   lacunasDoProduto -> custo, peso, foto, preco     (produto)
//   este módulo      -> as mesmas, MAIS peso por VARIANTE, sku e ean
//
// `sku` e `ean` entram porque a unidade deles é a variante e nenhuma das duas
// funções anteriores desce até lá — e é lá que a conciliação com o ERP quebra.
//
// O QUE BLOQUEIA O QUÊ usa `Capacidade` — "precificar" | "anunciar" |
// "publicar" — que é a lista que `perguntaDaOperacao` já usa para responder
// "por que não consigo X?". Inventar uma segunda escala de estágios criaria
// duas respostas para a mesma pergunta.

import type { Capacidade } from "../../assistant/domain/perguntaDaOperacao";

/**
 * O que falta. Reusa os tipos de `lacunasDoProduto` e desce até a variante.
 *
 * `peso_variante` é separado de `peso` de propósito: são consequências
 * diferentes. Sem peso NENHUM o frete não sai; sem peso em PARTE das variantes
 * o frete sai pela maior conhecida — e pode sair barato demais (INC-001).
 */
export type TipoDePendencia =
  | "custo"
  | "preco"
  | "peso"
  | "peso_variante"
  | "foto"
  | "sku_variante"
  | "ean_variante";

export interface AlvoDaPendencia {
  tipo: "produto" | "variante";
  id: string;
  /** Como ele aparece para quem lê. Nunca um uuid solto. */
  rotulo: string;
  /** O produto pai. Igual a `id` quando o alvo É o produto. */
  produtoId: string;
}

export interface PendenciaDoCatalogo {
  tipo: TipoDePendencia;
  alvo: AlvoDaPendencia;
  /** O que isto impede, na voz de quem vai resolver. */
  impede: string;
  /** Quais capacidades da loja ficam travadas por causa dela. */
  bloqueia: readonly Capacidade[];
}

/**
 * O produto e as variantes dele, no mínimo que a análise precisa.
 *
 * Campos MEDIDOS, nunca deduzidos. `pesoGramas` da variante é o dela, não o
 * maior do produto: a pergunta aqui é "esta variante tem peso?", e o maior do
 * produto responderia "sim" para uma variante vazia.
 */
export interface VarianteParaAnalise {
  id: string;
  sku: string;
  ean: string;
  cor: string;
  tamanho: string;
  /** Em GRAMAS. 0 = não informado. */
  pesoGramas: number;
}

export interface ProdutoParaAnalise {
  id: string;
  nome: string;
  marca: string;
  /** A referência do lojista. É a chave EXATA de agrupamento entre produtos. */
  modelo: string;
  custo: number;
  precoVenda: number;
  temFoto: boolean;
  /** `false` dispensa o peso: sem custo de envio, faltar peso não impede nada. */
  vendedorPagaFrete?: boolean;
  variantes: readonly VarianteParaAnalise[];
}

/** Quais capacidades cada tipo trava. A ordem importa: a primeira é a mais cedo. */
const BLOQUEIOS: Record<TipoDePendencia, readonly Capacidade[]> = {
  // Sem custo não há margem nem piso — e sem piso não há decisão de preço.
  custo: ["precificar"],
  // Sem preço não há anúncio publicável.
  preco: ["precificar", "anunciar", "publicar"],
  // Sem peso nenhum o frete não sai, e sem frete o piso não existe.
  peso: ["precificar"],
  // Com peso parcial o frete SAI — pela maior variante conhecida. Não trava a
  // capacidade; distorce o número. Por isso lista vazia e não `["precificar"]`:
  // dizer que trava seria a mesma frase falsa do INC-001.
  peso_variante: [],
  // O Mercado Livre recusa anúncio sem imagem.
  foto: ["publicar"],
  // SKU e EAN não impedem publicar — impedem conciliar. A consequência é real e
  // não é de publicação, então não se inventa um bloqueio para ela.
  sku_variante: [],
  ean_variante: [],
};

const IMPEDE: Record<TipoDePendencia, string> = {
  custo: "Sem o custo não dá para saber se o preço dá lucro nem qual é o piso.",
  preco: "Sem preço de venda não há o que analisar nem o que publicar.",
  peso: "O frete do Mercado Livre é cobrado por peso. Sem ele, não há preço mínimo.",
  peso_variante:
    "O frete sai pela maior variante que tem peso. Se as que faltam forem mais pesadas, o preço mínimo fica abaixo do que você paga.",
  foto: "O Mercado Livre não aceita anúncio sem imagem.",
  sku_variante: "Sem SKU na variante o estoque não concilia com o seu ERP.",
  ean_variante: "Sem EAN a variante não casa com o catálogo do marketplace.",
};

/**
 * As pendências deste produto — dele e das variantes dele.
 *
 * Devolve `[]` quando não falta nada. A ordem é a de `TipoDePendencia`, que é a
 * ordem em que resolver produz resultado: a mesma regra de `lacunasDoProduto`.
 */
export function pendenciasDoProduto(p: ProdutoParaAnalise): PendenciaDoCatalogo[] {
  const pendencias: PendenciaDoCatalogo[] = [];
  const alvoProduto: AlvoDaPendencia = {
    tipo: "produto",
    id: p.id,
    rotulo: p.nome,
    produtoId: p.id,
  };
  const push = (tipo: TipoDePendencia, alvo: AlvoDaPendencia) =>
    pendencias.push({ tipo, alvo, impede: IMPEDE[tipo], bloqueia: BLOQUEIOS[tipo] });

  if (!(p.custo > 0)) push("custo", alvoProduto);
  if (!(p.precoVenda > 0)) push("preco", alvoProduto);

  // Peso só é pendência quando o frete é custo do lojista — mesma regra de
  // `lacunasDoProduto`. Com o comprador pagando, cobrar esse dado seria pedir
  // algo que nunca vai ser usado.
  if (p.vendedorPagaFrete !== false) {
    const semPeso = p.variantes.filter((v) => !(v.pesoGramas > 0));
    if (p.variantes.length === 0) {
      // Produto sem grade: o peso é dele, e não há variante para apontar.
      push("peso", alvoProduto);
    } else if (semPeso.length === p.variantes.length) {
      // AUSÊNCIA TOTAL. Uma pendência no produto, não N nas variantes: a
      // pergunta é uma só ("quanto pesa?") e listar 39 seria transformar uma
      // decisão em trinta e nove.
      push("peso", alvoProduto);
    } else {
      // AUSÊNCIA PARCIAL. Aqui cada variante é um alvo, porque o valor que
      // falta já existe no próprio produto — e é isso que torna estas
      // preparáveis sem perguntar nada a ninguém.
      for (const v of semPeso) push("peso_variante", alvoDaVariante(p, v));
    }
  }

  if (!p.temFoto) push("foto", alvoProduto);

  for (const v of p.variantes) {
    if (!v.sku.trim()) push("sku_variante", alvoDaVariante(p, v));
    if (!v.ean.trim()) push("ean_variante", alvoDaVariante(p, v));
  }

  return pendencias;
}

function alvoDaVariante(p: ProdutoParaAnalise, v: VarianteParaAnalise): AlvoDaPendencia {
  const eixos = [v.cor, v.tamanho].filter(Boolean).join(" · ");
  return {
    tipo: "variante",
    id: v.id,
    rotulo: eixos ? `${p.nome} — ${eixos}` : p.nome,
    produtoId: p.id,
  };
}

/** As pendências do catálogo inteiro, produto a produto. */
export function pendenciasDoCatalogo(
  produtos: readonly ProdutoParaAnalise[]
): PendenciaDoCatalogo[] {
  return produtos.flatMap(pendenciasDoProduto);
}

/**
 * O peso que o PRÓPRIO produto já conhece, em gramas — ou `null`.
 *
 * É o que torna a ausência parcial resolvível sem perguntar: as outras
 * variantes deste mesmo produto já foram pesadas, e é a mesma caixa.
 *
 * `null` EM DOIS CASOS, e o segundo importa:
 *
 *   nenhuma variante pesada       -> não há o que reusar
 *   as pesadas DISCORDAM entre si -> não há UM peso do produto
 *
 * O segundo caso é o que impede o estrago silencioso. O caminho de gravação de
 * peso que já existe desce o valor para TODAS as variantes do produto — é a
 * semântica de `pesoDeProduto`, e ela está certa para uma caixa só. Com 400 g
 * numa variante e 450 g em outra, aplicar "o peso do produto" sobrescreveria uma
 * das duas com um número que ninguém aprovou. Aí a resposta certa é perguntar.
 */
export function pesoConhecidoDoProduto(p: ProdutoParaAnalise): number | null {
  const pesos = [...new Set(p.variantes.map((v) => v.pesoGramas).filter((g) => g > 0))];
  if (pesos.length === 0) return null;
  return pesos.length === 1 ? pesos[0] : null;
}

/**
 * As variantes pesadas discordam entre si?
 *
 * Verdadeiro só quando há mais de um peso distinto. Serve para a frase dizer o
 * motivo real de não conseguir preparar — "elas não concordam" é acionável;
 * "não consegui" manda a pessoa adivinhar.
 */
export function pesosDivergentes(p: ProdutoParaAnalise): readonly number[] {
  const pesos = [...new Set(p.variantes.map((v) => v.pesoGramas).filter((g) => g > 0))];
  return pesos.length > 1 ? pesos.sort((a, b) => a - b) : [];
}

/** As variantes deste produto ainda sem peso. Alvo concreto de uma Proposal. */
export function variantesSemPeso(p: ProdutoParaAnalise): readonly VarianteParaAnalise[] {
  return p.variantes.filter((v) => !(v.pesoGramas > 0));
}

/**
 * A chave de agrupamento ENTRE produtos.
 *
 * `marca` + `modelo`, das COLUNAS — nunca lido do nome. `familiaDeProduto`
 * deriva a família do texto do nome, e isso é ótimo para uma tela de trabalho;
 * é perigoso para uma decisão que vai gravar peso em dezenas de linhas. Nome
 * parecido não prova caixa parecida.
 *
 * `null` quando falta marca ou modelo: sem os dois, o produto não se agrupa com
 * ninguém — ele fica sozinho, que é o comportamento seguro.
 */
export function chaveExataDeFamilia(p: ProdutoParaAnalise): string | null {
  const marca = p.marca.trim().toLowerCase();
  const modelo = p.modelo.trim().toLowerCase();
  if (!marca || !modelo) return null;
  return `${marca}|${modelo}`;
}
