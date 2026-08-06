// O que o Mercado Livre já disse sobre a vitrine — em ordem de urgência.
//
// ===========================================================================
// O DEFEITO QUE ESTE MÓDULO EXISTE PARA MATAR
// ===========================================================================
//
// Os dois lados desta conta já estavam no banco, e nunca se encontraram na
// tela:
//
//   · `anuncios_gerados.status_marketplace` — a PALAVRA do ML sobre cada
//     anúncio, lida em 03/08. Medido na conta real: 491 `active`, **155
//     `under_review`**, **121 `paused`**, 12 `closed`, 2 `inactive`, 99 sem
//     estado conhecido.
//   · `infracoes_marketplace` — 1.060 infrações em 460 anúncios, das quais
//     **1.028 já vêm com o remédio escrito pelo próprio ML**.
//
// A tela de anúncios mostra o primeiro (o selo por linha) e ignora o segundo.
// A lojista lê "Pausado no ML" e não tem como saber por quê, nem o que fazer —
// mesmo com a resposta gravada, com a mesma chave, a uma junção de distância.
//
// ===========================================================================
// TRÊS REGRAS QUE ESTE MÓDULO CONGELA
// ===========================================================================
//
// 1. CONTA-SE ANÚNCIO, NUNCA INFRAÇÃO. O mesmo anúncio aparece várias vezes na
//    lista de infrações (média de 2,3). `infracoesMarketplace` já registra esse
//    erro em comentário: "1.060 lido como 1.060 anúncios quando são 460".
//
// 2. A CAUSA VEM DO REMÉDIO, NÃO DO SUBGRUPO. Medido em 06/08: o subgrupo
//    "PQT" parece ser a ficha do produto, e o remédio de 344 das suas 362 é o
//    MESMO TEXTO das FOTOS — "A foto de capa não cumpre os requisitos".
//    Agrupar por subgrupo mostra três problemas onde há um, 1.026 vezes.
//
// 3. `null` É "NÃO SABEMOS", NUNCA "ESTÁ OK". É a lei da migração 050, e os 99
//    anúncios sem estado são exatamente o tamanho do engano que ela evita.

/** O que o ML respondeu sobre um anúncio, com a infração dele junto. */
export interface AnuncioNaVitrine {
  /** MLB. Sem ele o anúncio não está no ar e não entra nesta conta. */
  mlItemId: string | null;
  /** A palavra do ML, verbatim. `null` = não lemos ainda. */
  statusMarketplace: string | null;
  /** O nome que a lojista reconhece. */
  produto: string;
}

/** Já limpo de HTML na borda de leitura (`infracoesPorAnuncioDoCliente`). */
export interface InfracaoDoAnuncio {
  motivo: string;
  remedio: string;
}

/**
 * A urgência, e a ordem é a resposta inteira do módulo.
 *
 * `fora_do_ar` primeiro porque é a única que custa dinheiro AGORA: o anúncio
 * não aparece para quem procura. `penalizado` incomoda; `fora_do_ar` sangra.
 */
export type Urgencia = "fora_do_ar" | "sob_revisao" | "penalizado" | "nao_sabemos";

export const ORDEM_DA_URGENCIA: readonly Urgencia[] = [
  "fora_do_ar",
  "sob_revisao",
  "penalizado",
  "nao_sabemos",
] as const;

export interface AnuncioDiagnosticado {
  mlItemId: string;
  produto: string;
  urgencia: Urgencia;
  /** A palavra do ML, para a tela mostrar o que ele disse e não o que supomos. */
  statusMarketplace: string | null;
  /** O que o ML mandou fazer. Vazio quando ele puniu sem dizer. */
  remedios: string[];
  /** Quantas infrações neste MESMO anúncio. */
  quantasInfracoes: number;
}

export interface DiagnosticoDaVitrine {
  /** Em ordem de urgência, e dentro dela pelo que tem mais infração. */
  anuncios: AnuncioDiagnosticado[];
  /** Quantos ANÚNCIOS por urgência — nunca quantas infrações. */
  contagem: Record<Urgencia, number>;
  /**
   * A causa mais comum entre os remédios, em anúncios.
   *
   * É o número que muda a conversa: "400 anúncios com problema" manda a
   * lojista abrir 400 abas; "quase tudo é foto" manda ela chamar um fotógrafo.
   */
  causaDominante: { causa: string; anuncios: number; pct: number } | null;
}

/**
 * Traduz a palavra do ML em urgência.
 *
 * Estado desconhecido cai em `nao_sabemos` e NÃO vira `penalizado`: inventar
 * gravidade a partir de uma palavra que não reconhecemos é o mesmo erro que
 * `rotuloStatusMarketplace` evita ao mostrar a palavra crua.
 */
