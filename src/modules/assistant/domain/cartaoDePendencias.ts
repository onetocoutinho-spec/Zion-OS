// O que o painel de pendências DECIDE — separado do que ele desenha.
//
// Mesmo motivo do `cartaoDoLote` e do `cartaoDoCadastro`: React não é testável
// neste repositório, e as decisões deste painel são as que não podem errar —
// quantas decisões o lojista tem pela frente, qual vem primeiro, e o que o
// sistema afirma conseguir fazer sozinho.
//
// A REGRA: todo número aqui vem do PLANO, que é domínio. A tela não soma nada,
// e o modelo não escreveu nenhum deles.

import type { PlanoDeResolucao, DecisaoHumana } from "./resolucaoDePendencias";
import type { TipoDePendencia } from "../../catalog/domain/pendenciasDoCatalogo";

/** O painel como a tela o recebe. */
export interface PendenciasNaTela {
  plano: PlanoDeResolucao;
  /** Quantos produtos existem de verdade. Diferente do analisado = truncado. */
  totalNoCatalogo: number;
  truncado: boolean;
}

export type EstadoDoPainel =
  /** Nada travado. A tela diz isso em vez de inventar tarefa. */
  | { estado: "nada_a_fazer"; frase: string }
  /**
   * O panorama: a linha que resume, as decisões em ordem, e o que sobra.
   *
   * `frase` é montada aqui e não pelo modelo porque ela é a resposta de "o que
   * precisa de mim?" — e os números dela decidem o dia do lojista.
   */
  | {
      estado: "panorama";
      frase: string;
      analisadas: number;
      semNovoDado: number;
      decisoes: readonly DecisaoNaTela[];
      conflitos: number;
      bloqueadas: number;
      /** Presente quando a análise não cobriu o catálogo inteiro. */
      aviso?: string;
    };

export interface DecisaoNaTela {
  id: string;
  ordem: number;
  tipo: TipoDePendencia;
  pergunta: string;
  quantos: number;
  /** Uma resposta resolve o grupo inteiro? Muda o que se pede. */
  umaRespostaServeParaTodos: boolean;
  /** Quantos alvos ela destrava. Ordena a fila. */
  destrava: number;
  bloqueia: readonly string[];
}

/**
 * O estado do painel.
 *
 * `nada_a_fazer` vem primeiro e é literal: zero pendências analisadas. Um
 * catálogo com 184 pendências das quais nenhuma vira decisão humana NÃO é
 * "nada a fazer" — é "nada a te perguntar", e são coisas diferentes.
 */
export function estadoDoPainel(p: PendenciasNaTela): EstadoDoPainel {
  const { plano } = p;
  if (plano.analisadas === 0) {
    return {
      estado: "nada_a_fazer",
      frase: "Não encontrei nenhuma pendência no seu catálogo.",
    };
  }

  const semNovoDado = plano.preparaveis.reduce((soma, x) => soma + x.alvos.length, 0);
  const bloqueadas = plano.bloqueadas.reduce((soma, b) => soma + b.quantos, 0);

  return {
    estado: "panorama",
    frase: frasePanorama(plano.analisadas, semNovoDado, plano.decisoes.length, plano.conflitos.length),
    analisadas: plano.analisadas,
    semNovoDado,
    decisoes: plano.decisoes.map((d, i) => paraTela(d, i + 1)),
    conflitos: plano.conflitos.length,
    bloqueadas,
    ...(p.truncado
      ? {
          aviso: `Analisei parte do catálogo — ${p.totalNoCatalogo} produtos no total.`,
        }
      : {}),
  };
}

function paraTela(d: DecisaoHumana, ordem: number): DecisaoNaTela {
  return {
    id: d.id,
    ordem,
    tipo: d.tipo,
    pergunta: d.pergunta,
    quantos: d.quantos,
    umaRespostaServeParaTodos: d.escopo === "valor_compartilhado",
    destrava: d.destrava,
    bloqueia: [...d.bloqueia],
  };
}

/**
 * A frase de "o que precisa de mim?".
 *
 * A ORDEM das informações é deliberada: primeiro o tamanho do problema, depois
 * o quanto dele NÃO é problema do lojista, e só então o que sobra para ele.
 * Começar pelo que ele precisa fazer transformaria um alívio em cobrança.
 */
export function frasePanorama(
  analisadas: number,
  semNovoDado: number,
  decisoes: number,
  conflitos: number
): string {
  const partes = [`${analisadas} pendência${analisadas > 1 ? "s" : ""} no catálogo.`];
  if (semNovoDado > 0) {
    partes.push(
      `${semNovoDado} eu consigo tratar sem te pedir dado novo.`
    );
  }
  if (decisoes > 0) {
    partes.push(
      decisoes > 1
        ? `O resto depende de ${decisoes} decisões suas.`
        : "O resto depende de 1 decisão sua."
    );
  } else if (semNovoDado > 0) {
    partes.push("Nada depende de você agora.");
  }
  if (conflitos > 0) {
    partes.push(`${conflitos} em conflito, esperando revisão.`);
  }
  return partes.join(" ");
}

/**
 * O que se pede numa decisão — e a diferença que muda a pergunta.
 *
 * Compartilhável: UM valor resolve N alvos. Não compartilhável: N valores, um
 * por alvo. Confundir os dois é como um EAN acabaria em trinta variantes.
 */
export function comoPedir(d: DecisaoNaTela): string {
  if (d.umaRespostaServeParaTodos) {
    return d.quantos > 1
      ? `Uma resposta resolve ${d.quantos}.`
      : "Uma resposta resolve.";
  }
  return d.quantos > 1
    ? `Cada um tem o seu — preciso de ${d.quantos} valores.`
    : "Preciso do valor deste.";
}

/**
 * A procedência como a tela a mostra.
 *
 * `desconhecida` NÃO vira "—" nem célula vazia: vira a frase inteira. Uma
 * célula vazia se lê como "ninguém preencheu ainda"; a verdade é outra — o valor
 * existe e a origem dele nunca foi registrada.
 */
export function selosDaProcedencia(origem: string): { rotulo: string; alerta: boolean } {
  if (origem === "desconhecida") {
    return { rotulo: "origem não registrada", alerta: true };
  }
  return { rotulo: origem, alerta: false };
}
