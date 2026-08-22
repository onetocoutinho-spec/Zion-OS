// A IMAGEM como Proposal — o pedido de geração que o clique autoriza.
//
// Gerar custa cota e tempo; e a imagem gerada vira candidata a foto do
// produto. Por isso é proposta (risco médio), não ação: o cartão diz o que
// vai ser gerado (slot, produto, a instrução e o feedback que entram), e só
// depois do clique o servidor gera. `texto` congela o pedido.

import { lerSlot, type SlotDeImagem } from "./briefingDeImagem";

export interface PedidoDeImagem {
  versao: 1;
  produtoId: string;
  produtoNome: string;
  slot: SlotDeImagem;
  instrucao: string;
  /** A versão recusada da qual partir, e o que a pessoa disse dela. */
  paiId?: string;
  feedback?: string;
  beneficios?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function congelarPedidoDeImagem(p: PedidoDeImagem): string {
  return JSON.stringify(p);
}

export function lerPedidoDeImagem(texto: string | null | undefined): PedidoDeImagem | null {
  if (!texto) return null;
  try {
    const p = JSON.parse(texto) as Partial<PedidoDeImagem>;
    const slot = lerSlot(p?.slot);
    if (p?.versao !== 1 || !slot || typeof p.produtoId !== "string" || !UUID.test(p.produtoId)) return null;
    return {
      versao: 1,
      produtoId: p.produtoId,
      produtoNome: typeof p.produtoNome === "string" ? p.produtoNome.slice(0, 200) : "",
      slot,
      instrucao: typeof p.instrucao === "string" ? p.instrucao.slice(0, 400) : "",
      ...(typeof p.paiId === "string" && UUID.test(p.paiId) ? { paiId: p.paiId } : {}),
      ...(typeof p.feedback === "string" && p.feedback.trim() ? { feedback: p.feedback.trim().slice(0, 400) } : {}),
      ...(typeof p.beneficios === "string" && p.beneficios.trim() ? { beneficios: p.beneficios.trim().slice(0, 600) } : {}),
    };
  } catch {
    return null;
  }
}

export function resumoDoPedidoDeImagem(p: PedidoDeImagem, rotulo: string): string {
  const base = `Gerar ${rotulo} de "${p.produtoNome}"`;
  const partes = [p.instrucao ? `pedido: ${p.instrucao}` : "", p.feedback ? `ajuste: ${p.feedback}` : ""].filter(Boolean);
  return (partes.length ? `${base} — ${partes.join("; ")}` : base).slice(0, 500);
}
