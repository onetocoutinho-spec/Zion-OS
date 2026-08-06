// A frase que abre a tela "Hoje" — e quantas lacunas ela mostra.
//
// ===========================================================================
// POR QUE UMA FRASE, E NÃO OITO NÚMEROS
// ===========================================================================
//
// A área se chama "Hoje" e a pergunta dela, em UX-010, é "o que importa
// agora?". A tela respondia com oito cartões de número e seis cartões de
// escolha ANTES da lista do que está travando — 14 elementos antes da resposta.
//
// Oito números iguais não são oito informações: são a decisão adiada oito
// vezes. A prova de conceito está na faixa de Anúncios (06/08), que traduz
// 1.060 infrações numa frase e muda o que a lojista faz.
//
// Este módulo NÃO decide o que está travado — `lacunasDaLoja` já faz isso, e
// bem, ordenando "por quanto destrava, não por quantidade". Aqui só se decide
// **como isso vira uma frase** e **quantas cabem antes de virar lista.**

import type { Lacuna } from "../../publication/domain/prontidaoDaLoja";

/**
 * Quantas lacunas aparecem inteiras.
 *
 * Três, e o número tem motivo: a tela que este trabalho substitui mostrava oito
 * cartões, e o defeito não era o conteúdo — era a quantidade. Trocar oito
 * números por oito lacunas seria a mesma tela com outro nome.
 *
 * O resto não some: vira uma linha dizendo quantos são. Esconder a contagem
 * seria mentir por omissão; mostrar tudo seria não ter decidido nada.
 */
export const QUANTAS_APARECEM = 3;

export interface AberturaDoHoje {
  /** A frase. Uma só, e ela é a tela. */
  frase: string;
  /** As que aparecem inteiras, na ordem que `lacunasDaLoja` já definiu. */
  visiveis: Lacuna[];
  /** Quantas ficaram de fora. 0 quando cabem todas. */
  restantes: number;
  /** `true` quando não há nada travado — a tela diz isso e não inventa tarefa. */
  emDia: boolean;
}

/** Concorda o verbo e o plural sem depender de biblioteca. */
const plural = (n: number, um: string, muitos: string) => (n === 1 ? um : muitos);

/**
 * Monta a abertura da tela a partir do que já está travado.
 *
 * A REGRA DA FRASE: ela nomeia a CONSEQUÊNCIA, não a contagem.
 *
 * "3 pontos a resolver" é um número sobre nós — sobre a nossa lista. "3 coisas
 * estão travando sua loja" é um fato sobre a loja dela, e é o que faz alguém
 * levantar da cadeira. É a mesma regra que `prontidaoDaLoja` já aplica dentro
 * de cada lacuna, com o campo `trava`; aqui ela sobe para o título.
 *
 * QUANDO ALGO BLOQUEIA TUDO, a frase é sobre isso e só isso. Somar "e mais
 * duas" a uma parede é convidar a pessoa a escolher a menor — e a menor não
 * destrava nada enquanto a parede estiver de pé.
 */
export function aberturaDoHoje(lacunas: readonly Lacuna[]): AberturaDoHoje {
  if (lacunas.length === 0) {
    return {
      frase: "Nada travado. Sua loja está em dia.",
      visiveis: [],
      restantes: 0,
      emDia: true,
    };
  }

  const parede = lacunas.find((l) => l.bloqueiaTudo);
  const visiveis = lacunas.slice(0, QUANTAS_APARECEM);
  const restantes = Math.max(0, lacunas.length - visiveis.length);

  if (parede) {
    return { frase: parede.titulo, visiveis: [parede], restantes: 0, emDia: false };
  }

  const n = lacunas.length;
  return {
    frase: `${n} ${plural(n, "coisa está", "coisas estão")} travando sua loja.`,
    visiveis,
    restantes,
    emDia: false,
  };
}
