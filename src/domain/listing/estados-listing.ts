// Máquina de estados do Listing (publicação por canal) — 001 LISTING.status.
//   rascunho → publicado → ativo ⇄ pausado ; qualquer um → erro/encerrado.
// O estado REAL é reconciliado do marketplace pelo Engine (fora deste PR); aqui
// só definimos as transições legais.

export const STATUS_LISTING = [
  "rascunho",
  "publicado",
  "ativo",
  "pausado",
  "erro",
  "encerrado",
] as const;

export type StatusListing = (typeof STATUS_LISTING)[number];

const TRANSICOES: Record<StatusListing, readonly StatusListing[]> = {
  rascunho: ["publicado", "erro"],
  publicado: ["ativo", "pausado", "erro", "encerrado"],
  ativo: ["pausado", "encerrado", "erro"],
  pausado: ["ativo", "publicado", "encerrado", "erro"],
  erro: ["publicado", "rascunho", "encerrado"],
  encerrado: [],
};

export function podeTransicionarListing(de: StatusListing, para: StatusListing): boolean {
  return TRANSICOES[de].includes(para);
}
