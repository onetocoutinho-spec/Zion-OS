// Comando de entrada: adicionar uma Variante a um Produto Mestre existente.

export interface AdicionarVarianteCommand {
  readonly produtoMestreId: string;
  readonly skuZion: string;
  readonly skuOrigemVariacao: string | null;
  readonly ean: string | null;
  readonly cor: string | null;
  readonly tamanho: string | null;
  readonly precoVenda: number;
}
