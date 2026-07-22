// Decision — o átomo observado da Adaptive Intelligence Layer.
//
// Modelo canônico definido em RFC-AIL-002 §4 (Modelo Canônico de Aprendizagem).
// É a escolha do cliente que CORRIGE ou SOBRESCREVE uma proposta do sistema.
// Tipo puro: sem I/O, sem dependências externas, sem comportamento.
//
// Nesta Release (R-DJ-1) o tipo apenas EXISTE — nada o produz nem o consome.
// Ver docs/zion-os/engineering/IMP-AIL-001-rdj1-implementation-plan.md.

/**
 * Uma decisão canônica: quem escolheu o quê, em que contexto, de qual valor
 * para qual, e com que rastreabilidade. Imutável por natureza (append-only).
 */
export interface Decision {
  /** Identidade única da decisão. */
  readonly id: string;
  /** Empresa (tenant) dona da decisão — fronteira de isolamento inviolável. */
  readonly empresa: string;
  /** Quem tomou a decisão. */
  readonly autor: string;
  /** Bounded Context onde ocorreu (ex.: "catalogo", "publicacao"). */
  readonly contexto: string;
  /** Tipo e id da entidade afetada (ex.: produto, canal, anúncio). */
  readonly entidade: { readonly tipo: string; readonly id: string };
  /** O que foi decidido (ex.: "categoria", "tipoAnuncio", "medida"). */
  readonly campo: string;
  /** O valor que o sistema havia proposto. */
  readonly valorAnterior: string | null;
  /** O valor que o cliente escolheu. */
  readonly valorNovo: string;
  /** Tela/ação que originou a decisão (rastreabilidade). */
  readonly origem: string;
  /** Quando ocorreu (ISO-8601). */
  readonly timestamp: string;
  /** Liga decisões da mesma sessão/produto/execução. */
  readonly correlacao: string | null;
  /** Extensão futura, sem quebrar o contrato. */
  readonly metadados?: Readonly<Record<string, unknown>>;
}
