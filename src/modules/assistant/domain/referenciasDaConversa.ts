// "O segundo."
//
// Quando o assistente mostra três candidatos e o lojista responde "o segundo",
// existem duas formas de resolver isso, e uma delas é errada:
//
//   ERRADA   guardar a string "o segundo" e reinterpretá-la depois
//   CERTA    guardar o CONJUNTO que foi mostrado e resolver o ordinal contra ele
//
// A primeira parece funcionar até a lista mudar de ordem, ou até o modelo
// reconstruir uma lista parecida no turno seguinte. Aí "o segundo" aponta para
// outro produto, e nada na tela denuncia isso.
//
// Por isso a mensagem do assistente carrega, em `metadata`, os IDS que ela
// apresentou e em que ordem. "O segundo" vira `productId B` UMA vez, no
// servidor, contra o conjunto que aquela mensagem realmente mostrou — e daí em
// diante toda ação usa B.
//
// A REGRA QUE IMPEDE A CONFUSÃO ENTRE LISTAS:
//
//     só o conjunto da ÚLTIMA fala do assistente é referenciável
//
// Uma lista de três turnos atrás não é "a lista" para ninguém. Se a última fala
// não mostrou candidatos, "o segundo" não tem referente — e a resposta certa é
// perguntar, não procurar a lista mais recente que por acaso exista.

/** O que pode ser referenciado. Lista fechada: cada um tem id real no banco. */
export type TipoDeReferencia = "produto" | "cadastro" | "variante";

export interface ItemApresentado {
  /** 1-based, na ordem em que apareceu na tela. É o que "o segundo" endereça. */
  ordem: number;
  tipo: TipoDeReferencia;
  id: string;
  rotulo: string;
}

export interface ConjuntoApresentado {
  /** De onde a lista veio. Ajuda a mensagem de erro a ser específica. */
  origem: "busca" | "cadastros" | "duplicidade";
  itens: readonly ItemApresentado[];
}

/** Quantos itens de uma lista são endereçáveis por ordinal. */
export const MAXIMO_REFERENCIAVEL = 10;

const ORDINAIS: Record<string, number> = {
  primeiro: 1,
  primeira: 1,
  segundo: 2,
  segunda: 2,
  terceiro: 3,
  terceira: 3,
  quarto: 4,
  quarta: 4,
  quinto: 5,
  quinta: 5,
  sexto: 6,
  sexta: 6,
  setimo: 7,
  setima: 7,
  oitavo: 8,
  oitava: 8,
  nono: 9,
  nona: 9,
  decimo: 10,
  decima: 10,
};

