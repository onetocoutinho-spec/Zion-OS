// ESTÃO AGRUPADOS NO MERCADO LIVRE? — a resposta que o Copilot não tinha.
//
// ===========================================================================
// A LACUNA QUE ISTO FECHA
// ===========================================================================
//
// Até 24/08/2026 o Copilot respondia, e a resposta estava correta sobre o que
// ele sabia: "não sei se estes anúncios estão agrupados numa família no
// Mercado Livre — o Zion recebe o vínculo na importação e não o guarda".
//
// Conferido no banco no mesmo dia: nenhuma coluna de família em
// `anuncios_gerados` nem em `produtos`, e o jsonb `anuncio` só carrega o
// conteúdo gerado. Era verdade.
//
// Mas "não guardo" não é "não dá para saber". O ML devolve `family_name`,
// `user_product_id` e `family_id`, o Zion já pede os três na importação, e o
// multiget lê 20 itens por chamada. Uma grade de calçado inteira cabe em uma.
// A lacuna não era da informação: era de ninguém perguntar.
//
// ===========================================================================
// AS DUAS COISAS QUE ESTE MÓDULO SE RECUSA A FAZER
// ===========================================================================
//
// 1. **Item não lido não vira "solto".** Se o ML não devolveu o item, a
//    situação dele é DESCONHECIDA. Chamar de solto seria o mesmo erro que fez
//    o Zion dizer "sua loja está em dia" sem ter olhado.
//
// 2. **`user_product_id` sozinho não agrupa.** O ML dá um user_product_id
//    próprio para item que não está em família nenhuma; ele só é sinal de
//    família quando DOIS ou mais itens compartilham o mesmo. Tratar o id único
//    como família diria "cada anúncio é a própria família", que é uma frase
//    verdadeira e inútil — e o lojista leria como "estão agrupados".
//
// Puro. Quem fala com o ML é `familiaNoAnuncio.ts`.

import type { FamiliaDoItem, LeituraDeFamilias } from "@/lib/marketplaces/mercadolivre";

export type SituacaoDaFamilia =
  /** Todos os lidos estão na MESMA família. É o que o lojista quer ver. */
  | "agrupados"
  /** Há família, mas ela não cobre todos — ou há mais de uma. */
  | "parcial"
  /** Nenhum dos lidos está em família. Cada anúncio está por sua conta. */
  | "soltos"
  /** Não foi possível ler. NÃO é "soltos". */
  | "sem_leitura";

export interface RetratoDaFamilia {
  situacao: SituacaoDaFamilia;
  /** Quantos itens o ML respondeu. */
  lidos: number;
  /** Quantos ficaram sem resposta — a parte que a frase precisa dizer. */
  naoLidos: number;
  /** As famílias encontradas, da maior para a menor. */
  familias: { nome: string; quantos: number }[];
  /** Lidos que não pertencem a família nenhuma. */
  semFamilia: number;
}

/**
 * A chave de família de UM item, na ordem de confiança do importador.
 *
 * A mesma ordem de `agrupar()` em `importarAnunciosML.ts`, e de propósito: se
 * as duas divergissem, o Copilot diria "estão agrupados" sobre itens que o
 * importador separou em produtos diferentes — e a lojista veria a contradição
 * na mesma tela.
 *
 * Sem o `contagem`, `user_product_id` não pode ser usado: ver o cabeçalho.
 */
export function chaveDaFamilia(
  item: FamiliaDoItem,
  contagemDeUserProduct: ReadonlyMap<string, number>
): string | null {
  const nome = item.familyName.trim();
  if (nome) return nome;
  const upid = item.userProductId.trim();
  if (upid && (contagemDeUserProduct.get(upid) ?? 0) > 1) return upid;
  return null;
}

/** O que a leitura do ML diz sobre o agrupamento destes anúncios. */
export function retratoDaFamilia(leitura: LeituraDeFamilias): RetratoDaFamilia {
  const { lidos, naoLidos } = leitura;
  if (lidos.length === 0) {
    return {
      situacao: "sem_leitura",
      lidos: 0,
      naoLidos: naoLidos.length,
      familias: [],
      semFamilia: 0,
    };
  }

  const contagem = new Map<string, number>();
  for (const i of lidos) {
    const u = i.userProductId.trim();
    if (u) contagem.set(u, (contagem.get(u) ?? 0) + 1);
  }

  const porFamilia = new Map<string, number>();
  let semFamilia = 0;
  for (const i of lidos) {
    const k = chaveDaFamilia(i, contagem);
    if (k) porFamilia.set(k, (porFamilia.get(k) ?? 0) + 1);
    else semFamilia += 1;
  }

  const familias = [...porFamilia.entries()]
    .map(([nome, quantos]) => ({ nome, quantos }))
    .sort((a, b) => b.quantos - a.quantos || a.nome.localeCompare(b.nome));

  // UMA família cobrindo TODOS os lidos é o único caso de "agrupados". Note
  // que `naoLidos` não impede o veredito sobre os lidos — ele é dito à parte,
  // porque encolher a resposta por causa do que faltou também esconderia o que
  // se descobriu.
  const situacao: SituacaoDaFamilia =
    familias.length === 0 ? "soltos" : familias.length === 1 && semFamilia === 0 ? "agrupados" : "parcial";

  return { situacao, lidos: lidos.length, naoLidos: naoLidos.length, familias, semFamilia };
}

/**
 * A frase, em português, do que foi lido — incluindo o que não foi.
 *
 * Existe aqui, e não no prompt, porque é conclusão sobre dado: deixar o modelo
 * redigir abriria espaço para "estão agrupados" sair de uma leitura parcial.
 */
export function fraseDaFamilia(r: RetratoDaFamilia): string {
  const faltam =
    r.naoLidos > 0
      ? ` O Mercado Livre não respondeu sobre ${r.naoLidos} ${r.naoLidos === 1 ? "anúncio" : "anúncios"}, então sobre ${r.naoLidos === 1 ? "ele" : "esses"} eu não sei.`
      : "";
  switch (r.situacao) {
    case "sem_leitura":
      return "Não consegui ler a família no Mercado Livre agora, então não sei dizer se estão agrupados.";
    case "agrupados":
      return `Estão agrupados: os ${r.lidos} anúncios lidos estão na mesma família no Mercado Livre ("${r.familias[0].nome}").${faltam}`;
    case "soltos":
      return `NÃO estão agrupados: nenhum dos ${r.lidos} anúncios lidos pertence a uma família no Mercado Livre — cada um aparece por conta própria na busca.${faltam}`;
    case "parcial": {
      const partes = r.familias.map((f) => `${f.quantos} em "${f.nome}"`).join(", ");
      const soltos = r.semFamilia > 0 ? `, e ${r.semFamilia} fora de qualquer família` : "";
      return `Estão agrupados só em parte: ${partes}${soltos}. Quem procura pelo grupo não encontra o que ficou de fora.${faltam}`;
    }
  }
}
