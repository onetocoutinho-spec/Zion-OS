// O que o Mercado Livre está cobrando da conta — em ordem de fazer.
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// Em 02/08/2026 a leitura completa da conta produziu, pela primeira vez, um
// retrato honesto:
//
//     28 vendas no total
//     533 anúncios no ar sem vender nenhuma      (de 544 ativos)
//     535 de 781 capas fora do padrão do ML      (68%)
//     7 anúncios bloqueados por política
//
// E tudo isso apareceu numa FAIXA DE UMA LINHA que some quando a tela recarrega.
// Números agregados, sem ordem, sem link, sem dizer por onde começar. A lojista
// lia "535 capas fora do padrão" e não tinha o que fazer com a frase.
//
// ===========================================================================
// A ORDEM É O PRODUTO
// ===========================================================================
//
// 535 fotos é trabalho de semanas. Os vinte que concentram estoque são trabalho
// de uma tarde. Sem a ordem, ela não começa — e uma lista de 535 linhas em
// ordem alfabética é tão inútil quanto o número sozinho.
//
// Três níveis, e a razão de cada um:
//
//   conta    o que pode custar a CONTA, não o anúncio. Bloqueio é política, e
//            reincidência é o que pesa. Vem primeiro mesmo sendo o menor grupo.
//   receita  o que está impedindo de vender AGORA, ordenado por estoque parado.
//   atencao  o que ela precisa saber e não é urgente.
//
// ===========================================================================
// O QUE ESTA FUNÇÃO NÃO FAZ
// ===========================================================================
//
// Não conserta nada, não escreve nada, e não afirma causa. Que foto fora do
// padrão CAUSE a falta de venda é a explicação mais simples para três números
// medidos — não é prova, e o texto não diz que é.

import { lerMaxSize, LADO_MINIMO_DA_CAPA } from "./capaForaDoPadrao";

export type Gravidade = "conta" | "receita" | "atencao";

export interface PendenciaDaConta {
  gravidade: Gravidade;
  /** Chave para agrupar na tela. */
  tipo: "bloqueado" | "capa-pequena" | "capa-nao-quadrada" | "sem-estoque" | "em-revisao" | "sem-motivo";
  mlb: string;
  permalink: string;
  titulo: string;
  /** O que ela precisa fazer, em português dela — não no jargão do ML. */
  oQueFazer: string;
  /** O fato medido que sustenta a linha. */
  porque: string;
  estoque: number;
}

export interface AnuncioParaPendencia {
  mlb: string;
  titulo: string;
  permalink: string;
  status: string;
  estoque: number;
  subStatus?: string[];
  fotoCapaMaxSize?: string;
}

export interface ResumoDePendencias {
  itens: PendenciaDaConta[];
  /** Quantas existem de cada tipo — a lista pode ser recortada, o total não. */
  totais: { tipo: PendenciaDaConta["tipo"]; quantas: number }[];
  /** Estoque parado atrás das pendências de receita. */
  estoqueTravado: number;
}

/**
 * Texto seguro na fronteira.
 *
 * `AnuncioParaPendencia` chega por JSON de `/api/ml/importar-anuncios`. Em
 * 02/08/2026 esta função quebrou com "Cannot read properties of undefined
 * (reading 'localeCompare')" porque um anúncio veio sem `mlb` — o tipo dizia
 * `string`, e o tipo não é um contrato com quem está do outro lado do fio.
 *
 * Mesma lição do `family_id` que veio número: supor o tipo é supor o valor.
 */
const txt = (v: unknown): string => (v == null ? "" : String(v));

const temSub = (a: AnuncioParaPendencia, s: string) => (a.subStatus ?? []).includes(s);
const ativo = (a: AnuncioParaPendencia) => (a.status || "").trim().toLowerCase() === "active";

/**
 * As pendências da conta, já ordenadas.
 *
 * `limitePorTipo` recorta a LISTA, nunca os totais: mostrar 20 de 535 é útil;
 * dizer que são 20 seria mentira.
 */
