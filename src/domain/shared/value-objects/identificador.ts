// Identificadores tipados (branded types) do domínio.
//
// São strings em runtime, mas nominalmente distintos em tempo de compilação:
// um IdVariante não pode ser passado onde se espera um IdProdutoMestre. Isso
// evita trocas silenciosas de id sem custo em runtime.
//
// Pureza: o domínio NÃO gera ids (nada de crypto/uuid/Math.random aqui). A
// geração é um Port (GeradorId) injetado pela camada Application/Infra.

declare const marcaId: unique symbol;

export type Id<TMarca extends string> = string & { readonly [marcaId]: TMarca };

export type IdOrganizacao = Id<"organizacao">;
export type IdCliente = Id<"cliente">;
export type IdOrigemProduto = Id<"origem_produto">;
export type IdCatalogo = Id<"catalogo">;
export type IdProdutoMestre = Id<"produto_mestre">;
export type IdVariante = Id<"variante">;
export type IdListing = Id<"listing">;
export type IdListingVariante = Id<"listing_variante">;

/** Converte uma string crua num Id tipado (a validação de forma é da borda). */
export function comoId<TMarca extends string>(valor: string): Id<TMarca> {
  return valor as Id<TMarca>;
}

/** Port de geração de identificadores — injetado, mantém o domínio determinístico. */
export interface GeradorId {
  novo(): string;
}
