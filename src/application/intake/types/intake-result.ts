// Resultado do Zion Intake, por produto.
//
// Os eventos de domínio são PREPARADOS (coletados de puxarEventos), nunca
// publicados — o Event Bus não existe ainda (PR futuro). O relatório agrega-os.

import type { EventoDominio } from "../../../domain/shared/evento-dominio.ts";
import type { ProdutoMestreDTO } from "../../dto/produto-mestre-dto.ts";

export type DecisaoIntake = "criar" | "atualizar" | "ignorar" | "duplicado" | "invalido";
export type ChaveConciliacao = "sku_origem" | "ean" | "nenhuma";

export interface IntakeItemResult {
  readonly skuOrigem: string;
  readonly decisao: DecisaoIntake;
  readonly conciliadoPor: ChaveConciliacao;
  readonly produtoMestreId: string | null;
  readonly produtoMestre: ProdutoMestreDTO | null;
  /** Eventos de domínio PREPARADOS (não publicados). */
  readonly eventos: ReadonlyArray<EventoDominio>;
  readonly motivos: ReadonlyArray<string>;
}

// ---- construtores de conveniência (sem lógica de negócio) ----

export function itemInvalido(skuOrigem: string, motivos: ReadonlyArray<string>): IntakeItemResult {
  return {
    skuOrigem,
    decisao: "invalido",
    conciliadoPor: "nenhuma",
    produtoMestreId: null,
    produtoMestre: null,
    eventos: [],
    motivos,
  };
}

export function itemDuplicado(skuOrigem: string): IntakeItemResult {
  return {
    skuOrigem,
    decisao: "duplicado",
    conciliadoPor: "sku_origem",
    produtoMestreId: null,
    produtoMestre: null,
    eventos: [],
    motivos: ["SKU duplicado no lote"],
  };
}
