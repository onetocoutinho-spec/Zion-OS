// Qual campo o Mercado Livre está esperando — por anúncio fora do ar.
//
// ===========================================================================
// O CASO
// ===========================================================================
//
// Medido em 2026-08-01, depois que a leitura passou a pedir `sub_status`:
//
//     150 waiting_for_patch        ← 19% do catálogo
//      60 out_of_stock
//      21 paused_by_seller
//      12 picture_download_pending
//       7 forbidden
//
// `waiting_for_patch` é o ML dizendo "falta alguma coisa, conserte". Ele não
// diz o quê nesse campo — mas publica a lista de exigências da categoria em
// `/categories/{id}/attributes`, com a tag `required`.
//
// Cruzar as duas coisas responde a pergunta que a lojista realmente tem: "o
// que eu preencho para o anúncio voltar ao ar?"
//
// ===========================================================================
// O QUE ISTO NÃO AFIRMA
// ===========================================================================
//
// Que o campo faltante É o motivo do patch. O ML não confirma isso, e inventar
// a causa seria a mesma classe de erro que o DES-001 arrancou do A10.
//
// O que isto afirma é verificável: "este anúncio está fora do ar E a categoria
// dele exige BRAND, que ele não tem". Correlação medida, com os dois lados
// vindo do próprio ML. A lojista decide o resto.
//
// Categoria sem exigências conhecidas (ML fora do ar, categoria nova) não
// produz nada — falha aberta, como no resto do arquivo.

export interface AnuncioParaConferir {
  mlb: string;
  categoria: string;
  status: string;
  subStatus?: string[];
  atributos: readonly { id: string }[];
}

export interface ExigenciaNaoAtendida {
  /** O id do atributo, como o ML o chama. */
  id: string;
  /** O nome legível que o ML devolveu. */
  nome: string;
  /** Quantos anúncios FORA DO AR não têm este atributo. */
  anuncios: number;
}

/**
 * Os campos exigidos que faltam nos anúncios que NÃO estão no ar.
 *
 * Só olha o que não está `active`: um anúncio vendendo com atributo faltando
 * não é problema a resolver — o ML o aceitou, e mandar a lojista mexer no que
 * está funcionando é ruído.
 */
export function exigenciasNaoAtendidas(
  anuncios: readonly AnuncioParaConferir[],
  obrigatoriosPorCategoria: Record<string, { id: string; nome: string }[]>
): ExigenciaNaoAtendida[] {
  const contagem = new Map<string, { nome: string; anuncios: number }>();

  for (const a of anuncios) {
    if ((a.status || "").trim().toLowerCase() === "active") continue;
    const exigidos = obrigatoriosPorCategoria[a.categoria] ?? [];
    if (exigidos.length === 0) continue; // categoria sem exigência conhecida
    const tem = new Set(a.atributos.map((x) => (x.id ?? "").trim()).filter(Boolean));
    for (const e of exigidos) {
      if (tem.has(e.id)) continue;
      const atual = contagem.get(e.id) ?? { nome: e.nome, anuncios: 0 };
      atual.anuncios++;
      contagem.set(e.id, atual);
    }
  }

  return [...contagem.entries()]
    .map(([id, v]) => ({ id, nome: v.nome, anuncios: v.anuncios }))
    .sort((x, y) => y.anuncios - x.anuncios || x.id.localeCompare(y.id));
}
