// As ambiguidades de custo que esperam decisão — puro, sem React, sem storage.
//
// POR QUE ISTO EXISTE
//
// A tela passou a mostrar os produtos que casaram com custos diferentes, para o
// lojista escolher. Mas a lista vivia no estado do componente: bastava
// recarregar, navegar ou fechar a aba para ela sumir. O lojista reimportou a
// planilha, viu "17 ambíguos", saiu da tela e voltou — e não havia mais nada.
// Do ponto de vista dele, a funcionalidade simplesmente não existia.
//
// Decisão pendente é trabalho. Trabalho não pode morrer numa navegação.
//
// A LISTA SE CURA SOZINHA
//
// Guardar decisão pendente cria um risco novo: a lista envelhece. O custo pode
// ter chegado por outro caminho — outra importação, edição manual, a escolha
// feita noutro navegador. Continuar cobrando decisão sobre algo já decidido é
// ruído, e ruído ensina a ignorar a tela.
//
// Por isso a validade não é por tempo, é por FATO: some da lista todo produto
// que já tem custo. O dado real manda, não o carimbo de quando foi salvo.

export interface AmbiguidadePendente {
  produtoId: string;
  produto: string;
  candidatos: { custo: number; origem: string }[];
}

/** A chave é por cliente: dois lojistas no mesmo navegador não se misturam. */
export function chaveAmbiguidades(clienteId: string): string {
  return `zion:custos:ambiguos:${clienteId || "sem-cliente"}`;
}

/** Lê o que veio do storage sem confiar em nada — formato antigo, lixo, null. */
export function lerAmbiguidades(bruto: string | null | undefined): AmbiguidadePendente[] {
  if (!bruto) return [];
  let obj: unknown;
  try {
    obj = JSON.parse(bruto);
  } catch {
    return [];
  }
  if (!Array.isArray(obj)) return [];

  const itens: AmbiguidadePendente[] = [];
  for (const cru of obj) {
    if (!cru || typeof cru !== "object") continue;
    const o = cru as Record<string, unknown>;
    if (typeof o.produtoId !== "string" || !o.produtoId) continue;
    if (typeof o.produto !== "string") continue;
    if (!Array.isArray(o.candidatos)) continue;

    const candidatos: { custo: number; origem: string }[] = [];
    for (const c of o.candidatos) {
      if (!c || typeof c !== "object") continue;
      const { custo, origem } = c as Record<string, unknown>;
      // Custo não-numérico ou zero não é opção de escolha — escolher isso
      // gravaria "sem custo" achando que decidiu alguma coisa.
      if (typeof custo === "number" && Number.isFinite(custo) && custo > 0) {
        candidatos.push({ custo, origem: typeof origem === "string" ? origem : "" });
      }
    }
    // Ambiguidade precisa de DOIS lados. Com um candidato só não há conflito —
    // e mostrar um botão sozinho faria a pessoa "escolher" o óbvio à toa.
    if (candidatos.length >= 2) {
      itens.push({ produtoId: o.produtoId, produto: o.produto, candidatos });
    }
  }
  return itens;
}

/**
 * O que ainda faz sentido perguntar.
 *
 * `produtosComCusto` é o conjunto de ids que JÁ têm custo — venha de onde vier.
 * Todo produto ali sai da lista: a pergunta já foi respondida, e insistir seria
 * pedir para decidir de novo algo decidido.
 */
export function ambiguidadesAindaAbertas(
  salvas: readonly AmbiguidadePendente[],
  produtosComCusto: ReadonlySet<string>
): AmbiguidadePendente[] {
  return salvas.filter((a) => !produtosComCusto.has(a.produtoId));
}

/** Remove uma decisão que acabou de ser tomada. */
export function semOProduto(
  lista: readonly AmbiguidadePendente[],
  produtoId: string
): AmbiguidadePendente[] {
  return lista.filter((a) => a.produtoId !== produtoId);
}
