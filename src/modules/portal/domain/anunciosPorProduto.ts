// 880 linhas viram ~80 — e passa a ter busca.
//
// ===========================================================================
// O QUE A LOJISTA VIU
// ===========================================================================
//
// 03/08/2026, na tela "Meus Anúncios":
//
//   "fui pesquisar o item aqui e não tem uma barra de pesquisa, e porque não
//    aparece somente o 'anúncio pai' e as derivações dentro mas todas as
//    derivações separadas"
//
// As duas coisas são o mesmo problema: 880 linhas sem como achar uma.
//
// ===========================================================================
// POR QUE ESTAVAM SEPARADAS
// ===========================================================================
//
// No modelo User Products do Mercado Livre, CADA TAMANHO é um MLB próprio — e
// a importação grava um anúncio por MLB de propósito, porque é assim que o ERP
// casa SKU com anúncio.
//
// Só que a lojista não pensa em MLB. Ela pensa em "Babuche Molekinha 2591.103",
// que para ela é UM produto com vários tamanhos — e é assim que o painel do
// próprio ML mostra ("em 19 variações").
//
// A separação continua no banco, que é onde ela é necessária. O agrupamento é
// de LEITURA: muda como se olha, não o que está guardado.

export interface AnuncioAgrupavel {
  id: string;
  produtoId?: string | null;
  produto?: string | null;
  mlItemId?: string | null;
  statusMarketplace?: string | null;
  anuncio?: { tituloOtimizado?: string } | null;
  criadoEm: string;
}

export interface GrupoDeAnuncios<T extends AnuncioAgrupavel> {
  /** Chave estável do grupo — o produto, ou o próprio anúncio quando não há. */
  chave: string;
  nome: string;
  anuncios: T[];
  noAr: number;
  foraDoAr: number;
  semEstado: number;
}

const txt = (v: unknown) => (v == null ? "" : String(v));

/**
 * Agrupa por PRODUTO, mantendo a ordem de quem chegou.
 *
 * Anúncio sem produto vira grupo próprio, com a chave do próprio id: juntar
 * todos os órfãos num grupo "sem produto" esconderia que são coisas
 * diferentes, e a lojista não teria como abrir um só.
 *
 * A ordem dos grupos segue a ordem de aparição, e a de dentro também — quem
 * chama já ordenou, e reordenar aqui desfaria essa escolha em silêncio.
 */
export function agruparAnunciosPorProduto<T extends AnuncioAgrupavel>(
  anuncios: readonly T[]
): GrupoDeAnuncios<T>[] {
  const grupos = new Map<string, GrupoDeAnuncios<T>>();

  for (const a of anuncios) {
    const produtoId = txt(a.produtoId);
    const chave = produtoId || `avulso:${a.id}`;
    const nome =
      txt(a.produto) || txt(a.anuncio?.tituloOtimizado) || "(anúncio sem produto vinculado)";

    let g = grupos.get(chave);
    if (!g) {
      g = { chave, nome, anuncios: [], noAr: 0, foraDoAr: 0, semEstado: 0 };
      grupos.set(chave, g);
    }
    g.anuncios.push(a);

    // Só anúncio COM MLB entra na conta de estado: um rascunho que nunca foi ao
    // marketplace não está "fora do ar", ele nunca esteve no ar.
    if (!txt(a.mlItemId)) continue;
    const estado = txt(a.statusMarketplace);
    if (!estado) g.semEstado++;
    else if (estado === "active") g.noAr++;
    else g.foraDoAr++;
  }

  return [...grupos.values()];
}

/**
 * Filtra por texto — título, produto ou MLB.
 *
 * Sem acento e sem caixa dos dois lados: ela digita "molekinha" e o cadastro
 * diz "Molekinha"; digita "2591.103" e quer o produto; cola "MLB123" vindo do
 * painel do ML e quer aquele anúncio.
 *
 * Termo vazio devolve TUDO — filtro que esconde sem ter sido pedido é o mesmo
 * defeito de silêncio que atravessa este projeto.
 */
export function filtrarPorTexto<T extends AnuncioAgrupavel>(
  anuncios: readonly T[],
  termo: string
): T[] {
  const alvo = normalizar(termo);
  if (!alvo) return [...anuncios];
  return anuncios.filter((a) =>
    normalizar(
      `${txt(a.produto)} ${txt(a.anuncio?.tituloOtimizado)} ${txt(a.mlItemId)}`
    ).includes(alvo)
  );
}

function normalizar(v: string): string {
  return (v ?? "")
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const n = c.charCodeAt(0);
      return n < 0x300 || n > 0x36f;
    })
    .join("")
    .toLowerCase()
    .trim();
}
