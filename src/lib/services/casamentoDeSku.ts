// A PRÉVIA do casamento por prefixo: lê o catálogo e pergunta ao domínio.
//
// Existe para a conferência poder OFERECER o padrão com números medidos, em vez
// de a importação aplicá-lo em silêncio. A regra mora em
// `modules/catalog/domain/casamentoPorPrefixo`; aqui só entra o que ela precisa.

import {
  acharCasamentoPorPrefixo,
  type CasamentoPorPrefixo,
} from "../../modules/catalog/domain/casamentoPorPrefixo";
import { listarTodasVariantes } from "./produtoVariantes";

export type { CasamentoPorPrefixo };

/**
 * Os códigos desta planilha são os SKUs do catálogo sem o tamanho?
 *
 * Devolve `null` quando não há padrão — e `null` também quando a leitura falha,
 * de propósito: esta é uma OFERTA, e uma oferta que não aparece custa um
 * casamento a menos. Uma que aparece por engano custa custo errado gravado.
 */
export async function preverCasamentoPorSku(
  clienteId: string,
  codigosDaPlanilha: readonly string[]
): Promise<CasamentoPorPrefixo | null> {
  if (codigosDaPlanilha.length === 0) return null;
  try {
    const variantes = (await listarTodasVariantes())
      .filter((v) => v.clienteId === clienteId && v.sku)
      .map((v) => ({ sku: v.sku, produtoId: v.produtoId }));
    return acharCasamentoPorPrefixo(codigosDaPlanilha, variantes);
  } catch {
    return null;
  }
}
