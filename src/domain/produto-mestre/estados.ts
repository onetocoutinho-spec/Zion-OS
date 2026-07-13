// Máquina de estados do Produto Mestre — ciclo de vida de 001.
//
//   rascunho → enriquecido → pendente_aprovacao → aprovado → publicado
//   publicado ⇄ pausado ; {aprovado, publicado, pausado, ...} → arquivado
//
// Editar conteúdo de um item "aprovado" o devolve a "pendente_aprovacao" (F4) —
// essa regra vive no agregado; aqui ficam apenas as transições permitidas.

export const STATUS_PRODUTO_MESTRE = [
  "rascunho",
  "enriquecido",
  "pendente_aprovacao",
  "aprovado",
  "publicado",
  "pausado",
  "arquivado",
] as const;

export type StatusProdutoMestre = (typeof STATUS_PRODUTO_MESTRE)[number];

const TRANSICOES: Record<StatusProdutoMestre, readonly StatusProdutoMestre[]> = {
  rascunho: ["enriquecido", "arquivado"],
  enriquecido: ["pendente_aprovacao", "rascunho", "arquivado"],
  pendente_aprovacao: ["aprovado", "enriquecido", "arquivado"],
  aprovado: ["publicado", "pendente_aprovacao", "arquivado"],
  publicado: ["pausado", "arquivado"],
  pausado: ["publicado", "arquivado"],
  arquivado: [],
};

export function podeTransicionar(de: StatusProdutoMestre, para: StatusProdutoMestre): boolean {
  return TRANSICOES[de].includes(para);
}
