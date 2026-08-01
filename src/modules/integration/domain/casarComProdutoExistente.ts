// O modo `novos` precisa CASAR antes de criar — senão duplica o produto.
//
// ===========================================================================
// O DEFEITO, MEDIDO ANTES DE ACONTECER
// ===========================================================================
//
// `novos` traz os MLBs que ainda não foram importados, agrupa SÓ entre eles, e
// chama `criarProdutos` para cada grupo. Ele nunca pergunta se aquele produto
// já existe.
//
// Medido em 2026-08-01 contra um export do ERP com 561 anúncios: dos 170 que o
// Zion não conhecia, **117 pertenciam a produtos que já existiam** — 18 dos 26.
// Rodar `novos` criaria:
//
//     "Chinelo Slide Nuvem Zaxy Air 19419"   o atual, 2 variantes
//     "Chinelo Slide Nuvem Zaxy Air 19419"   NOVO, com as outras 22
//
// E o `Papete Slide Modare 7208.101 Nobuck`, que acabou de ser publicado,
// ganharia um gêmeo.
//
// ===========================================================================
// POR QUE CASAR POR NOME, E NÃO POR OUTRA COISA
// ===========================================================================
//
// O nome do produto NASCE de `familyName || titulo` do grupo — em
// `baseProdutoDoGrupo`. Um grupo novo do mesmo modelo produz o mesmo nome, pela
// mesma regra. Casar por ele é comparar duas saídas da mesma função, não duas
// grafias humanas.
//
// SKU não serve: `sku` do produto fica vazio quando há variação, e a base tem
// 117 SKUs repetidos entre variantes.

/**
 * A forma canônica do nome, para comparação.
 *
 * Minúsculas, sem acento e com espaços colapsados — o export do ERP escreve
 * "Leaz/Paris" onde a base tem "Leaz/paris", e "t/pronta" onde a base tem
 * "T/pronta". Ignorar caixa e acento casou 18 de 26 na medição real; casar
 * mais que isso exigiria heurística, e heurística aqui funde produto errado.
 */
export function normalizarNomeDeProduto(nome: string): string {
  return (nome ?? "")
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const n = c.charCodeAt(0);
      return n < 0x300 || n > 0x36f;
    })
    .join("")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export interface ProdutoExistente {
  id: string;
  nome: string;
}

/**
 * Para cada grupo, o produto que já existe — ou `null`, que significa criar.
 *
 * Quando dois produtos existentes normalizam para o MESMO nome, o primeiro
 * vence e é DETERMINÍSTICO pela ordem recebida. Escolher "o mais recente" ou
 * "o com mais variantes" seria decidir em silêncio qual dos dois é o certo, e
 * a base tem casos assim (`Papete Slide Modare 7208.101 Nobuck` e
 * `Papete Slide Modare Micr Perf Suprem 7208.101` são o mesmo modelo).
 */
export function casarGruposComProdutos(
  nomesDosGrupos: readonly string[],
  existentes: readonly ProdutoExistente[]
): (ProdutoExistente | null)[] {
  const porNome = new Map<string, ProdutoExistente>();
  for (const p of existentes) {
    const chave = normalizarNomeDeProduto(p.nome);
    if (chave && !porNome.has(chave)) porNome.set(chave, p);
  }
  return nomesDosGrupos.map((n) => porNome.get(normalizarNomeDeProduto(n)) ?? null);
}

export interface ChaveDeVariante {
  sku: string;
  cor: string;
  tamanho: string;
}

/** A identidade de uma variante para fins de duplicidade. */
function chave(v: ChaveDeVariante): string {
  const sku = (v.sku ?? "").trim();
  if (sku) return `sku:${sku.toLowerCase()}`;
  return `ct:${normalizarNomeDeProduto(v.cor)}|${normalizarNomeDeProduto(v.tamanho)}`;
}

/**
 * As variantes que ainda NÃO existem naquele produto.
 *
 * SKU manda quando há; sem SKU, cai em (cor, tamanho). A ordem importa: dois
 * tamanhos diferentes com o mesmo SKU são um erro de cadastro da lojista, e
 * deduplicar por (cor, tamanho) neste caso criaria as duas — mantendo o erro
 * dela visível em vez de escondê-lo atrás da nossa escolha.
 */
export function variantesInexistentes<T extends ChaveDeVariante>(
  novas: readonly T[],
  jaExistentes: readonly ChaveDeVariante[]
): T[] {
  const vistas = new Set(jaExistentes.map(chave));
  const saida: T[] = [];
  for (const v of novas) {
    const k = chave(v);
    if (vistas.has(k)) continue;
    vistas.add(k); // também deduplica DENTRO do lote novo
    saida.push(v);
  }
  return saida;
}
