// Oferta — o FATO imutável de que uma Suggestion foi apresentada (ADR-001).
//
// "A Suggestion é efêmera como OFERTA; o FATO de ter sido oferecida é
// histórico e imutável." Este tipo materializa exatamente o fato mínimo da
// ADR-001: Pattern, slot, valor oferecido, entidade, instante, correlação —
// mais os campos de auditoria do contrato E4.2 (confidence utilizada, autor
// da oferta, versão do contrato, origem da explicação).
//
// APPEND-ONLY por natureza: uma Oferta nunca é editada nem apagada. O Outcome
// NÃO vive aqui — será PROJEÇÃO futura: Outcomes = f(ofertas × Decision
// Journal) (ADR-001). Tipo puro: sem I/O, sem dependências.

/** Versão do contrato de elegibilidade sob o qual a oferta foi gerada. */
export const VERSAO_CONTRATO_OFERTA = "PD-001+ADR-001 v1";

/** Autor institucional das ofertas — o sistema assina o que oferece (S-30). */
export const AUTOR_OFERTA = "suggestion-engine";

export interface Oferta {
  /** OfferId — identidade nasce no domínio (R-INF-001). */
  readonly id: string;
  /** Quando a oferta foi gerada (ISO-8601). */
  readonly oferecidaEm: string;
  // ── Decision Context (o slot da decisão em andamento — RFC-AIL-003 §3.3) ──
  readonly empresa: string;
  readonly contexto: string;
  readonly campo: string;
  /** Entidade em edição, quando conhecida (null em criação). */
  readonly entidade: { readonly tipo: string; readonly id: string } | null;
  // ── O que foi oferecido, e com que base (congelado no instante) ──────────
  /** O Pattern que originou a oferta (PatternId — SHA-256 da chave). */
  readonly patternId: string;
  /** O valor oferecido (o valorNovo canônico do Pattern no instante). */
  readonly valorOferecido: string;
  /** A Confidence NO INSTANTE da oferta (a projeção pode evoluir depois). */
  readonly confidenceUtilizada: string;
  /** Suporte no instante da oferta (idem — congela a base da decisão). */
  readonly ocorrenciasNoMomento: number;
  // ── Auditoria ────────────────────────────────────────────────────────────
  /** Quem ofereceu: o sistema, identificado (AUTOR_OFERTA). */
  readonly autorDaOferta: string;
  /** Sob qual contrato de elegibilidade (VERSAO_CONTRATO_OFERTA). */
  readonly versaoContrato: string;
  /** De onde veio a explicação exibida (função dos limiares congelados). */
  readonly origemExplicacao: string;
  /** Liga ofertas da mesma sessão/tela (dedup futuro — ADR-001 QA3). */
  readonly correlacao: string | null;
}