function semAcento(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * O ordinal que a frase carrega — ou `null`.
 *
 * "o último" resolve pelo tamanho do conjunto, e por isso precisa dele. Sem o
 * tamanho, "último" é tão indeterminado quanto "aquele".
 */
export function lerOrdinal(bruto: string, tamanhoDoConjunto = 0): number | null {
  const t = semAcento(String(bruto ?? "").trim());
  if (!t) return null;

  if (/\bultim[oa]\b/.test(t)) return tamanhoDoConjunto > 0 ? tamanhoDoConjunto : null;

  for (const [palavra, n] of Object.entries(ORDINAIS)) {
    if (new RegExp(`\\b${palavra}\\b`).test(t)) return n;
  }
  // "o 2", "2", "n. 3", "3º". Só número solto — "01040533" não é ordinal, e o
  // corte em dois dígitos é o que impede um SKU de virar posição de lista.
  const m = t.match(/(?:^|\s|#|n[.º°]?\s*)(\d{1,2})\s*[º°.]?(?:$|\s)/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= MAXIMO_REFERENCIAVEL) return n;
  }
  return null;
}

export type Escolha =
  | { ok: true; item: ItemApresentado }
  | { ok: false; motivo: string };

/**
 * "O segundo" → o item.
 *
 * Aceita também o ID cru: quando o modelo já tem o id (porque `achar_produto`
 * devolveu um só), resolver por ordinal seria dar uma volta para chegar no mesmo
 * lugar. O que não se aceita é um id que NÃO está no conjunto — aí ele veio de
 * outro lugar, e "outro lugar" é a definição de alucinação estrutural.
 */
export function resolverEscolha(
  bruto: string,
  conjunto: ConjuntoApresentado | null
): Escolha {
  const texto = String(bruto ?? "").trim();
  if (!texto) return { ok: false, motivo: "Não entendi qual você escolheu." };
  if (!conjunto || conjunto.itens.length === 0) {
    return {
      ok: false,
      motivo: "Eu não mostrei uma lista agora há pouco. Me diga qual produto, pelo nome ou pelo código.",
    };
  }

  const porId = conjunto.itens.find((i) => i.id === texto);
  if (porId) return { ok: true, item: porId };

  const ordem = lerOrdinal(texto, conjunto.itens.length);
  if (ordem === null) {
    return {
      ok: false,
      motivo: `Não entendi "${texto}" como uma das opções que eu mostrei.`,
    };
  }
  const item = conjunto.itens.find((i) => i.ordem === ordem);
  if (!item) {
    return {
      ok: false,
      motivo: `Eu mostrei ${conjunto.itens.length} opç${conjunto.itens.length > 1 ? "ões" : "ão"}; não existe a de número ${ordem}.`,
    };
  }
  return { ok: true, item };
}

/**
 * Monta o conjunto a partir do que vai ser mostrado.
 *
 * A ORDEM É A DA TELA. Numerar aqui e desenhar em outra ordem faria "o segundo"
 * apontar para o que a pessoa vê em terceiro — o defeito exato que este módulo
 * existe para impedir.
 */
export function apresentar(
  origem: ConjuntoApresentado["origem"],
  itens: readonly { tipo: TipoDeReferencia; id: string; rotulo: string }[]
): ConjuntoApresentado {
  return {
    origem,
    itens: itens.slice(0, MAXIMO_REFERENCIAVEL).map((i, indice) => ({ ...i, ordem: indice + 1 })),
  };
}

/** O que vai para `copilot_mensagens.metadata`. Pequeno de propósito. */
export function paraMetadata(conjunto: ConjuntoApresentado): Record<string, unknown> {
  return {
    candidatos: {
      origem: conjunto.origem,
      itens: conjunto.itens.map((i) => ({
        ordem: i.ordem,
        tipo: i.tipo,
        id: i.id,
        rotulo: i.rotulo,
      })),
    },
  };
}

/**
 * O conjunto lido de volta do banco — ou `null` para qualquer coisa que não
 * seja exatamente a forma de hoje.
 *
 * Defensivo como `lerGuardada`: metadata é `jsonb` livre, e uma linha gravada
 * por uma versão anterior não pode derrubar a resolução de uma escolha.
 */
export function lerMetadata(bruto: unknown): ConjuntoApresentado | null {
  if (!bruto || typeof bruto !== "object") return null;
  const c = (bruto as { candidatos?: unknown }).candidatos;
  if (!c || typeof c !== "object") return null;
  const { origem, itens } = c as { origem?: unknown; itens?: unknown };
  if (origem !== "busca" && origem !== "cadastros" && origem !== "duplicidade") return null;
  if (!Array.isArray(itens)) return null;

  const limpos: ItemApresentado[] = [];
  for (const bruta of itens) {
    if (!bruta || typeof bruta !== "object") continue;
    const i = bruta as Partial<ItemApresentado>;
    if (typeof i.id !== "string" || !i.id) continue;
    if (typeof i.ordem !== "number") continue;
    if (i.tipo !== "produto" && i.tipo !== "cadastro" && i.tipo !== "variante") continue;
    limpos.push({ ordem: i.ordem, tipo: i.tipo, id: i.id, rotulo: String(i.rotulo ?? "") });
  }
  return limpos.length > 0 ? { origem, itens: limpos } : null;
}

/**
 * O conjunto VIGENTE — o da última fala do assistente, e só ele.
 *
 * As mensagens chegam em ordem cronológica. A varredura é de trás para frente e
 * PARA na primeira fala do assistente: se ela não mostrou lista, não existe
 * lista corrente. Continuar procurando acharia a de três turnos atrás e a
 * trataria como "a lista" — que é exatamente o erro a evitar.
 */
export function conjuntoVigente(
  mensagens: readonly { papel: string; metadata?: unknown }[]
): ConjuntoApresentado | null {
  for (let i = mensagens.length - 1; i >= 0; i--) {
    const m = mensagens[i];
    if (m.papel !== "assistente") continue;
    return lerMetadata(m.metadata);
  }
  return null;
}
