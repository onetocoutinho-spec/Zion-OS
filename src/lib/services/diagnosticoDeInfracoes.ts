// "O ML cancelou 6 anúncios e não disse por quê."
//
// 31/07/2026: detecção automática de infração de propriedade intelectual. A
// lojista descobriu abrindo o painel do Mercado Livre; o Zion não sabia que
// existiam. É a única categoria em que o erro custa a CONTA, e o único sinal
// que tínhamos (`sub_status: forbidden`) só enxerga anúncio que ainda está no
// catálogo importado.
//
// Este serviço não conserta nada. Ele PERGUNTA — e a resposta crua da conta é
// que decide o que construir depois. "A doc diz" não é "a conta respondeu".

import { cabecalhoAutenticacao } from "../supabase/sessao";
import { lerJson } from "../http/respostaJson";
import type { Infracao } from "../../modules/integration/domain/infracoesDaConta";

export interface DiagnosticoDeInfracoes {
  sellerId: string;
  sondas: {
    comPrefixoMarketplace: { url: string; status: number; erro?: string };
    semPrefixo: { url: string; status: number; erro?: string };
    usuario: { status: number; erro?: string };
  };
  varianteQueRespondeu: string | null;
  corpoCru: unknown;
  leitura: {
    infracoes: Infracao[];
    total: number;
    nenhumaDeclarada: boolean;
    formatoInesperado: string | null;
    porMotivo: { motivo: string; infracoes: number; itens: string[] }[];
  } | null;
  contaPodeAnunciar: boolean | null;
  detalhesDaModeracao: { url: string; status: number; corpo: unknown; erro?: string }[];
}

export async function diagnosticarInfracoes(clienteId: string): Promise<DiagnosticoDeInfracoes> {
  const url = `/api/ml/diagnostico-infracoes?clienteId=${encodeURIComponent(clienteId)}`;
  const resposta = await fetch(url, { headers: await cabecalhoAutenticacao() });
  const dados = await lerJson<DiagnosticoDeInfracoes & { erro?: string }>(
    resposta,
    "A consulta de infrações no Mercado Livre"
  );
  if (!resposta.ok) {
    throw new Error(dados.erro ?? "Falha ao consultar as infrações no Mercado Livre.");
  }
  return dados;
}

/**
 * O diagnóstico em texto — e a ORDEM importa.
 *
 * A conta vem primeiro. "6 infrações" e "a conta não pode anunciar" são frases
 * de urgências diferentes, e só a segunda muda o que ela faz nos próximos cinco
 * minutos.
 */
export function textoDoDiagnostico(d: DiagnosticoDeInfracoes): string {
  const partes: string[] = [];

  if (d.contaPodeAnunciar === false) {
    partes.push("⚠️ O Mercado Livre diz que esta conta NÃO pode anunciar agora.");
  } else if (d.contaPodeAnunciar === null) {
    // Silêncio não é "pode". Foi o defeito mudo que passei 02–03/08 arrancando.
    partes.push("O ML não informou se a conta pode anunciar.");
  }

  if (!d.varianteQueRespondeu) {
    const c = d.sondas.comPrefixoMarketplace.status;
    const s = d.sondas.semPrefixo.status;
    partes.push(
      `Nenhuma das duas rotas de infrações respondeu: com prefixo HTTP ${c}, sem prefixo HTTP ${s}.`
    );
    const erro = d.sondas.comPrefixoMarketplace.erro ?? d.sondas.semPrefixo.erro;
    if (erro) partes.push(erro);
    return partes.join(" ");
  }

  partes.push(`Rota que respondeu: ${d.varianteQueRespondeu}.`);

  const l = d.leitura;
  if (!l) return partes.join(" ");

  if (l.formatoInesperado) {
    // NUNCA "zero infrações" quando o formato não foi entendido.
    partes.push(`Não entendi o formato da resposta: ${l.formatoInesperado}.`);
    return partes.join(" ");
  }

  if (l.nenhumaDeclarada) {
    partes.push("O ML respondeu que não há infração nesta conta.");
    return partes.join(" ");
  }

  const totalDito = l.total >= 0 ? ` (o ML diz que são ${l.total})` : "";
  partes.push(`${l.infracoes.length} infração(ões) nesta página${totalDito}.`);

  for (const m of l.porMotivo) {
    const itens = m.itens.length > 0 ? ` — ${m.itens.slice(0, 5).join(", ")}` : "";
    partes.push(`${m.infracoes}× ${m.motivo}${itens}.`);
  }

  const comRemedio = l.infracoes.find((i) => i.remedio);
  if (comRemedio) partes.push(`O ML diz o que fazer: "${comRemedio.remedio}".`);

  return partes.join(" ");
}
