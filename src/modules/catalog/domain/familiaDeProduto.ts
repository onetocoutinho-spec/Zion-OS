// Agrupar produtos por FAMÍLIA — puro, sem React, sem banco.
//
// POR QUE ISTO EXISTE
//
// Sem peso não há frete, e sem frete não existe preço mínimo: a tela mostra
// "falta frete" e o lojista fica sem resposta. Na base do primeiro cliente,
// 0 de 3.085 variantes tinham peso.
//
// A saída óbvia seria pedir o peso produto a produto. Mas num catálogo de
// calçados os produtos vêm em LINHAS: "Papete Slide Moleca 5556.100 Tira Preta"
// e "Papete Slide Moleca 5556.100 T/pro/cac" são a mesma peça em cores
// diferentes, e pesam a mesma coisa. Pedir o peso duas vezes é pedir para a
// pessoa desistir no meio.
//
// Medido: 73 produtos formam 42 famílias. Havaianas sozinha tem 13 produtos.
//
// O AGRUPAMENTO NÃO DECIDE NADA SOZINHO
//
// Ele PROPÕE o grupo; quem confirma o peso é o lojista, e ele pode digitar um
// peso diferente para um produto específico. É a mesma regra que a importação
// de planilha aprendeu do jeito difícil: semelhança propõe, humano decide.
// Agrupar errado aqui custa um campo digitado a mais — nunca um peso errado
// gravado em silêncio.

/** As marcas do catálogo. Ordem importa: "Beira Rio" antes de "Rio" hipotético. */
const MARCAS = [
  "Beira Rio",
  "Under Armour",
  "Havaianas",
  "Molekinho",
  "Olympikus",
  "Actvitta",
  "Vizzano",
  "Ipanema",
  "Boaonda",
  "Cartago",
  "Modare",
  "Moleca",
  "Pegada",
  "Puket",
  "Rider",
  "Zaxy",
  "Clio",
  "Mimo",
] as const;

function semAcento(s: string): string {
  return s
    .normalize("NFD")
    .split("")
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c < 0x300 || c > 0x36f;
    })
    .join("");
}

/** A marca reconhecida no nome, ou "" quando nenhuma bate. */
export function marcaDoNome(nome: string): string {
  const alvo = semAcento(nome ?? "").toLowerCase();
  return MARCAS.find((m) => alvo.includes(semAcento(m).toLowerCase())) ?? "";
}

/**
 * O código do modelo: o primeiro número de 4+ dígitos, com os decimais que o
 * acompanham. "Moleca 5556.100 Tira" → "5556.100".
 *
 * Números curtos são ignorados de propósito: "25/6", "39/40" e "3/4" são
 * numeração de calçado, não modelo, e agrupariam coisas que não têm relação.
 */
export function codigoDoModelo(nome: string): string {
  const m = (nome ?? "").match(/\d{4,}(?:\.\d+)*/);
  return m ? m[0] : "";
}

/**
 * A chave da família. Vazia quando não dá para reconhecer nada — e aí o produto
 * fica sozinho no seu próprio grupo, que é o comportamento seguro.
 */
export function chaveDaFamilia(nome: string): string {
  const marca = marcaDoNome(nome);
  const codigo = codigoDoModelo(nome);
  if (marca && codigo) return `${marca} ${codigo}`;
  if (marca) return marca;
  if (codigo) return codigo;
  return "";
}

export interface ProdutoParaAgrupar {
  id: string;
  nome: string;
}

export interface Familia<T extends ProdutoParaAgrupar> {
  /** A chave, ou o próprio nome quando o produto não se encaixou em nenhuma. */
  chave: string;
  /** Rótulo para a tela. */
  titulo: string;
  produtos: T[];
}

/**
 * Agrupa por família, preservando a ordem de chegada.
 *
 * Produto sem família reconhecida vira um grupo de um. Nunca cai num balaio
 * "outros" — misturar peso de mochila com peso de chinelo porque nenhum dos
 * dois tinha marca conhecida seria o pior resultado possível.
 */
export function agruparPorFamilia<T extends ProdutoParaAgrupar>(
  produtos: readonly T[]
): Familia<T>[] {
  const grupos = new Map<string, Familia<T>>();
  for (const p of produtos) {
    const chave = chaveDaFamilia(p.nome);
    // Sem família: chave própria, para não se juntar a ninguém.
    const id = chave || `__sozinho__${p.id}`;
    const existente = grupos.get(id);
    if (existente) {
      existente.produtos.push(p);
    } else {
      grupos.set(id, { chave: id, titulo: chave || p.nome, produtos: [p] });
    }
  }
  return [...grupos.values()];
}

/**
 * Quantos produtos têm ALGUM peso — o maior entre as variantes é maior que zero.
 *
 * ATENÇÃO: isto responde "dá para calcular frete?", NÃO "o cadastro está
 * completo?". Um produto com 1 de 39 variantes preenchidas conta aqui.
 * Para completude, use `contarPendentes`.
 *
 * Semântica preservada de propósito: `pesoGramas` é o MAIOR entre as variantes
 * porque o frete cobra pela caixa que sai, e essa conta depende dela.
 */
export function contarComPeso(produtos: readonly { pesoGramas: number }[]): number {
  return produtos.filter((p) => p.pesoGramas > 0).length;
}

// ── Completude do cadastro de peso (INC-001) ────────────────────────────────
//
// O sistema usava UM número para responder DUAS perguntas:
//
//   "quanto pesa a caixa?"   → o MAIOR entre as variantes (certo: é o frete)
//   "tem peso cadastrado?"   → TODAS têm? (conjunção, não máximo)
//
// Reusar o máximo como predicado de completude escondia 12 variações sem peso
// em dois produtos — o lojista não tinha contagem, lista nem filtro que as
// alcançasse. Trocar por MIN inverteria o defeito: o frete passaria a ser
// calculado pela menor caixa e o preço mínimo sairia abaixo do que se paga.
//
// A saída é aditiva: a representação do CÁLCULO fica intacta, e a completude
// passa a derivar do par (quantidadeVariantes, variacoesSemPeso).

export type SituacaoPeso = "completo" | "ausencia_total" | "ausencia_parcial" | "sem_grade";

export interface EstadoDePeso {
  quantidadeVariantes: number;
  variacoesSemPeso: number;
}

/**
 * Em qual dos quatro estados este produto está.
 *
 * `sem_grade` é o quarto de propósito: produto sem variação nenhuma não tem
 * onde guardar peso. Chamá-lo de "sem peso" criaria uma pendência que ninguém
 * consegue resolver na tela de peso — e são 3 produtos na base real.
 */
export function situacaoDePeso(p: EstadoDePeso): SituacaoPeso {
  if (p.quantidadeVariantes === 0) return "sem_grade";
  if (p.variacoesSemPeso === 0) return "completo";
  if (p.variacoesSemPeso >= p.quantidadeVariantes) return "ausencia_total";
  return "ausencia_parcial";
}

/** O produto tem peso faltando em alguma variação? `sem_grade` NÃO conta. */
export function pesoPendente(p: EstadoDePeso): boolean {
  const s = situacaoDePeso(p);
  return s === "ausencia_total" || s === "ausencia_parcial";
}

/** Quantos produtos têm peso faltando. É este o número da barra de progresso. */
export function contarPendentes(produtos: readonly EstadoDePeso[]): number {
  return produtos.filter(pesoPendente).length;
}

/** Quantos produtos estão com o cadastro de peso COMPLETO (grade cheia). */
export function contarCompletos(produtos: readonly EstadoDePeso[]): number {
  return produtos.filter((p) => situacaoDePeso(p) === "completo").length;
}
