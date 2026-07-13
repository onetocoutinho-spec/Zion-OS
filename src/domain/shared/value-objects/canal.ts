// Canal — os canais suportados pela Zion (001: preço/listing por canal).
//   - "zion"          → canal interno (preço-base da plataforma)
//   - "mercado_livre" | "tiktok" | "shopee" → marketplaces
//
// Um Listing (publicação) existe apenas para marketplaces, nunca para "zion"
// (ver listing.ts). Aqui só definimos o conjunto e os guards.

export const CANAIS = ["zion", "mercado_livre", "tiktok", "shopee"] as const;
export type Canal = (typeof CANAIS)[number];

export const CANAIS_MARKETPLACE = ["mercado_livre", "tiktok", "shopee"] as const;
export type CanalMarketplace = (typeof CANAIS_MARKETPLACE)[number];

export function ehCanal(valor: string): valor is Canal {
  return (CANAIS as readonly string[]).includes(valor);
}

export function ehCanalMarketplace(valor: string): valor is CanalMarketplace {
  return (CANAIS_MARKETPLACE as readonly string[]).includes(valor);
}
