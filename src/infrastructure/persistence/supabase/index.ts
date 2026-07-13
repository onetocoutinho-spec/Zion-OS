// Barrel da camada de persistência Supabase (PR-007).
//
// Concretiza os Ports da Application usando as tabelas canônicas (020/021).
// Toda regra de negócio permanece no domínio; aqui só há I/O + tradução.
// Strangler Fig: dormente — nenhuma camada existente importa isto ainda.

export * from "./shared/query-builder.ts";
export * from "./shared/supabase-context.ts";
export * from "./mappers/produto-mestre-db-mapper.ts";
export * from "./mappers/listing-db-mapper.ts";
export * from "./repositories/produto-mestre-repository-supabase.ts";
export * from "./repositories/listing-repository-supabase.ts";
