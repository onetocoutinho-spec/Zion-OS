// Erros tipados do Domain Layer (PR-001).
//
// O domínio nunca "lança" no fluxo feliz: as operações devolvem Result<T>
// (ver resultado.ts) carregando um ErroDominio quando uma invariante é violada.
// Manter os códigos estáveis permite que camadas superiores (Application) mapeiem
// erros de negócio para respostas sem depender de mensagens.

export type CodigoErroDominio =
  | "sku_origem_invalido"
  | "ean_invalido"
  | "valor_monetario_invalido"
  | "canal_invalido"
  | "modo_operacao_incoerente"
  | "transicao_invalida"
  | "variante_nao_pertence"
  | "variante_duplicada"
  | "variante_inexistente"
  | "preco_abaixo_do_piso"
  | "estoque_negativo"
  | "campo_obrigatorio"
  | "listing_canal_invalido";

export class ErroDominio extends Error {
  readonly codigo: CodigoErroDominio;

  constructor(codigo: CodigoErroDominio, mensagem: string) {
    super(mensagem);
    this.name = "ErroDominio";
    this.codigo = codigo;
  }
}

export function erroDominio(codigo: CodigoErroDominio, mensagem: string): ErroDominio {
  return new ErroDominio(codigo, mensagem);
}
