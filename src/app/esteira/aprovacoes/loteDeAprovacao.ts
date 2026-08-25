// A regra da ação em massa na fila de aprovações. Pura, com teste.
//
// A fila é a tela operacional onde a equipe mais repete o mesmo clique: dez
// anúncios passaram no A10, dez vezes "Aprovar". A régua (`ui-ux-pro-max`,
// Data Entry: "Allow multi-select and bulk edit") trata linha-a-linha como
// defeito em lista operacional.
//
// O QUE ESTE MÓDULO DECIDE
//
// 1. A ELEGIBILIDADE É A MESMA DA LINHA. Aprovar em massa não afrouxa a trava
//    (A10 aprovado + zero pendências + status que admite); um marcado que não
//    passa é PULADO e contado, não aprovado "porque estava no lote".
// 2. O LOTE RODA EM SEQUÊNCIA E NÃO PARA NA PRIMEIRA FALHA. Cada item tem o
//    seu try; o resumo diz quantos foram, quantos falharam e quantos pulou.
//    Parar no primeiro erro deixaria a pessoa sem saber o que já foi feito.

import type { AnuncioGeradoRegistro } from "@/lib/types";

export type AcaoEmLote = "aprovar" | "rejeitar";

// ---------------------------------------------------------------------------
// A TRAVA, E POR QUE ELA VIROU UMA COLUNA SÓ
// ---------------------------------------------------------------------------
//
// A tabela tinha três colunas — Nota, A10 e Pend. — e as três respondiam a
// MESMA pergunta: "dá para aprovar isto?". Pior, a resposta não estava em
// nenhuma delas: quem operava lia o "Reprovado" de uma, o "2" de outra, e
// concluía sozinho o que a trava já sabe. Medido a 1280px em 24/08/2026, com
// uma linha de conteúdo real: a tabela pedia 1081px num container de 964, e as
// três somavam 189px do excesso de 117.
//
// Agora a coluna DIZ a resposta, e os motivos quando é "não".

export type TipoMotivoDaTrava = "a10" | "pendencias";

export interface MotivoDaTrava {
  tipo: TipoMotivoDaTrava;
  /** Curto — cabe num chip. */
  rotulo: string;
  /** O que resolve. Vai no `title`. */
  explica: string;
}

/**
 * Por que este registro NÃO passa na trava de qualidade.
 *
 * Devolve `[]` quando passa. Só olha A10 e pendências: o status ("rascunho",
 * "publicado") é outra pergunta e tem a sua própria coluna, Situação.
 */
export function motivosDaTrava(
  r: Pick<AnuncioGeradoRegistro, "vereditoA10" | "qtdPendencias">
): MotivoDaTrava[] {
  const motivos: MotivoDaTrava[] = [];
  if (r.vereditoA10 !== "aprovado") {
    motivos.push({
      tipo: "a10",
      rotulo: "A10 reprovado",
      explica: "O diagnóstico A10 reprovou este anúncio. Rode a esteira de novo depois de corrigir.",
    });
  }
  if (r.qtdPendencias > 0) {
    motivos.push({
      tipo: "pendencias",
      rotulo: `${r.qtdPendencias} ${r.qtdPendencias === 1 ? "pendência" : "pendências"}`,
      explica: "Resolva as pendências listadas em 'ver detalhes' antes de aprovar.",
    });
  }
  return motivos;
}

/** Passou na trava de qualidade? É o `[]` de `motivosDaTrava`, com nome. */
export function passouATrava(
  r: Pick<AnuncioGeradoRegistro, "vereditoA10" | "qtdPendencias">
): boolean {
  return motivosDaTrava(r).length === 0;
}

export type FaixaDaNota = "boa" | "atenção" | "ruim";

/**
 * A faixa da nota de diagnóstico.
 *
 * Existe para que o rótulo seja TEXTO e não só a cor do badge — verde e
 * vermelho sozinhos não dizem nada a quem não distingue cor.
 */
export function faixaDaNota(nota: number): FaixaDaNota {
  if (nota >= 75) return "boa";
  if (nota >= 55) return "atenção";
  return "ruim";
}

/** A mesma trava da linha — uma regra, dois lugares que a usam. */
export function podeAprovar(r: Pick<AnuncioGeradoRegistro, "vereditoA10" | "qtdPendencias" | "status">): boolean {
  return passouATrava(r) && (r.status === "aguardando_aprovacao" || r.status === "rascunho");
}

export function podeRejeitar(r: Pick<AnuncioGeradoRegistro, "status">): boolean {
  return r.status !== "rejeitado" && r.status !== "publicado";
}

export interface PlanoDoLote {
  /** IDs que a ação alcança, na ordem da lista. */
  entram: string[];
  /** Marcados que a trava pulou. */
  pulados: number;
}

/** Separa, entre os marcados, quem entra na ação e quem a trava pula. */
export function planejarLote(
  acao: AcaoEmLote,
  marcados: ReadonlySet<string>,
  registros: readonly AnuncioGeradoRegistro[]
): PlanoDoLote {
  const elegivel = acao === "aprovar" ? podeAprovar : podeRejeitar;
  const entram: string[] = [];
  let pulados = 0;
  for (const r of registros) {
    if (!marcados.has(r.id)) continue;
    if (elegivel(r)) entram.push(r.id);
    else pulados++;
  }
  return { entram, pulados };
}

export interface ResultadoDoLote {
  feitos: number;
  /** Quem foi feito — para sair da seleção; quem falhou fica marcado. */
  feitosIds: string[];
  falhas: number;
  pulados: number;
}

/** A frase do resumo, sem esconder falha nem pulo. */
export function fraseDoResultado(acao: AcaoEmLote, r: ResultadoDoLote): string {
  const verbo = acao === "aprovar" ? "aprovado" : "rejeitado";
  const partes = [`${r.feitos} ${r.feitos === 1 ? verbo : verbo + "s"}`];
  if (r.falhas) partes.push(`${r.falhas} ${r.falhas === 1 ? "falhou" : "falharam"}`);
  if (r.pulados) partes.push(`${r.pulados} ${r.pulados === 1 ? "pulado pela trava" : "pulados pela trava"}`);
  return partes.join(" · ") + ".";
}

/** Roda a ação item a item; uma falha não interrompe as seguintes. */
export async function executarLote(
  plano: PlanoDoLote,
  acao: (id: string) => Promise<unknown>
): Promise<ResultadoDoLote> {
  const feitosIds: string[] = [];
  let falhas = 0;
  for (const id of plano.entram) {
    try {
      await acao(id);
      feitosIds.push(id);
    } catch {
      falhas++;
    }
  }
  return { feitos: feitosIds.length, feitosIds, falhas, pulados: plano.pulados };
}
