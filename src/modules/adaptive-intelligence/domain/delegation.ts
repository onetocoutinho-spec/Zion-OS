// Delegation — o domínio da autoridade delegada (E5.10b).
//
// A regra central, congelada pela ADR-002 Q8:
//
//   Delegation JAMAIS depende de Confidence. Confidence mede aprendizagem
//   (o sistema sobre si); Knowledge representa decisão institucional (um
//   humano assinou). Delegar exige Knowledge VIGENTE + autoridade humana
//   válida + executor assinado (E5.9). Rebaixar o Knowledge revoga a
//   delegação FUTURA; o passado permanece.
//
// Tipos e funções PURAS: sem I/O, sem relógio, sem heurística.

import type { AssinaturaDeSistema } from "./system-authorship.ts";
import type { FotografiaMaturacao } from "./knowledge.ts";
import type { EstadoConhecimento } from "./knowledge.ts";

/** O FATO append-only de delegação (concessão ou revogação). */
export interface FatoDelegacao {
  readonly id: string;
  readonly empresa: string;
  readonly contexto: string;
  readonly campo: string;
  readonly knowledgePatternId: string;
  readonly knowledgeVersao: number;
  readonly valorDelegado: string;
  readonly tipo: "concessao" | "revogacao";
  /** A AUTORIDADE humana que delegou/revogou (assinada; nunca vazia). */
  readonly delegadoPor: string;
  readonly motivo: string;
  /** A assinatura versionada do executor (sistema:delegation-runtime). */
  readonly assinatura: AssinaturaDeSistema;
  /** A fotografia do Knowledge vigente que sustentou o ato. */
  readonly evidencias: FotografiaMaturacao;
  readonly ocorridoEm: string;
}

export interface EstadoDelegacao {
  situacao: "nenhuma" | "vigente" | "revogada";
  concessaoVigente: FatoDelegacao | null;
  historico: FatoDelegacao[]; // mais recente primeiro — nada se apaga
}

/**
 * Precedência causal no empate: revogar exige uma concessão VIGENTE — logo, no
 * mesmo slot, a concessão é sempre causalmente anterior à revogação. Quando o
 * instante empata, é esta ordem que vale; o id (aleatório em produção) jamais
 * decide causalidade.
 */
const PRECEDENCIA_NO_EMPATE: Record<FatoDelegacao["tipo"], number> = { concessao: 0, revogacao: 1 };

function ordenar(fatos: readonly FatoDelegacao[]): FatoDelegacao[] {
  // Determinístico: por instante do fato; empate pela precedência causal do tipo
  // e, por fim, pelo id (desempate estável, nunca causal).
  return [...fatos].sort((a, b) =>
    a.ocorridoEm < b.ocorridoEm ? -1 : a.ocorridoEm > b.ocorridoEm ? 1
      : PRECEDENCIA_NO_EMPATE[a.tipo] - PRECEDENCIA_NO_EMPATE[b.tipo]
        || (a.id < b.id ? -1 : 1)
  );
}

/** PURA: vigente = a concessão mais recente sem revogação posterior. */
export function estadoDelegacao(fatos: readonly FatoDelegacao[]): EstadoDelegacao {
  const cronologia = ordenar(fatos);
  const ultimo = cronologia[cronologia.length - 1] ?? null;
  const historico = [...cronologia].reverse();
  if (!ultimo) return { situacao: "nenhuma", concessaoVigente: null, historico };
  if (ultimo.tipo === "concessao")
    return { situacao: "vigente", concessaoVigente: ultimo, historico };
  return { situacao: "revogada", concessaoVigente: null, historico };
}

export interface CondicaoDelegacao {
  condicao: string;
  ok: boolean;
  evidencia: string;
}

/**
 * PURA (ADR-002 Q8): pode delegar? Knowledge VIGENTE ∧ sem contradição
 * sinalizada ∧ autoridade humana assinada. Confidence NÃO aparece aqui —
 * deliberadamente e para sempre.
 */
export function verificarDelegabilidade(
  conhecimento: { estado: EstadoConhecimento; sobContradicao: boolean } | null,
  autoridade: string
): { delegavel: boolean; condicoes: CondicaoDelegacao[] } {
  const vigente = conhecimento?.estado.situacao === "vigente";
  const condicoes: CondicaoDelegacao[] = [
    {
      condicao: "Knowledge institucional VIGENTE (jamais Confidence — ADR-002 Q8)",
      ok: vigente,
      evidencia: vigente
        ? `v${conhecimento!.estado.versaoVigente} vigente (fato assinado)`
        : "sem Knowledge vigente — promova antes de delegar",
    },
    {
      condicao: "sem contradição sinalizada",
      ok: vigente ? !conhecimento!.sobContradicao : false,
      evidencia: conhecimento?.sobContradicao
        ? "o Pattern de origem deixou de sustentar os critérios — resolva (rebaixar ou aguardar) antes de delegar"
        : "nenhum sinal de contradição",
    },
    {
      condicao: "autoridade humana válida (assinada)",
      ok: autoridade.trim().length > 0,
      evidencia: autoridade.trim() ? `autoridade: ${autoridade.trim()}` : "sem sessão autenticada",
    },
  ];
  return { delegavel: condicoes.every((c) => c.ok), condicoes };
}

/**
 * PURA: a execução delegada é permitida AGORA? A concessão precisa estar
 * vigente E o Knowledge que a fundamenta precisa CONTINUAR vigente na mesma
 * versão (rebaixar revoga a execução futura — ADR-002 Q8).
 */
export function execucaoPermitida(
  delegacao: EstadoDelegacao,
  conhecimento: EstadoConhecimento | null
): { permitida: boolean; motivo: string } {
  if (delegacao.situacao !== "vigente" || !delegacao.concessaoVigente)
    return { permitida: false, motivo: "nenhuma delegação vigente para o slot" };
  const c = delegacao.concessaoVigente;
  if (!conhecimento || conhecimento.situacao !== "vigente")
    return {
      permitida: false,
      motivo: "o Knowledge que fundamentava a delegação não está mais vigente (rebaixamento revoga a execução futura — ADR-002 Q8)",
    };
  if (conhecimento.versaoVigente !== c.knowledgeVersao)
    return {
      permitida: false,
      motivo: `a delegação foi concedida sobre a v${c.knowledgeVersao}; a vigente agora é v${conhecimento.versaoVigente} — re-delegar é decisão humana`,
    };
  return { permitida: true, motivo: `delegação vigente sobre Knowledge v${c.knowledgeVersao}` };
}
