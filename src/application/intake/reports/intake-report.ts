// Relatório de conciliação: agrega os resultados por produto num resumo + a lista
// dos eventos de domínio PREPARADOS (não publicados).

import type { EventoDominio } from "../../../domain/shared/evento-dominio.ts";
import type { IntakeItemResult } from "../types/intake-result.ts";

export interface ResumoIntake {
  readonly total: number;
  readonly novos: number;
  readonly atualizados: number;
  readonly ignorados: number;
  readonly duplicados: number;
  readonly invalidos: number;
}

export interface IntakeReport {
  readonly resumo: ResumoIntake;
  readonly itens: ReadonlyArray<IntakeItemResult>;
  /** Todos os eventos preparados no lote (para publicação futura via Event Bus). */
  readonly eventosPreparados: ReadonlyArray<EventoDominio>;
}

export function construirRelatorio(itens: ReadonlyArray<IntakeItemResult>): IntakeReport {
  let novos = 0;
  let atualizados = 0;
  let ignorados = 0;
  let duplicados = 0;
  let invalidos = 0;
  const eventos: EventoDominio[] = [];

  for (const item of itens) {
    switch (item.decisao) {
      case "criar":
        novos += 1;
        break;
      case "atualizar":
        atualizados += 1;
        break;
      case "ignorar":
        ignorados += 1;
        break;
      case "duplicado":
        duplicados += 1;
        break;
      case "invalido":
        invalidos += 1;
        break;
    }
    eventos.push(...item.eventos);
  }

  return {
    resumo: { total: itens.length, novos, atualizados, ignorados, duplicados, invalidos },
    itens: [...itens],
    eventosPreparados: eventos,
  };
}
