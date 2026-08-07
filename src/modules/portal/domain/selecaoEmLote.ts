// Escolher vários e agir uma vez — e as três armadilhas disso.
//
// ===========================================================================
// O QUE FOI MEDIDO ANTES DE DESENHAR
// ===========================================================================
//
// 06/08/2026, na base de produção (80 produtos):
//
//   kits/combos cadastrados ................. 0
//   tabelas de medidas salvas ............... 0
//   produtos que já passaram pela fila ...... 72
//
// A tela de Produtos tinha TRÊS botões por linha — Kit, Medidas, Otimizar —
// vezes 80 linhas. Cento e sessenta deles são de funções que esta lojista nunca
// usou uma única vez, e os outros oitenta apontavam todos para a MESMA URL sem
// levar o produto da linha (`/cliente/anunciar`, sem `?produto=`), jogando fora
// a única informação que a linha tinha.
//
// Os 72 dizem a outra metade: ela JÁ otimiza em lote. Só que a única
// granularidade era "tudo" ou "os que faltam" — nunca "esses doze".
//
// ===========================================================================
// AS TRÊS ARMADILHAS
// ===========================================================================
//
// 1. MARCAR TODOS marca todos de QUÊ. Da lista filtrada, não da base. Uma
//    caixa mestre que marca 80 quando a tela mostra 3 age fora do que ela vê.
//
// 2. O FILTRO ESCONDE O QUE ESTÁ MARCADO. Ela marca 12, muda o filtro, e 4
//    somem da tela — mas continuam marcados. Agir em silêncio sobre linha que
//    ela não está vendo é o mesmo defeito que atravessa este projeto: afirmar
//    o que não foi visto. A seleção sobrevive ao filtro (perder marca dá mais
//    raiva que manter), mas a barra tem que DIZER quantos estão fora.
//
// 3. A COTA CORTA. `enfileirar` fazia `slice(0, restante)` e avisava DEPOIS.
//    Ela escolhe 30, entram 10, e as outras 20 somem sem que ela saiba quais.
//    O corte é dito ANTES, no lugar onde ela decide.

export type EstadoDaMarcaMestre = "nenhum" | "parcial" | "todos";

/**
 * O estado da caixa mestre, medido contra a lista VISÍVEL.
 *
 * Marcas fora do filtro não fazem a caixa virar "todos": senão ela apareceria
 * cheia numa tela onde nem tudo está marcado.
 */
export function estadoDaMarcaMestre(
  visiveis: readonly string[],
  marcados: ReadonlySet<string>
): EstadoDaMarcaMestre {
  if (visiveis.length === 0) return "nenhum";
  let quantos = 0;
  for (const id of visiveis) if (marcados.has(id)) quantos++;
  if (quantos === 0) return "nenhum";
  return quantos === visiveis.length ? "todos" : "parcial";
}

/**
 * O que a caixa mestre faz — e o que ela NÃO faz.
 *
 * Marca (ou desmarca) apenas os visíveis. O que o filtro escondeu fica como
 * estava: desmarcar em massa o que ela não está vendo é destruir escolha às
 * cegas, exatamente o que a caixa parece não fazer.
 */
export function alternarTodos(
  visiveis: readonly string[],
  marcados: ReadonlySet<string>
): Set<string> {
  const novo = new Set(marcados);
  if (estadoDaMarcaMestre(visiveis, marcados) === "todos") {
    for (const id of visiveis) novo.delete(id);
  } else {
    for (const id of visiveis) novo.add(id);
  }
  return novo;
}

/** Marca ou desmarca uma linha. */
export function alternarUm(id: string, marcados: ReadonlySet<string>): Set<string> {
  const novo = new Set(marcados);
  if (!novo.delete(id)) novo.add(id);
  return novo;
}

export interface ResumoDaSelecao {
  /** Quantos estão marcados ao todo. */
  total: number;
  /** Quantos deles a lista atual mostra. */
  visiveis: number;
  /** Quantos deles o filtro escondeu. */
  ocultos: number;
  /** O que a barra diz. Vazio quando não há seleção. */
  frase: string;
}

/**
 * O que a barra de seleção afirma — incluindo o que ela esconde.
 *
 * A frase existe por causa da armadilha 2: sem ela, "Otimizar 12" agiria sobre
 * quatro linhas que saíram da tela e ninguém saberia por que a conta não bate.
 */
export function resumoDaSelecao(
  marcados: ReadonlySet<string>,
  visiveis: readonly string[]
): ResumoDaSelecao {
  const total = marcados.size;
  if (total === 0) return { total: 0, visiveis: 0, ocultos: 0, frase: "" };

  const naTela = new Set(visiveis);
  let contaVisiveis = 0;
  for (const id of marcados) if (naTela.has(id)) contaVisiveis++;
  const ocultos = total - contaVisiveis;

  const base = total === 1 ? "1 produto selecionado" : `${total} produtos selecionados`;
  const fora =
    ocultos === 0
      ? ""
      : ocultos === 1
        ? " — 1 deles está fora do filtro atual"
        : ` — ${ocultos} deles estão fora do filtro atual`;

  return { total, visiveis: contaVisiveis, ocultos, frase: base + fora };
}

export interface CorteDaCota {
  /** Quantos entram na fila de fato. */
  entram: number;
  /** Quantos ficam para o mês que vem. */
  ficamDeFora: number;
  /** O aviso, ou `null` quando nada é cortado. */
  frase: string | null;
}

/**
 * Quantos cabem na cota do mês — dito ANTES, não depois.
 *
 * `restante` negativo é tratado como zero: cota estourada é cota zerada, nunca
 * uma dívida que faria `slice` receber um número negativo e devolver o FIM da
 * lista em vez do começo.
 */
export function corteDaCota(selecionados: number, restante: number): CorteDaCota {
  const cabe = Math.max(0, restante);
  const entram = Math.min(selecionados, cabe);
  const ficamDeFora = selecionados - entram;

  if (ficamDeFora === 0) return { entram, ficamDeFora: 0, frase: null };
  if (entram === 0) {
    return {
      entram: 0,
      ficamDeFora,
      frase: "Sua cota de otimizações deste mês acabou. Nenhum destes entra agora.",
    };
  }
  return {
    entram,
    ficamDeFora,
    frase:
      `Sua cota permite ${entram} agora — ` +
      `${ficamDeFora === 1 ? "o outro fica" : `os outros ${ficamDeFora} ficam`} para o mês que vem.`,
  };
}
