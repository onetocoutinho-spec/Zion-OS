// Quais anúncios já cadastrados precisam ter o estado no marketplace corrigido.
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// A migração 050 deu um lugar para a verdade, mas não a preencheu: as 511
// linhas já importadas ficaram `null` — e `null` significa "não sabemos".
//
// Só que nós SABEMOS. A importação lê os 781 anúncios da conta inteira e depois
// usa só os que faltam. O estado dos outros 502 chega na mesma resposta e era
// jogado fora — o mesmo defeito que descartou a ficha do lojista, a associação
// foto↔cor e o `paging.total`.
//
// Então não é uma leitura nova. É parar de descartar a que já foi feita.
//
// ===========================================================================
// O QUE ISTO NÃO FAZ
// ===========================================================================
//
// Não toca em `status` (o eixo da esteira do Zion), não apaga, não cria. Só
// escreve as duas colunas do eixo do marketplace, e só nas linhas em que o
// valor MUDOU — reescrever `active` por cima de `active` seria gravação sem
// fato novo, e faria `status_marketplace_em` mentir sobre quando aprendemos.

export interface AnuncioConhecido {
  id: string;
  mlItemId?: string | null;
  statusMarketplace?: string | null;
  subStatusMarketplace?: string[] | null;
  fotoCapaMaxSize?: string | null;
  estoqueMarketplace?: number | null;
  categoriaMl?: string | null;
}

export interface EstadoLidoNoMarketplace {
  mlb: string;
  status: string;
  /** POR QUE não está no ar. Migração 051 deu onde guardar. */
  subStatus?: string[];
  /** O tamanho real da capa, como o ML declara. */
  fotoCapaMaxSize?: string;
  /** O estoque NO MARKETPLACE — é ele que ordena o trabalho. */
  estoque?: number;
  /**
   * O `category_id` do item — o QUINTO fato desta mesma leitura (056).
   *
   * Sem ele `/sites/MLB/listing_prices` devolve `null` e a precificação inteira
   * cai na tabela. Medido em 10/08/2026: a tabela cobra 19% em tudo, e as
   * bolsas dela são MLB7022, onde o ML cobra 15%.
   */
  categoriaMl?: string;
}

export interface AtualizacaoDeEstado {
  id: string;
  statusMarketplace: string;
  statusMarketplaceEm: string;
  subStatusMarketplace: string[];
  fotoCapaMaxSize: string | null;
  estoqueMarketplace: number | null;
  categoriaMl: string | null;
}

/**
 * As linhas cujo estado no marketplace mudou (ou nunca foi conhecido).
 *
 * `lidoEm` é injetado, não gerado aqui: a função é pura e o mesmo instante vale
 * para o lote inteiro — o que faz `atualizarVarios` agrupar 502 linhas em uma
 * requisição por estado distinto, em vez de 502 requisições.
 */
export function estadosDesatualizados(
  conhecidos: readonly AnuncioConhecido[],
  lidos: readonly EstadoLidoNoMarketplace[],
  lidoEm: string
): AtualizacaoDeEstado[] {
  const porMlb = new Map<string, EstadoLidoNoMarketplace>();
  for (const l of lidos) {
    const mlb = (l.mlb ?? "").trim();
    const status = (l.status ?? "").trim();
    // Estado em branco não vira atualização: o ML não disse, e sobrescrever o
    // que sabíamos com "não sabemos" perderia informação.
    if (mlb && status && !porMlb.has(mlb)) porMlb.set(mlb, l);
  }

  const saida: AtualizacaoDeEstado[] = [];
  for (const a of conhecidos) {
    const mlb = (a.mlItemId ?? "").trim();
    if (!mlb) continue; // anúncio que nunca foi ao ar não tem estado lá
    const lido = porMlb.get(mlb);
    if (!lido) continue; // o ML não devolveu este anúncio nesta leitura

    // Agora são QUATRO fatos, não um. Qualquer um diferente do gravado é
    // motivo de escrita — e os quatro vão juntos, porque saem da mesma leitura
    // e a data (`status_marketplace_em`) descreve todos.
    const status = (lido.status ?? "").trim();
    const subStatus = [...(lido.subStatus ?? [])].sort();
    const capa = (lido.fotoCapaMaxSize ?? "").trim();
    const estoque = typeof lido.estoque === "number" ? lido.estoque : null;
    const categoria = (lido.categoriaMl ?? "").trim();

    const mesmoStatus = (a.statusMarketplace ?? "").trim() === status;
    const mesmoSub =
      JSON.stringify([...(a.subStatusMarketplace ?? [])].sort()) === JSON.stringify(subStatus);
    const mesmaCapa = (a.fotoCapaMaxSize ?? "").trim() === capa;
    const mesmoEstoque = (a.estoqueMarketplace ?? null) === estoque;
    // Categoria VAZIA não conta como diferença: o ML não a devolveu nesta
    // leitura, e sobrescrever o que sabíamos com "não sabemos" é a mesma perda
    // que o `status` em branco já evita acima.
    const mesmaCategoria = !categoria || (a.categoriaMl ?? "").trim() === categoria;
    if (mesmoStatus && mesmoSub && mesmaCapa && mesmoEstoque && mesmaCategoria) continue;

    saida.push({
      id: a.id,
      statusMarketplace: status,
      statusMarketplaceEm: lidoEm,
      subStatusMarketplace: subStatus,
      fotoCapaMaxSize: capa || null,
      estoqueMarketplace: estoque,
      // Preserva o que já sabíamos quando a leitura veio sem categoria.
      categoriaMl: categoria || (a.categoriaMl ?? null),
    });
  }
  return saida;
}
