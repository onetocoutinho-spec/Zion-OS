// Capability: o que o canal EXIGE para uma dada categoria — conhecimento sobre a
// contraparte, não regra nossa. Puro, sem rede.
//
// Extraído de `lib/marketplaces/mlUserProducts.ts` na Release 007 (R11).
// Conteúdo preservado byte a byte; nenhuma lógica alterada.

/**
 * Categorias que já exigem o modelo User Products. A verdade final é o
 * `GET /domains/{domain}/technical_specs` (tag grid_template_required); esta
 * lista é o atalho para o que já confirmamos.
 */
const CATEGORIAS_USER_PRODUCTS = new Set(["MLB273770"]);

export function precisaUserProducts(categoryId: string): boolean {
  return CATEGORIAS_USER_PRODUCTS.has(categoryId);
}

// ---- Domínio da categoria (para a guia de tamanhos) ----

/** categoryId → domain_id do ML (necessário para POST /catalog/charts). */
const DOMINIO_POR_CATEGORIA: Record<string, string> = {
  MLB273770: "SANDALS_AND_CLOGS",
};

export function dominioDaCategoria(categoryId: string): string | null {
  return DOMINIO_POR_CATEGORIA[categoryId] ?? null;
}
