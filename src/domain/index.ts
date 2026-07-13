// Barrel público do Domain Layer da Zion Platform (PR-001).
//
// Núcleo puro: sem I/O, sem banco, sem Next.js, sem Supabase. Consumido por
// camadas superiores (Application/Infra) em PRs futuros. Nada em src/app ou
// src/lib importa isto ainda (Strangler Fig — domínio dormente).

export * from "./shared/resultado.ts";
export * from "./shared/erros-dominio.ts";
export * from "./shared/evento-dominio.ts";
export * from "./shared/value-objects/index.ts";
export * from "./produto-mestre/index.ts";
export * from "./listing/index.ts";
