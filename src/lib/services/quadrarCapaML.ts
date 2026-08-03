// Deixar a capa quadrada — a chamada, com a resposta em português dela.
//
// O que isto faz no Mercado Livre: sobe uma versão quadrada da foto que já
// está lá e a coloca como capa, mantendo TODAS as antigas atrás. Nada é
// apagado; a original vira a segunda foto e pode voltar a ser capa.
//
// Um anúncio por vez, de propósito. Isto escreve no anúncio ao vivo, e um lote
// que reescreve 341 anúncios errado não se desfaz.

import { cabecalhoAutenticacao } from "../supabase/sessao";
import { lerJson } from "../http/respostaJson";

export interface CapaQuadrada {
  itemId: string;
  de: string;
  para: string;
  fotosAntes: number;
  fotosDepois: number;
}

/** Lançado quando a foto não serve para este conserto — não é falha nossa. */
export class CapaNaoAplicavelError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "CapaNaoAplicavelError";
  }
}

export async function quadrarCapaNoML(clienteId: string, itemId: string): Promise<CapaQuadrada> {
  const resposta = await fetch("/api/ml/quadrar-capa", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ clienteId, itemId }),
  });
  const dados = await lerJson<{
    itemId?: string;
    de?: string;
    para?: string;
    fotosAntes?: number;
    fotosDepois?: number;
    erro?: string;
    naoAplicavel?: boolean;
  }>(resposta, "O ajuste da foto de capa");

  if (!resposta.ok) {
    // A distinção importa: "esta foto não serve" é informação sobre o anúncio;
    // "falhou" é problema nosso. Misturar as duas faria a lojista tentar de
    // novo o que nunca vai funcionar.
    if (dados.naoAplicavel) throw new CapaNaoAplicavelError(dados.erro ?? "Esta foto não serve.");
    throw new Error(dados.erro ?? "Falha ao ajustar a foto de capa.");
  }
  return {
    itemId: dados.itemId ?? itemId,
    de: dados.de ?? "",
    para: dados.para ?? "",
    fotosAntes: dados.fotosAntes ?? 0,
    fotosDepois: dados.fotosDepois ?? 0,
  };
}

/**
 * A frase do resultado — e ela DIZ se alguma foto se perdeu.
 *
 * O ML substitui o conjunto de fotos quando recebe `pictures`. A rota manda as
 * antigas junto justamente para não perder nenhuma, mas afirmar que preservou
 * sem conferir seria confiar no que a gente mesmo escreveu. O número vem da
 * resposta do ML.
 */
export function explicarCapaQuadrada(r: CapaQuadrada): string {
  const base = `Capa ajustada de ${r.de} para ${r.para}.`;
  if (r.fotosDepois < r.fotosAntes) {
    return `${base} ATENÇÃO: o anúncio tinha ${r.fotosAntes} fotos e ficou com ${r.fotosDepois}. Confira no Mercado Livre.`;
  }
  return `${base} As ${r.fotosAntes} fotos originais continuam no anúncio, atrás da nova.`;
}
