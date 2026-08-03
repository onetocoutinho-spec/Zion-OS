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
import { semHtml, type Infracao } from "../../modules/integration/domain/infracoesDaConta";
import { gravarInfracoes } from "./infracoesMarketplace";

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
    /** O que o ML DIZ que a conta tem. */
    total: number;
    /** O que conseguimos ler. Nunca igualado ao total. */
    lidas: number;
    paginasLidas: number;
    paginasComFalha: { offset: number; status: number; erro?: string }[];
    /** Infrações ≠ anúncios: o mesmo MLB pode ser punido muitas vezes. */
    anunciosDistintos: number;
    infracoesSemAnuncio: number;
    nenhumaDeclarada: boolean;
    formatoInesperado: string | null;
    porMotivo: { motivo: string; infracoes: number; itens: string[] }[];
  } | null;
  contaPodeAnunciar: boolean | null;
  detalhesDaModeracao: { url: string; status: number; corpo: unknown; erro?: string }[];
}

/**
 * Lê no ML e GRAVA (migração 052) — nesta ordem, e a ordem é o ponto.
 *
 * A gravação vem DEPOIS da leitura inteira e nunca a substitui: se o banco
 * recusar, o diagnóstico continua verdadeiro na tela e a contagem de falhas
 * aparece. O contrário — não mostrar nada porque a escrita falhou — perderia a
 * única leitura completa que a lojista mandou fazer.
 */
export async function diagnosticarEGravar(
  clienteId: string
): Promise<{ diagnostico: DiagnosticoDeInfracoes; gravadas: number; falharam: number }> {
  const diagnostico = await diagnosticarInfracoes(clienteId);
  const lidas = diagnostico.leitura?.infracoes ?? [];
  if (lidas.length === 0) return { diagnostico, gravadas: 0, falharam: 0 };

  const lidaEm = new Date().toISOString();
  const { gravadas, falharam } = await gravarInfracoes(
    lidas.map((i) => ({
      ...i,
      clienteId,
      marketplace: "Mercado Livre",
      // O idioma que VEIO. Pedimos PT e um motivo voltou em espanhol
      // ("Algunas fotos incumplen los requisitos") — registrar é a única forma
      // de a tela não misturar idiomas sem ninguém entender por quê.
      idioma: /[ñ]|\b(los|las|una|sus|deben|cumplen)\b/i.test(i.motivo) ? "es" : "pt",
      lidaEm,
    }))
  );
  return { diagnostico, gravadas, falharam };
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

  // OS TRÊS CASOS SÃO DITOS, inclusive o bom.
  //
  // A primeira versão só falava quando era `false` ou `null`, e na leitura real
  // de 03/08 o resultado bom saiu como SILÊNCIO — a leitora tinha que deduzir
  // "ele não reclamou, então pode". Silêncio afirmando é exatamente o defeito
  // que passamos dois dias arrancando desta base, e eu o reintroduzi aqui.
  if (d.contaPodeAnunciar === false) {
    partes.push("⚠️ O Mercado Livre diz que esta conta NÃO pode anunciar agora.");
  } else if (d.contaPodeAnunciar === null) {
    partes.push("O ML não informou se a conta pode anunciar.");
  } else {
    partes.push("A conta AINDA pode anunciar (o ML confirmou).");
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

  // A FRASE QUE MUDA A DECISÃO: infrações não são anúncios.
  //
  // Medido em 03/08/2026: o ML declarou 1.060 infrações e o mesmo
  // `MLB4820492395` aparecia cinco vezes na primeira página. "1.060 anúncios
  // punidos" e "80 anúncios punidos 1.060 vezes" pedem trabalhos opostos.
  const totalDito = l.total >= 0 && l.total !== l.lidas ? ` de ${l.total} que o ML declara` : "";
  partes.push(
    `${l.lidas} infração(ões)${totalDito}, em ${l.anunciosDistintos} anúncio(s) distinto(s)` +
      (l.infracoesSemAnuncio > 0 ? ` e ${l.infracoesSemAnuncio} sem anúncio associado` : "") +
      ` — ${l.paginasLidas} página(s) lida(s).`
  );

  if (l.paginasComFalha.length > 0) {
    const f = l.paginasComFalha[0];
    partes.push(
      `A leitura PAROU no offset ${f.offset} (HTTP ${f.status}) — o que está acima disso não foi visto.`
    );
  }

  for (const m of l.porMotivo) {
    const itens = m.itens.length > 0 ? ` — ${m.itens.length} anúncio(s), ex.: ${m.itens.slice(0, 3).join(", ")}` : "";
    partes.push(`${m.infracoes}× ${m.motivo}${itens}.`);
  }

  // Sem as tags: o `remedy` vem em HTML, e a tela mostrava `<div><strong>` cru.
  const comRemedio = l.infracoes.find((i) => i.remedio);
  if (comRemedio) partes.push(`O ML diz o que fazer: "${semHtml(comRemedio.remedio)}".`);

  return partes.join(" ");
}
