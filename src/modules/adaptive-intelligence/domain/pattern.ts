// Pattern — a recorrência detectada (RFC-AIL-002 §3.3), materialização fiel do
// modelo congelado (RFC-AIL-004 §4.2/§4.3/§4.4).
//
// DOMÍNIO PURO: sem I/O, sem banco, sem Repository, sem Mapper. Este arquivo
// define a ESTRUTURA do Pattern e as REGRAS DE VALOR da escada de Confidence e
// do estado do slot — funções determinísticas que o núcleo do Detector (Etapa 2)
// aplicará. Os limiares são os canônicos fixados pela RFC-AIL-004 §4.3
// (Observado=1 · Recorrente≥2 · Consistente = ≥3 ∧ slot CONSISTENTE) — únicos
// números do algoritmo; alterá-los é ato de governança (ADR), não de código.

/** Confidence alcançável por CONTAGEM (RFC-AIL-004 §4.3). Níveis acima
 *  (confiavel/validado/automatizavel) exigem Outcomes/permissão — nunca são
 *  atribuídos pelo Detector. */
export type ConfidencePadrao = "observado" | "recorrente" | "consistente";

/** Estado do Pattern (RFC-AIL-002 §5.1). "aposentado" é deferido a R-AIL-5. */
export type EstadoPadrao = "emergente" | "estabelecido";

/** Estado do slot (RFC-AIL-004 §4.4). */
export type EstadoSlot = "emergente" | "consistente" | "em_disputa";

/** O Pattern materializado — identidade imutável + acúmulos derivados. */
export interface Padrao {
  /** PatternId: SHA-256 da chave canônica — identidade de domínio/persistência. */
  readonly id: string;
  /** PatternKey canônica textual — armazenada para explicabilidade. */
  readonly chave: string;
  // Componentes canônicos da chave (colunas de primeira classe p/ o slot/consulta):
  readonly empresa: string;
  readonly contexto: string;
  readonly campo: string;
  readonly valorNovo: string;
  /** |DecisionIds distintos elegíveis| — monotônico, nunca decresce. */
  readonly ocorrencias: number;
  /** Os DecisionIds que formaram o Pattern (explicabilidade — RFC-AIL-002 §8). */
  readonly decisoesDeSuporte: readonly string[];
  /** min(decidido_em) dos suportes — o marco de origem (imutável de fato). */
  readonly primeiraOcorrencia: string;
  /** max(decidido_em) dos suportes. */
  readonly ultimaOcorrencia: string;
  readonly confidence: ConfidencePadrao;
  readonly estado: EstadoPadrao;
  readonly slotEstado: EstadoSlot;
}

/** Limiar canônico: a partir de quantas ocorrências um Pattern é recorrente. */
export const LIMIAR_RECORRENTE = 2;
/** Limiar canônico: ocorrências mínimas para Consistente (com slot CONSISTENTE). */
export const LIMIAR_CONSISTENTE = 3;

/**
 * Estado do slot a partir dos suportes dos Patterns que o compõem
 * (RFC-AIL-004 §4.4): nenhum recorrente → EMERGENTE; exatamente um → CONSISTENTE;
 * dois ou mais → EM_DISPUTA (contradição — nenhum concorrente gradua).
 */
export function estadoDoSlot(suportesDoSlot: readonly number[]): EstadoSlot {
  const recorrentes = suportesDoSlot.filter((s) => s >= LIMIAR_RECORRENTE).length;
  if (recorrentes === 0) return "emergente";
  if (recorrentes === 1) return "consistente";
  return "em_disputa";
}

/**
 * Escada de Confidence por contagem (RFC-AIL-004 §4.3). Consistente exige ser o
 * único valor recorrente do slot — a disputa REBAIXA (sem apagar suporte).
 */
export function confidenceDe(
  ocorrencias: number,
  slot: EstadoSlot
): ConfidencePadrao {
  if (ocorrencias >= LIMIAR_CONSISTENTE && slot === "consistente") return "consistente";
  if (ocorrencias >= LIMIAR_RECORRENTE) return "recorrente";
  return "observado";
}

/** Estado do Pattern derivado da Confidence (RFC-AIL-004 §4.3). */
export function estadoDe(confidence: ConfidencePadrao): EstadoPadrao {
  return confidence === "consistente" ? "estabelecido" : "emergente";
}
