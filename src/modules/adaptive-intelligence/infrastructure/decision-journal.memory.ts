// InMemoryDecisionJournal — adaptador EM MEMÓRIA, exclusivo para teste.
//
// NÃO é implementação de produção. Registra o que recebe para que os testes de
// contrato verifiquem que a Decision flui íntegra pelo Port. Sem I/O, sem rede.

import type { DecisionJournal } from "../ports/decision-journal.port.ts";
import type { Decision } from "../domain/decision.ts";

/** Guarda em memória as decisões recebidas. Apenas para teste. */
export class InMemoryDecisionJournal implements DecisionJournal {
  readonly recebidas: Decision[] = [];

  registrarDecisao(decisao: Decision): void {
    this.recebidas.push(decisao);
  }
}
