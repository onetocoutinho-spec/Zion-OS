// "O que o Mercado Livre manda que a gente não olha?"
//
// A pergunta que motivou isto, do próprio autor: "tem como verificar todas as
// informações que o ML nos traz, talvez isso ajude".
//
// Ajuda, e muito: em 01–02/08/2026, SETE defeitos tiveram a mesma forma — o ML
// informava e nós não líamos. Nenhum foi erro de lógica; todos foram campo não
// lido. Esta é a lista de candidatos ao oitavo.
//
// A importação usa `?attributes=` (lista branca), então ela NUNCA vê o que não
// pede. O diagnóstico busca o item inteiro, sem filtro, e compara.

import { cabecalhoAutenticacao } from "../supabase/sessao";
import { lerJson } from "../http/respostaJson";
import type { InventarioDoItem } from "../../modules/integration/domain/inventarioDoItemML";

export interface ResultadoInventario {
  itemId: string;
  inventario: InventarioDoItem;
}

/**
 * Busca UM item sem a lista branca e devolve o inventário.
 *
 * Um item basta: a lista branca é a mesma para todos, e o que o ML oferece por
 * categoria varia pouco no topo. Buscar os 781 para responder "que campos
 * existem" seria gastar 781 requisições para ler a mesma resposta.
 */
export async function inventariarItemDoML(
  clienteId: string,
  itemId: string
): Promise<ResultadoInventario> {
  const url = `/api/ml/diagnostico-item?clienteId=${encodeURIComponent(
    clienteId
  )}&itemId=${encodeURIComponent(itemId)}`;
  const resposta = await fetch(url, { headers: await cabecalhoAutenticacao() });
  const dados = await lerJson<{
    itemId?: string;
    inventario?: InventarioDoItem;
    erro?: string;
  }>(resposta, "A inspeção do anúncio no Mercado Livre");
  if (!resposta.ok || !dados.inventario) {
    throw new Error(dados.erro ?? "Falha ao consultar o item no Mercado Livre.");
  }
  return { itemId: dados.itemId ?? itemId, inventario: dados.inventario };
}

/**
 * O inventário em texto, com o que IMPORTA primeiro.
 *
 * Os ignorados vêm na frente: são a resposta à pergunta. Os usados e os
 * ausentes vêm depois, porque um campo pedido e AUSENTE é sinal de
 * descontinuação — foi assim que o `price` começou a sumir em favor de
 * `/items/{id}/prices`.
 */
export function textoDoInventario({ itemId, inventario }: ResultadoInventario): string {
  const partes = [`${itemId}: o ML manda ${inventario.usados.length + inventario.ignorados.length} campos.`];
  if (inventario.ignorados.length > 0) {
    partes.push(
      `NÃO pedimos ${inventario.ignorados.length}: ${inventario.ignorados.join(", ")}.`
    );
  } else {
    partes.push("Pedimos tudo que ele oferece no topo.");
  }
  if (inventario.pedidosEAusentes.length > 0) {
    partes.push(
      `Pedimos e NÃO veio (possível descontinuação): ${inventario.pedidosEAusentes.join(", ")}.`
    );
  }
  const dentro = Object.entries(inventario.aninhados)
    .filter(([, chaves]) => chaves.length > 0)
    .map(([campo, chaves]) => `${campo}{${chaves.join(",")}}`);
  if (dentro.length > 0) partes.push(`Dentro dos que lemos: ${dentro.join(" · ")}.`);
  return partes.join(" ");
}
