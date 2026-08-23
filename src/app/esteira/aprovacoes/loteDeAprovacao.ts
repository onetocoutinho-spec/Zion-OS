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

/** A mesma trava da linha — uma regra, dois lugares que a usam. */
export function podeAprovar(r: Pick<AnuncioGeradoRegistro, "vereditoA10" | "qtdPendencias" | "status">): boolean {
  const passouA10 = r.vereditoA10 === "aprovado" && r.qtdPendencias === 0;
  return passouA10 && (r.status === "aguardando_aprovacao" || r.status === "rascunho");
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
