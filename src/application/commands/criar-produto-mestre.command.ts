// Comando de entrada: criar um Produto Mestre (rascunho). Campos primitivos; a
// validação estrutural (SKU/EAN/modo) acontece no mapper, e a coerência de
// negócio no agregado (criarRascunho). O id e o timestamp vêm de Ports.

export interface CriarProdutoMestreCommand {
  readonly organizacaoId: string;
  readonly clienteId: string;
  readonly origemProdutoId: string;
  readonly origemInterna: boolean;
  readonly catalogoId: string | null;
  readonly modoOperacao: string; // "revenda" | "fabricacao_propria" (validado no mapper)
  readonly skuOrigem: string;
  readonly ean: string | null;
  readonly nome: string;
  readonly marca?: string | null;
  readonly modelo?: string | null;
  readonly categoriaZion?: string | null;
  readonly descricaoBase?: string | null;
}
