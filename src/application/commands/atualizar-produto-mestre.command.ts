// Comando de entrada: editar o conteúdo de um Produto Mestre. Só campos de
// conteúdo (Zion é dona — 001 §6); o versionamento e a regra F4 são do agregado.

import type { AutorDTO } from "../dto/autor-dto.ts";

export interface PatchConteudoProdutoMestre {
  readonly nome?: string;
  readonly marca?: string | null;
  readonly modelo?: string | null;
  readonly categoriaZion?: string | null;
  readonly descricaoBase?: string | null;
}

export interface AtualizarProdutoMestreCommand {
  readonly produtoMestreId: string;
  readonly patch: PatchConteudoProdutoMestre;
  readonly autor: AutorDTO;
}
