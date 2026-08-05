// O código que a gente CRIA quando o fornecedor não deu nenhum.
//
// ===========================================================================
// CRIAR NÃO É INVENTAR, E A DISTINÇÃO É A RAZÃO DESTE ARQUIVO EXISTIR
// ===========================================================================
//
// O prompt do catálogo proíbe, em voz alta, inventar SKU: "um código plausível
// e falso vira pedido que ninguém sabe despachar". Isto aqui não contradiz
// aquilo — está do outro lado da mesma linha:
//
//   INVENTAR  afirmar que o FORNECEDOR chama este produto de PROD-4471, sem
//             saber. É afirmação sobre o mundo, e é falsa.
//
//   CRIAR     dar ao produto um código NOSSO, marcado como nosso. Não afirma
//             nada sobre o fornecedor. É um rótulo que nos pertence.
//
// E é legítimo porque o SKU do Mercado Livre é o código do VENDEDOR. O ML não
// exige que ele venha de alguém — exige que seja único por variação.
//
// ===========================================================================
// POR QUE DETERMINÍSTICO, E NÃO SEQUENCIAL
// ===========================================================================
//
// Um contador ("PROD-1", "PROD-2") seria mais simples e estaria errado: o mesmo
// catálogo importado duas vezes geraria códigos diferentes para os mesmos
// produtos, e o segundo lote viraria gêmeo do primeiro. É exatamente o defeito
// que `casarComProdutoExistente` foi escrito para impedir depois de medir que
// 117 de 170 anúncios pertenciam a produtos que já existiam.
//
// Derivado do nome, ele é estável: reimportar dá o mesmo código, e o casamento
// por nome continua funcionando. Quando o arquivo do fornecedor finalmente
// chegar, `ehSkuGerado` acha todos de uma vez para substituir.

const PREFIXO = "CAT";

/**
 * O prefixo viaja no PRÓPRIO código, não numa observação ao lado.
 *
 * Uma nota em `observacoes` sobre a origem do SKU seria verdadeira e invisível:
 * ninguém a lê numa planilha exportada, numa tela de conferência ou no painel
 * do ML. No código, a origem aparece em todo lugar onde o código aparece, para
 * sempre, sem ninguém precisar procurar.
 */
export function ehSkuGerado(sku: string): boolean {
  return sku.startsWith(`${PREFIXO}-`);
}

function pedaco(s: string, max: number): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

/**
 * O código de UMA versão, derivado do que a página diz dela.
 *
 * Nome, tamanho e cor entram porque são o que distingue uma versão da outra —
 * a Cama BELLA Casal Mogno não é a Cama BELLA Solteiro Mogno, e o SKU do ML é
 * por variação, não por produto.
 */
export function skuDoCatalogo(nome: string, tamanho = "", cor = ""): string {
  const partes = [pedaco(nome, 28), pedaco(tamanho, 12), pedaco(cor, 12)].filter(Boolean);
  return [PREFIXO, ...partes].join("-");
}

/**
 * Os códigos de um lote, garantidos únicos.
 *
 * Duas versões podem normalizar para o mesmo texto — cores diferentes que
 * viram a mesma sigla, um nome truncado que colide com outro. Duas linhas com
 * o mesmo SKU é o defeito que o código existe para não ter, então a colisão é
 * resolvida aqui, no único lugar que enxerga o lote inteiro.
 *
 * O sufixo entra só em quem colidiu: o primeiro fica com o código limpo, e
 * reimportar na mesma ordem devolve os mesmos códigos.
 */
export function skusDoLote(
  versoes: readonly { nome: string; tamanho?: string; cor?: string }[]
): string[] {
  const usados = new Map<string, number>();
  return versoes.map((v) => {
    const base = skuDoCatalogo(v.nome, v.tamanho, v.cor);
    const visto = usados.get(base) ?? 0;
    usados.set(base, visto + 1);
    return visto === 0 ? base : `${base}-${visto + 1}`;
  });
}
