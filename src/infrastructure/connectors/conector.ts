// Conector — a interface BASE que qualquer integração externa implementa (003).
//
// Primitivas comuns a origem/ERP/marketplace/futuros: identidade (metadados),
// conexão, teste, renovação de credencial, sincronização e aplicação idempotente.
// APENAS CONTRATO — nenhuma implementação, nenhum I/O, nenhum provedor concreto.
// Métodos são async na assinatura; a implementação real fica em PRs futuros.

import type { Resultado } from "./shared/resultado.ts";
import type {
  ContextoConector,
  MetadadosConector,
  Saude,
} from "./shared/tipos-conector.ts";
import type { OpcoesSync, ResumoSync } from "./shared/sincronizacao.ts";
import type { OperacaoAplicar, ResultadoOperacao } from "./shared/operacao.ts";

export interface Conector {
  /** Identidade declarada: tipo, provedor, capacidades e limites. */
  metadados(): MetadadosConector;

  /** Valida e persiste (server-side) a conexão; não retorna segredo (003 §C1). */
  conectar(contexto: ContextoConector): Promise<Resultado<void>>;

  /** Health-check / teste de conexão. */
  testarConexao(contexto: ContextoConector): Promise<Resultado<Saude>>;

  /** Renovação transparente de credencial (ex.: refresh OAuth) — 003 §C4. */
  renovarCredencial(contexto: ContextoConector): Promise<Resultado<void>>;

  /** Pull incremental/full da fonte externa → resumo (003 §C2). */
  sincronizar(contexto: ContextoConector, opcoes: OpcoesSync): Promise<Resultado<ResumoSync>>;

  /** Escrita idempotente na fonte externa (003 §C3 / §Regras 2). */
  aplicar(contexto: ContextoConector, operacao: OperacaoAplicar): Promise<ResultadoOperacao>;
}
