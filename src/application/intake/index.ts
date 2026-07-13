// Barrel público do Zion Intake Engine (PR-005).
//
// Transforma Produto Canônico → Produto Mestre (o ÚNICO ponto autorizado a
// fazê-lo). Orquestração pura: conhece Domain e Application (Ports/mappers);
// NÃO conhece Infrastructure/Supabase/HTTP/banco. Não publica eventos.
//
// Strangler Fig: dormente — nada em src/app, src/lib, src/domain ou
// src/infrastructure importa isto ainda.

export * from "./types/intake-command.ts";
export * from "./types/intake-result.ts";
export * from "./validators/produto-validator.ts";
export * from "./conciliacao/conciliador-produto.ts";
export * from "./reports/intake-report.ts";
export * from "./engine/intake-engine.ts";
export * from "./services/intake-service.ts";
