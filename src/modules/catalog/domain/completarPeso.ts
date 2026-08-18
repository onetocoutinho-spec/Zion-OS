// O PESO QUE JÁ ESTÁ NA CASA — puro, e não inventa nenhum número.
//
// ===========================================================================
// O QUE ISTO RESOLVE, MEDIDO EM 17/08/2026 NA BASE REAL
// ===========================================================================
//
// 444 variações sem peso, em 80 produtos. Elas se dividem em duas metades que
// pedem coisas OPOSTAS, e tratá-las como uma só é o que fazia a tela pedir à
// lojista que digitasse o que ela já tinha respondido:
//
//   · 200 variações, em 24 produtos, onde as IRMÃS já têm peso e concordam num
//     único valor. Aqui não há pergunta a fazer: ela já mediu aquela caixa, o
//     número está no cadastro, e só não desceu para todos os tamanhos.
//
//   · 244 variações, em 23 produtos, onde NINGUÉM tem peso. Aqui não há o que
//     completar — falta o dado, e ele só existe numa balança.
//
// E o Mercado Livre não salva: medido ao vivo em 8 anúncios desses 23, nenhum
// tem `shipping.dimensions` nem o atributo `PACKAGE_WEIGHT`. O caminho barato
// não existe, e saber disso vale tanto quanto o que existe.
//
// ===========================================================================
// POR QUE ISTO NÃO ATRAVESSA PRODUTOS
// ===========================================================================
//
// "Babuche Molekinho 2874.202" pesa 350 g; seria tentador dar esse valor ao
// "2874.204", que é da mesma linha. Não é a mesma caixa, e peso errado não é
// erro de texto: é frete cobrado a menos, que sai do bolso dela em toda venda.
//
// A regra é a mesma que `pesoConhecidoDoProduto` já aplica dentro do produto —
// e é dela que este módulo depende, em vez de reimplementar. Uma segunda regra
// de "qual peso vale" divergiria em silêncio da que o assistente usa.

/**
 * O que este módulo precisa saber de um produto, e nada mais.
 *
 * `pesoUnicoGramas` JÁ vem decidido por `pesoConhecidoDoProduto`, no serviço
 * que lê as variantes. Recebê-lo pronto — em vez de reabrir a lista aqui — é o
 * que mantém UMA definição de "qual peso vale" no repo, a mesma que o
 * assistente usa para preparar esta aplicação pela conversa.
 */
export interface ProdutoComPesoConhecido {
  id: string;
  nome: string;
  /** `null` = ninguém tem peso, ou as pesadas discordam. Os dois pedem gente. */
  pesoUnicoGramas: number | null;
  variacoesSemPeso: number;
  quantidadeVariantes: number;
}

export interface PesoACompletar {
  produtoId: string;
  nome: string;
  /** O valor que as irmãs já têm, em gramas. Nunca calculado, sempre lido. */
  gramas: number;
  /** Quantas variações receberiam. */
  faltando: number;
  /** Quantas já têm — é o que dá confiança de que o valor é dela mesmo. */
  jaTem: number;
}

/**
 * Os produtos em que dá para completar sem perguntar nada.
 *
 * Ordenados pelo que mais rende primeiro: quem destrava mais variações aparece
 * no topo, porque é assim que a lojista decide se vale clicar agora.
 */
export function pesosACompletar(
  produtos: readonly ProdutoComPesoConhecido[]
): PesoACompletar[] {
  const lista: PesoACompletar[] = [];
  for (const p of produtos) {
    // `null` cobre os dois casos em que não se completa: ninguém tem peso, ou
    // as irmãs discordam. Os dois pedem uma pessoa, não um clique.
    if (p.pesoUnicoGramas === null || !(p.pesoUnicoGramas > 0)) continue;
    const faltando = p.variacoesSemPeso;
    if (faltando === 0) continue;
    lista.push({
      produtoId: p.id,
      nome: p.nome,
      gramas: p.pesoUnicoGramas,
      faltando,
      jaTem: p.quantidadeVariantes - faltando,
    });
  }
  return lista.sort((a, b) => b.faltando - a.faltando || a.nome.localeCompare(b.nome));
}

/**
 * A frase que a tela mostra, com os números que sustentam a decisão.
 *
 * Do domínio e não da tela: é este número que a lojista olha para clicar, e
 * número redigido na tela é número que diverge do que a gravação faz.
 */
export function fraseDoCompletar(lista: readonly PesoACompletar[]): string {
  if (lista.length === 0) return "";
  const variacoes = lista.reduce((s, x) => s + x.faltando, 0);
  return (
    `${variacoes} variação(ões) em ${lista.length} produto(s) estão sem peso, e o valor já está ` +
    `nas outras variações do mesmo produto — a mesma caixa, que você já mediu. ` +
    `Nada aqui é estimado: cada produto recebe o peso que ele já tem.`
  );
}

/**
 * Agrupa por VALOR para a gravação.
 *
 * Vinte e quatro produtos com sete pesos distintos são sete gravações, não
 * vinte e quatro — e cada gravação a menos é uma rajada a menos de eventos do
 * Realtime, que foi o que derrubou esta conta em 17/08/2026.
 */
export function porValor(lista: readonly PesoACompletar[]): { gramas: number; produtoIds: string[] }[] {
  const mapa = new Map<number, string[]>();
  for (const item of lista) {
    const arr = mapa.get(item.gramas) ?? [];
    arr.push(item.produtoId);
    mapa.set(item.gramas, arr);
  }
  return [...mapa.entries()]
    .map(([gramas, produtoIds]) => ({ gramas, produtoIds }))
    .sort((a, b) => b.produtoIds.length - a.produtoIds.length);
}
