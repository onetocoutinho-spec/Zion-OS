// Exportação de VINCULAÇÃO para o ERP (Fase 3.3).
//
// Fluxo: a Zion publica no marketplace (Fase 3) → sai o MLB (ml_item_id) →
// aqui geramos o arquivo SKU ↔ MLB que o cliente importa no ERP dele
// (Bling/Tiny/Magazord/Linx), para o ERP "adotar" o anúncio e passar a gerir
// estoque e pedidos.
//
// Uma variação (cor/tamanho) por linha, com o SKU do ERP. Anúncios sem
// variação usam o SKU/código do produto pai.

import type { AnuncioGeradoRegistro, Produto } from "../types";

export interface LinhaVinculacao {
  sku: string;
  mlb: string;
  variacao: string;
  titulo: string;
  preco: string;
  estoque: string;
  link: string;
  produto: string;
}

/** Só entram anúncios já publicados (com MLB). */
export function linhasVinculacao(
  anuncios: AnuncioGeradoRegistro[],
  produtoPorId: Map<string, Produto> = new Map()
): LinhaVinculacao[] {
  const linhas: LinhaVinculacao[] = [];
  for (const a of anuncios) {
    if (a.status !== "publicado" || !a.mlItemId) continue;
    const titulo = a.anuncio?.tituloOtimizado ?? a.produto ?? "";
    const base = {
      mlb: a.mlItemId,
      titulo,
      link: a.mlPermalink ?? "",
      produto: a.produto ?? "",
    };
    const variacoes = a.anuncio?.variacoes ?? [];
    if (variacoes.length > 0) {
      for (const v of variacoes) {
        linhas.push({
          ...base,
          sku: v.sku || "",
          variacao: [v.cor, v.tamanho].filter(Boolean).join(" ").trim(),
          preco: v.preco || "",
          estoque: v.estoque || "",
        });
      }
    } else {
      const p = a.produtoId ? produtoPorId.get(a.produtoId) : undefined;
      linhas.push({
        ...base,
        sku: p?.sku || p?.codErp || "",
        variacao: "",
        preco: p ? String(p.precoVenda) : "",
        estoque: p ? String(p.estoque) : "",
      });
    }
  }
  return linhas;
}

const CABECALHO = ["SKU", "MLB", "Variação", "Título", "Preço", "Estoque", "Link", "Produto"];

function campoCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV de vinculação (com BOM para abrir certo no Excel). */
export function gerarVinculacaoCsv(
  anuncios: AnuncioGeradoRegistro[],
  produtoPorId?: Map<string, Produto>
): string {
  const linhas = linhasVinculacao(anuncios, produtoPorId);
  const corpo = linhas.map((l) =>
    [l.sku, l.mlb, l.variacao, l.titulo, l.preco, l.estoque, l.link, l.produto]
      .map(campoCsv)
      .join(",")
  );
  return [CABECALHO.join(","), ...corpo].join("\r\n");
}

/** Dispara o download do CSV de vinculação. Retorna quantas linhas saíram. */
export function baixarVinculacaoCsv(
  anuncios: AnuncioGeradoRegistro[],
  produtoPorId?: Map<string, Produto>
): number {
  const csv = gerarVinculacaoCsv(anuncios, produtoPorId);
  const linhas = linhasVinculacao(anuncios, produtoPorId).length;
  const blob = new Blob([String.fromCharCode(0xfeff) + csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vinculacao-erp-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return linhas;
}
