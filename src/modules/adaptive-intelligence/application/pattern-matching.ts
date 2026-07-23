// Contextual Pattern Matching (E4.1) — "a Zion já enfrentou algo parecido?"
//
// Segunda capability de leitura da AIL: dado o CONTEXTO de uma decisão em
// andamento, localiza o conhecimento já materializado que fala do MESMO
// assunto. Contratos:
//
//   - O contexto de decisão NÃO cria atributos novos: são exatamente os campos
//     que os producers já conhecem (`CapturaDeDecisao`): empresa, contexto,
//     campo — a projeção-slot da RFC-AIL-003 §3.3 — e a proposta (valorAnterior).
//   - Corresponder = igualdade canônica de slot (reusa `canonicalizarContexto`/
//     `canonicalizarValor` do domínio congelado). NUNCA similaridade, NUNCA
//     score novo, NUNCA ranking inteligente: a ordem é o suporte já contado.
//   - O resultado é EVIDÊNCIA, nunca comando: nada é escrito em campo algum,
//     nenhuma oferta é registrada — por isso esta capability NÃO é o Suggestion
//     Engine (R-SE-1) e NÃO aciona a ADR-001 (sem oferta aplicável, não há
//     fato-de-oferta a lembrar). O humano sempre decide.
//   - Explainability por construção: todo match aponta o PatternId — a porta
//     do Pattern Browser (evidências, autores, concorrentes).

import { canonicalizarContexto, canonicalizarValor } from "../domain/pattern-key.ts";
import type { Padrao } from "../domain/pattern.ts";
import {
  explicarConfidence,
  reposLeituraPadrao,
  rotuloAutor,
  visaoDe,
  type ReposDeLeitura,
  type VisaoPadrao,
} from "./pattern-browser.ts";

/** O que descreve uma decisão em andamento — só campos que já existem. */
export interface ContextoDeDecisao {
  /** Obrigatório — tenant (o clienteId, como em toda captura). */
  empresa: string;
  /** Obrigatório — Bounded Context canônico (ex.: "catalogo"). */
  contexto: string;
  /** Obrigatório — o assunto decidido (ex.: "categoriaMarketplace"). */
  campo: string;
  /** Opcional — o valor atualmente proposto/preenchido (o valorAnterior de uma futura captura). */
  proposta?: string | null;
}

/** O resultado do matching — memória localizada, jamais recomendação. */
export interface MemoriaContextual {
  encontrada: boolean;
  /** Todos os Patterns do slot, pela ordem já existente (suporte desc). */
  padroes: VisaoPadrao[];
  /** O mais frequente, enriquecido para leitura em contexto. */
  maisFrequente:
    | (VisaoPadrao & {
        /** POR QUE esta confidence — derivada dos limiares congelados. */
        explicacao: string;
        /** Autor da evidência mais recente ("não registrado" quando anônima). */
        ultimoAutor: string;
      })
    | null;
  /** O slot está em disputa (estado já materializado pelo Detector). */
  emDisputa: boolean;
  /** null sem proposta; true se a proposta canônica É o valor mais frequente. */
  propostaSegueMemoria: boolean | null;
}

const MEMORIA_VAZIA: MemoriaContextual = {
  encontrada: false,
  padroes: [],
  maisFrequente: null,
  emDisputa: false,
  propostaSegueMemoria: null,
};

/**
 * PURA: os Patterns do slot do contexto, na ordem já existente (suporte desc;
 * empate pelo valor — a MESMA ordenação do Pattern Browser, nenhum score novo).
 */
export function corresponder(
  ctx: Pick<ContextoDeDecisao, "empresa" | "contexto" | "campo">,
  padroes: readonly Padrao[]
): Padrao[] {
  const empresa = ctx.empresa.trim();
  const contexto = canonicalizarContexto(ctx.contexto);
  const campo = ctx.campo.trim();
  if (!empresa || !contexto || !campo) return [];
  return padroes
    .filter((p) => p.empresa === empresa && p.contexto === contexto && p.campo === campo)
    .sort((a, b) => b.ocorrencias - a.ocorrencias || (a.valorNovo < b.valorNovo ? -1 : 1));
}

/**
 * PURA: a proposta em curso segue a memória? Comparação pela forma canônica do
 * domínio (RFC-AIL-003 §4.2) contra o valor já canônico do Pattern.
 * null = não há proposta para comparar. Informativo, nunca prescritivo.
 */
export function propostaSegue(
  proposta: string | null | undefined,
  maisFrequente: { campo: string; valor: string } | null
): boolean | null {
  if (!maisFrequente) return null;
  const texto = (proposta ?? "").trim();
  if (!texto) return null;
  return canonicalizarValor(texto, maisFrequente.campo) === maisFrequente.valor;
}

/**
 * Localiza a memória relevante para uma decisão em andamento. Somente leitura
 * sobre as projeções existentes; a única consulta extra (Journal) serve ao
 * "último autor" do mais frequente — filtrada pela empresa (tenant) e restrita
 * aos DecisionIds de suporte. Nada é recomputado, nada é persistido.
 */
export async function localizarMemoria(
  ctx: ContextoDeDecisao,
  repos: ReposDeLeitura = reposLeituraPadrao
): Promise<MemoriaContextual> {
  const doSlot = corresponder(ctx, await repos.padroes.listar());
  if (doSlot.length === 0) return MEMORIA_VAZIA;

  const top = doSlot[0];
  const suporte = new Set(top.decisoesDeSuporte);
  const decisoes = await repos.decisoes.listar({
    coluna: "empresa",
    valor: top.empresa,
    campoLocal: "empresa",
  });
  const maisRecente = decisoes
    .filter((d) => suporte.has(d.id))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))[0];

  const maisFrequente = {
    ...visaoDe(top),
    explicacao: explicarConfidence(top),
    ultimoAutor: maisRecente ? rotuloAutor(maisRecente.autor) : "não registrado",
  };
  return {
    encontrada: true,
    padroes: doSlot.map(visaoDe),
    maisFrequente,
    emDisputa: doSlot.some((p) => p.slotEstado === "em_disputa"),
    propostaSegueMemoria: propostaSegue(ctx.proposta, maisFrequente),
  };
}
