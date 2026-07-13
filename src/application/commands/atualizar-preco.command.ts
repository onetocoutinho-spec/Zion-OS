// Comando de entrada: atualizar o preço de venda de uma Variante (Zion é dona).

import type { AutorDTO } from "../dto/autor-dto.ts";

export interface AtualizarPrecoCommand {
  readonly produtoMestreId: string;
  readonly varianteId: string;
  readonly precoVenda: number;
  readonly autor: AutorDTO;
}
