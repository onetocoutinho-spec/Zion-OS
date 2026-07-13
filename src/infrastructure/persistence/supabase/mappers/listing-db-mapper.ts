// Listing DB mapper — PENDENTE da migração 022 (tabela `listing`).
//
// Decisão do PR-007: o Listing foi ADIADO. As migrations 017–021 (PR-006) não
// criaram `listing`/`listing_variante`; sem tabela canônica, o mapeamento
// Domain↔banco do Listing não é implementado aqui. Este arquivo mantém a
// estrutura do PR e documenta a dependência; será preenchido quando a 022 existir.

export const LISTING_DB_MAPPER_PENDENTE =
  "Listing DB mapper pendente da migração 022 (tabela `listing`), fora do escopo 017–021.";
