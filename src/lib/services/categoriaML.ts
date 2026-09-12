// O que a CATEGORIA exige, pedido do navegador — sem token e sem segredo.
//
// `atributosObrigatorios` mora em `lib/marketplaces/mercadolivre.ts`, que é
// SOMENTE SERVIDOR: ele carrega `ML_CLIENT_SECRET`. Uma tela não pode importá-lo.
// `/api/ml/categoria` já existe para isso e tem um caminho que dispensa token —
// `/categories/{id}/attributes` é público, e a rota só exige a sessão e o acesso
// ao cliente.
//
// Existe por causa do INC-011: as telas passavam `OBRIGATORIOS_CALCADO` à mão
// porque não tinham como perguntar. Agora têm.

import { cabecalhoAutenticacao } from "../supabase/sessao";
import type { ExigenciaDaCategoria } from "@/modules/publication/domain/atributosDoMarketplace";

/**
 * Os obrigatórios de uma categoria conhecida. `null` quando não deu.
 *
 * `null` e `[]` são coisas diferentes, e quem chama precisa distinguir: `[]`
 * significaria "esta categoria não exige nada", e é o que a rota devolveria se
 * o ML não respondesse. Aqui, qualquer falha vira `null` — "não sei" —, e
 * `obrigatoriosDoProduto` sabe o que fazer com isso.
 */
export async function obrigatoriosDaCategoria(
  clienteId: string,
  categoriaId: string
): Promise<readonly ExigenciaDaCategoria[] | null> {
  if (!clienteId || !categoriaId.trim()) return null;
  try {
    const resposta = await fetch("/api/ml/categoria", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
      body: JSON.stringify({ clienteId, categoriaId: categoriaId.trim() }),
    });
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as { obrigatorios?: ExigenciaDaCategoria[] };
    return Array.isArray(dados.obrigatorios) ? dados.obrigatorios : null;
  } catch {
    // Rede fora não pode derrubar a esteira. Sem resposta, o chamador segue com
    // o palpite — pior contexto, nunca contexto errado.
    return null;
  }
}