export function pendenciasDaConta(
  anuncios: readonly AnuncioParaPendencia[],
  limitePorTipo = 25
): ResumoDePendencias {
  const todas: PendenciaDaConta[] = [];

  for (const a of anuncios) {
    const base = {
      mlb: txt(a.mlb),
      permalink: txt(a.permalink),
      titulo: txt(a.titulo) || txt(a.mlb) || "(anúncio sem título)",
      estoque: Number(a.estoque) || 0,
    };

    // 1) CONTA — bloqueio é política, e reincidência custa a conta inteira.
    if (temSub(a, "forbidden")) {
      todas.push({
        ...base,
        gravidade: "conta",
        tipo: "bloqueado",
        oQueFazer: "Abra no Mercado Livre e leia a acusação. Corrija ou encerre.",
        porque: "O Mercado Livre bloqueou este anúncio por violação de política.",
      });
      continue; // bloqueio manda; não polui a lista com o resto
    }

    // 2) RECEITA — a capa fora do padrão tira exposição. Só conta para quem
    //    está NO AR: mandar refotografar um anúncio pausado é trabalho jogado
    //    fora enquanto ele não voltar.
    // DUAS pendências diferentes, com remédios diferentes — e chamar as duas de
    // "refotografe" mandava a lojista fotografar de novo o que só precisa de
    // faixa branca. Medido em 02/08/2026 na conta dela: `993x1200`, `961x1200`
    // e `896x1152` não são fotos pequenas, são fotos EM PÉ.
    //
    //   lado maior >= 1200  ->  só falta virar quadrada. Ajuste, não fotografia.
    //   lado maior <  1200  ->  não há pixel para recuperar. Foto nova.
    const capa = lerMaxSize(a.fotoCapaMaxSize);
    if (ativo(a) && capa && !(capa.quadrada && capa.grandeOSuficiente)) {
      const maior = Math.max(capa.largura, capa.altura);
      const daParaAjustar = maior >= LADO_MINIMO_DA_CAPA;
      todas.push({
        ...base,
        gravidade: "receita",
        tipo: daParaAjustar ? "capa-nao-quadrada" : "capa-pequena",
        oQueFazer: daParaAjustar
          ? "A foto tem tamanho suficiente e só não é quadrada. Basta completar as laterais com fundo branco até ficar quadrada — não precisa fotografar de novo."
          : `Precisa de foto nova: o maior lado tem ${maior} pixels e o Mercado Livre pede ${LADO_MINIMO_DA_CAPA}. Não há como ampliar sem perder qualidade.`,
        porque: `A capa tem ${capa.largura}x${capa.altura} — fora do padrão que o Mercado Livre exige para dar exposição.`,
      });
    }

    if (temSub(a, "out_of_stock")) {
      todas.push({
        ...base,
        gravidade: "receita",
        tipo: "sem-estoque",
        oQueFazer: "Reponha o estoque ou encerre o anúncio.",
        porque: "O Mercado Livre tirou do ar por falta de estoque.",
      });
    }

    // 3) ATENÇÃO — ela precisa saber, e não há ação imediata clara.
    if (temSub(a, "waiting_for_patch")) {
      todas.push({
        ...base,
        gravidade: "atencao",
        tipo: "em-revisao",
        oQueFazer: "Abra no Mercado Livre: ele está pedindo uma correção e só o painel diz qual.",
        porque: "O Mercado Livre marcou o anúncio como aguardando correção.",
      });
    }

    if ((a.subStatus ?? []).length === 0 && !ativo(a)) {
      todas.push({
        ...base,
        gravidade: "atencao",
        tipo: "sem-motivo",
        oQueFazer: "Abra no Mercado Livre para ver o que houve.",
        porque: "O anúncio não está no ar e o Mercado Livre não informou o motivo.",
      });
    }
  }

  const PESO: Record<Gravidade, number> = { conta: 0, receita: 1, atencao: 2 };
  // Dentro da mesma gravidade, MAIOR ESTOQUE primeiro: é onde o dinheiro está
  // parado. Empate desempata pelo MLB para a ordem ser determinística — duas
  // execuções da mesma conta precisam produzir a mesma lista.
  todas.sort(
    (x, y) =>
      PESO[x.gravidade] - PESO[y.gravidade] ||
      y.estoque - x.estoque ||
      txt(x.mlb).localeCompare(txt(y.mlb))
  );

  const contagem = new Map<PendenciaDaConta["tipo"], number>();
  for (const p of todas) contagem.set(p.tipo, (contagem.get(p.tipo) ?? 0) + 1);

  const mostradas = new Map<PendenciaDaConta["tipo"], number>();
  const itens = todas.filter((p) => {
    const n = (mostradas.get(p.tipo) ?? 0) + 1;
    mostradas.set(p.tipo, n);
    return n <= limitePorTipo;
  });

  return {
    itens,
    totais: [...contagem.entries()]
      .map(([tipo, quantas]) => ({ tipo, quantas }))
      .sort((a, b) => b.quantas - a.quantas),
    estoqueTravado: todas
      .filter((p) => p.gravidade === "receita")
      .reduce((t, p) => t + (p.estoque || 0), 0),
  };
}
