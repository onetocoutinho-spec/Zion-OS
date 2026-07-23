// System Authorship — a assinatura completa do sistema (E5.9).
//
// Fecha a S-30: toda ação automática passa a ter autoria EXPLÍCITA e
// VERSIONADA. Uma assinatura responde não só "quem agiu" (E4.2 já assinava),
// mas "QUAL VERSÃO de quê agiu" — porque auditoria de longo prazo compara
// comportamentos entre versões, não só entre autores:
//
//   autor                 quem (forma canônica do Autor tipado — E5.8)
//   versaoEngine          a release do componente que agiu
//   versaoContrato        o contrato de elegibilidade vigente
//   versaoConfidence      o conjunto de regras de confidence usado
//   versaoExplainability  a função de explicação usada
//
// REGRA PERMANENTE (vale para todo componente futuro): nenhuma ação
// automática sem `AssinaturaDeSistema`. Componentes novos criam a sua via
// `assinaturaDe(...)` — o autor nasce no formato canônico `sistema:<id>`
// (E5.8) e as versões são obrigatórias.
//
// Tipo puro: sem I/O, sem dependências além do domínio.

import { IDS_DE_SISTEMA, PREFIXO_SISTEMA } from "./author.ts";
import { VERSAO_CONTRATO_OFERTA } from "./offer.ts";

/** A assinatura versionada de um componente do sistema. */
export interface AssinaturaDeSistema {
  /** Forma canônica do autor (E5.8): id conhecido ou `sistema:<id>`. */
  readonly autor: string;
  readonly versaoEngine: string;
  readonly versaoContrato: string;
  readonly versaoConfidence: string;
  readonly versaoExplainability: string;
}

/** As versões CANÔNICAS vigentes dos mecanismos compartilhados da AIL. */
export const VERSAO_CONFIDENCE_VIGENTE = "confidenceDe/estadoDoSlot v1 (RFC-AIL-004 §4.3/§4.4)";
export const VERSAO_EXPLAINABILITY_VIGENTE = "explicarConfidence v1 (RFC-AIL-004)";

/**
 * Cria a assinatura de um componente do sistema. O autor sai na forma
 * canônica da E5.8 (ids já conhecidos ficam sem prefixo — compatível com os
 * fatos gravados; novos componentes ganham `sistema:`).
 */
export function assinaturaDe(
  componente: string,
  versaoEngine: string,
  versoes?: Partial<Pick<AssinaturaDeSistema, "versaoContrato" | "versaoConfidence" | "versaoExplainability">>
): AssinaturaDeSistema {
  const id = componente.trim();
  return {
    autor: IDS_DE_SISTEMA.has(id) ? id : `${PREFIXO_SISTEMA}${id}`,
    versaoEngine,
    versaoContrato: versoes?.versaoContrato ?? VERSAO_CONTRATO_OFERTA,
    versaoConfidence: versoes?.versaoConfidence ?? VERSAO_CONFIDENCE_VIGENTE,
    versaoExplainability: versoes?.versaoExplainability ?? VERSAO_EXPLAINABILITY_VIGENTE,
  };
}

/** A assinatura VIGENTE do Suggestion Engine (o único autor de Ofertas hoje). */
export const ASSINATURA_SUGGESTION_ENGINE: AssinaturaDeSistema = assinaturaDe(
  "suggestion-engine",
  "E4.2 (R-SE-1)"
);
