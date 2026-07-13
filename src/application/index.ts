// Barrel público da Application Layer (PR-003).
//
// Orquestra os casos de uso da plataforma: recebe DTOs canônicos, converte
// DTO↔Domínio (mappers de anticorrupção), executa o domínio, chama repositórios
// via Ports e prepara a publicação de eventos. SEM regra de negócio, SEM infra
// (Supabase/Next/HTTP/ML/Magazord), SEM banco.
//
// Strangler Fig: nada em src/app, src/lib, src/domain ou src/infrastructure
// importa isto ainda — a Application é dormente até a Infra ligá-la (PRs futuros).

export * from "./shared/index.ts";
export * from "./ports/index.ts";
export * from "./dto/index.ts";
export * from "./commands/index.ts";
export * from "./mappers/index.ts";
export * from "./services/index.ts";
export * from "./use-cases/index.ts";