export function urgenciaDoEstado(
  status: string | null | undefined,
  temInfracao: boolean
): Urgencia {
  const s = (status ?? "").trim().toLowerCase();
  if (!s) return "nao_sabemos";
  if (s === "paused" || s === "closed" || s === "inactive") return "fora_do_ar";
  if (s === "under_review") return "sob_revisao";
  if (s === "active") return temInfracao ? "penalizado" : "nao_sabemos";
  // Palavra nova do ML: não sabemos o que significa, e dizer que é grave seria
  // inventar. Ela aparece na tela com o texto cru, por `rotuloStatusMarketplace`.
  return "nao_sabemos";
}

/**
 * A família da causa, lida do REMÉDIO.
 *
 * Devolve a frase do próprio ML, normalizada só o suficiente para agrupar —
 * não uma taxonomia nossa. Traduzir "descumpre o tamanho mínimo, posição e
 * proporção" para uma etiqueta interna perderia justamente a instrução que
 * a lojista precisa dar ao fotógrafo.
 */
export function familiaDoRemedio(remedio: string): string {
  const t = remedio.toLowerCase();
  if (/foto|imagem|capa/.test(t)) return "Fotos";
  if (/t[íi]tulo/.test(t)) return "Título";
  if (/cat[áa]logo/.test(t)) return "Catálogo";
  if (/duplicad|repetid/.test(t)) return "Anúncio duplicado";
  if (!t.trim()) return "O ML não disse";
  return "Outros";
}

/** Ordena por urgência e, dentro dela, por quantidade de infrações. */
function comparar(a: AnuncioDiagnosticado, b: AnuncioDiagnosticado): number {
  const ua = ORDEM_DA_URGENCIA.indexOf(a.urgencia);
  const ub = ORDEM_DA_URGENCIA.indexOf(b.urgencia);
  if (ua !== ub) return ua - ub;
  if (b.quantasInfracoes !== a.quantasInfracoes) {
    return b.quantasInfracoes - a.quantasInfracoes;
  }
  // Desempate estável: sem ele a lista muda de ordem entre renderizações e a
  // pessoa perde o lugar onde estava.
  return a.mlItemId.localeCompare(b.mlItemId);
}

export function diagnosticarVitrine(
  anuncios: readonly AnuncioNaVitrine[],
  infracoesPorAnuncio: Readonly<Record<string, readonly InfracaoDoAnuncio[]>>
): DiagnosticoDaVitrine {
  const diagnosticados: AnuncioDiagnosticado[] = [];
  // Um anúncio por MLB, e não uma linha por infração — a regra 1.
  const vistos = new Set<string>();

  for (const a of anuncios) {
    const mlb = (a.mlItemId ?? "").trim();
    if (!mlb || vistos.has(mlb)) continue;
    vistos.add(mlb);

    const infracoes = infracoesPorAnuncio[mlb] ?? [];
    const urgencia = urgenciaDoEstado(a.statusMarketplace, infracoes.length > 0);

    diagnosticados.push({
      mlItemId: mlb,
      produto: a.produto,
      urgencia,
      statusMarketplace: a.statusMarketplace,
      // Remédios distintos: o mesmo texto repetido três vezes não informa três
      // vezes mais.
      remedios: [...new Set(infracoes.map((i) => i.remedio).filter(Boolean))],
      quantasInfracoes: infracoes.length,
    });
  }

  diagnosticados.sort(comparar);

  const contagem: Record<Urgencia, number> = {
    fora_do_ar: 0,
    sob_revisao: 0,
    penalizado: 0,
    nao_sabemos: 0,
  };
  for (const d of diagnosticados) contagem[d.urgencia] += 1;

  return {
    anuncios: diagnosticados,
    contagem,
    causaDominante: dominante(diagnosticados),
  };
}

/** A causa que mais aparece, contada em ANÚNCIOS. */
function dominante(
  diagnosticados: readonly AnuncioDiagnosticado[]
): DiagnosticoDaVitrine["causaDominante"] {
  const porCausa = new Map<string, Set<string>>();
  for (const d of diagnosticados) {
    // Um anúncio conta UMA vez por família, mesmo com cinco infrações dela.
    for (const familia of new Set(d.remedios.map(familiaDoRemedio))) {
      (porCausa.get(familia) ?? porCausa.set(familia, new Set()).get(familia)!).add(d.mlItemId);
    }
  }
  const comInfracao = diagnosticados.filter((d) => d.remedios.length > 0).length;
  if (comInfracao === 0) return null;

  const [causa, itens] = [...porCausa.entries()].sort((a, b) => b[1].size - a[1].size)[0];
  return {
    causa,
    anuncios: itens.size,
    pct: Math.round((itens.size / comInfracao) * 100),
  };
}
