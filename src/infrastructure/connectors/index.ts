// Barrel público do Connector SDK (PR-002).
//
// Camada UNIVERSAL de integração da Zion: contratos, tipos canônicos,
// capacidades, estratégias de auth e modelo unificado de erros. Sem
// implementação de provedor, sem I/O, sem Event Bus, sem banco.
//
// Strangler Fig: nada em src/app, src/lib ou src/domain importa isto ainda.

// shared
export * from "./shared/erros.ts";
export * from "./shared/resultado.ts";
export * from "./shared/capacidades.ts";
export * from "./shared/limites.ts";
export * from "./shared/tipos-conector.ts";
export * from "./shared/sincronizacao.ts";
export * from "./shared/operacao.ts";
export * from "./shared/auth/credencial.ts";
export * from "./shared/auth/estrategia-auth.ts";
export * from "./shared/canonical/index.ts";

// contratos
export * from "./conector.ts";
export * from "./conector-origem.ts";
export * from "./conector-erp.ts";
export * from "./conector-marketplace.ts";
export * from "./conformidade.ts";
