// COMPLETAR o SKU das variantes a partir do que o Mercado Livre já sabe.
//
// ===========================================================================
// O DEFEITO, MEDIDO EM 18/08/2026 NA CONTA DA LOJISTA
// ===========================================================================
//
// 108 variantes estavam sem SKU. Eu escrevi — três vezes, cada uma olhando um
// campo diferente — que "o SKU não existe no Mercado Livre". A lojista mandou
// o print do painel dela: `00895337`, preenchido, na variação 37 BR.
//
// Eram DOIS defeitos empilhados:
//
//   1. A leitura pedia `attributes=<lista>` sem `include_attributes=all`, e o
//      ML devolvia 200 com `variations[].attributes` VAZIO. Consertado em
//      `mercadolivre.ts` — com o parâmetro, 96 de 96; sem ele, 0 de 96.
//
//   2. Mesmo com o dado chegando, NÃO HAVIA CAMINHO ATÉ O BANCO. A importação
//      tem modo `novos` (cria o que falta) e `substituir` (apaga e recria).
//      Anúncio já conhecido é pulado ANTES de olhar as variações — então
//      reimportar não escrevia nada. Medido: ela clicou, e nas três tabelas
//      zero linha foi tocada.
//
// `substituir` resolveria e é inaceitável: apaga o catálogo — junto com o
// custo, o peso e as fotos que o ML não devolve — para consertar um campo.
//
// ESTE MÓDULO É O CAMINHO QUE FALTAVA. Ele é deliberadamente o menor possível:
//
//   - só PREENCHE vazio, nunca sobrescreve. Se a variante já tem SKU, ela
//     manda: pode ter vindo do ERP, que é a fonte mais confiável dos dois.
//   - só casa por (cor, tamanho) DENTRO do produto que já é dono do anúncio.
//     Não adivinha produto, não cria variante, não apaga nada.
//   - devolve um PLANO. Quem grava é o serviço, e o plano pode ser conferido
//     antes — o mesmo desenho de `planejarEnriquecimento`.

import { normalizarNomeDeProduto } from "./casarComProdutoExistente";

/** O que a leitura do ML entrega, no recorte que interessa aqui. */
export interface VariacaoLidaDoML {
  cor: string;
  tamanho: string;
  sku: string;
  ean: string;
}

export interface AnuncioLidoDoML {
  mlItemId: string;
  /** Vazio num anúncio de grade; preenchido no anúncio avulso. */
  sku: string;
  ean: string;
  cor: string;
  tamanho: string;
  variacoes: readonly VariacaoLidaDoML[];
}

/** O recorte da variante que já está no banco. */
export interface VarianteNoBanco {
  id: string;
  produtoId: string;
  cor: string;
  tamanho: string;
  sku: string;
  ean: string;
}

export interface LinhaParaCompletar {
  id: string;
  /** Só vem quando estava vazio E o ML tem valor. */
  sku?: string;
  ean?: string;
}

export interface PlanoDeCompletarSku {
  paraGravar: LinhaParaCompletar[];
  /** Quantas variantes ganharam SKU, quantas ganharam EAN. */
  comSku: number;
  comEan: number;
  /** Variações que o ML tem e que não casaram com nenhuma variante do produto. */
  semCasar: { mlItemId: string; cor: string; tamanho: string; sku: string }[];
  /** Anúncios lidos que a base não sabe de qual produto são. */
  anunciosSemProduto: number;
  /** Variantes que continuam sem SKU depois do plano. */
  continuamVazias: number;
}

/**
 * A chave de casamento: cor + tamanho, normalizados.
 *
 * Normalizar importa mais do que parece. O ML devolve `39.0 BR`, `39,0 BR`,
 * `39 BR` e `39 - 40` para a mesma prateleira, dependendo de quando o anúncio
 * foi criado. Comparar cru deixaria de fora justamente as variantes antigas —
 * que são as que estão sem SKU.
 */
function chaveDeCasamento(cor: string, tamanho: string): string {
  return `${normalizarNomeDeProduto(cor)}|${normalizarNomeDeProduto(tamanho)}`;
}

/**
 * SÓ OS DÍGITOS DO TAMANHO, na ordem.
 *
 * O segundo degrau do casamento. `39.0 BR`, `39,0 BR` e `39 BR` normalizam
 * para textos diferentes mas têm os mesmos dígitos — e é o mesmo pé.
 *
 * NÃO serve para faixa: `39 - 40` tem dois números e não pode casar com `39`
 * por acidente, senão o par de chinelo entra como unidade. Por isso a
 * comparação é da SEQUÊNCIA inteira, não de "contém".
 */
function digitosDoTamanho(tamanho: string): string {
  return (tamanho.match(/\d+/g) ?? []).join("-");
}

function vazio(v: string | null | undefined): boolean {
  return !(v ?? "").trim();
}

/**
 * O PLANO: quais variantes o ML consegue completar, e o que sobra.
 *
 * `produtoPorMlb` vem de `anuncios_gerados` — a base já sabe qual MLB é de
 * qual produto, e usar isso evita reagrupar por nome (que foi exatamente o
 * casamento frouxo que, em 15/08/2026, colou códigos de um tênis Molekinha num
 * chinelo Modare).
 */
export function planejarCompletarSku(
  anuncios: readonly AnuncioLidoDoML[],
  produtoPorMlb: ReadonlyMap<string, string>,
  variantes: readonly VarianteNoBanco[]
): PlanoDeCompletarSku {
  // As variantes VAZIAS, agrupadas por produto e indexadas pelas duas chaves.
  const porProduto = new Map<
    string,
    { porTexto: Map<string, VarianteNoBanco[]>; porDigitos: Map<string, VarianteNoBanco[]> }
  >();
  let totalVazias = 0;
  for (const v of variantes) {
    if (!vazio(v.sku)) continue; // já tem SKU: não se toca
    totalVazias++;
    const idx =
      porProduto.get(v.produtoId) ?? { porTexto: new Map(), porDigitos: new Map() };
    const t = chaveDeCasamento(v.cor, v.tamanho);
    const d = `${normalizarNomeDeProduto(v.cor)}|${digitosDoTamanho(v.tamanho)}`;
    (idx.porTexto.get(t) ?? idx.porTexto.set(t, []).get(t)!).push(v);
    (idx.porDigitos.get(d) ?? idx.porDigitos.set(d, []).get(d)!).push(v);
    porProduto.set(v.produtoId, idx);
  }

  const paraGravar = new Map<string, LinhaParaCompletar>();
  const semCasar: PlanoDeCompletarSku["semCasar"] = [];
  let anunciosSemProduto = 0;

  for (const a of anuncios) {
    const produtoId = produtoPorMlb.get(a.mlItemId);
    if (!produtoId) {
      anunciosSemProduto++;
      continue;
    }
    const idx = porProduto.get(produtoId);
    if (!idx) continue; // nenhuma variante vazia neste produto: nada a fazer

    // Anúncio de grade traz as variações; anúncio avulso é ele mesmo uma.
    const lidas: VariacaoLidaDoML[] =
      a.variacoes.length > 0
        ? [...a.variacoes]
        : [{ cor: a.cor, tamanho: a.tamanho, sku: a.sku, ean: a.ean }];

    for (const lida of lidas) {
      if (vazio(lida.sku) && vazio(lida.ean)) continue; // o ML também não sabe

      const porTexto = idx.porTexto.get(chaveDeCasamento(lida.cor, lida.tamanho)) ?? [];
      const porDigitos =
        porTexto.length > 0
          ? []
          : idx.porDigitos.get(
              `${normalizarNomeDeProduto(lida.cor)}|${digitosDoTamanho(lida.tamanho)}`
            ) ?? [];
      const alvos = porTexto.length > 0 ? porTexto : porDigitos;

      if (alvos.length === 0) {
        if (!vazio(lida.sku)) {
          semCasar.push({
            mlItemId: a.mlItemId,
            cor: lida.cor,
            tamanho: lida.tamanho,
            sku: lida.sku,
          });
        }
        continue;
      }

      // AMBÍGUO NÃO ESCREVE.
      //
      // Duas variantes vazias com a mesma cor e o mesmo tamanho é a duplicata
      // que já existe na base (11 delas, medidas em 18/08/2026). Escolher uma
      // seria adivinhar qual sobrevive, e adivinhar em cima de duplicata foi o
      // que colou código errado em produto errado. Fica para a lojista.
      if (alvos.length > 1) {
        semCasar.push({
          mlItemId: a.mlItemId,
          cor: lida.cor,
          tamanho: lida.tamanho,
          sku: lida.sku,
        });
        continue;
      }

      const alvo = alvos[0];
      const linha: LinhaParaCompletar = paraGravar.get(alvo.id) ?? { id: alvo.id };
      if (vazio(alvo.sku) && !vazio(lida.sku)) linha.sku = lida.sku.trim();
      if (vazio(alvo.ean) && !vazio(lida.ean)) linha.ean = lida.ean.trim();
      if (linha.sku !== undefined || linha.ean !== undefined) paraGravar.set(alvo.id, linha);
    }
  }

  const linhas = [...paraGravar.values()];
  const comSku = linhas.filter((l) => l.sku !== undefined).length;
  return {
    paraGravar: linhas,
    comSku,
    comEan: linhas.filter((l) => l.ean !== undefined).length,
    semCasar,
    anunciosSemProduto,
    continuamVazias: totalVazias - comSku,
  };
}

/**
 * A FRASE. O número sozinho não diz se valeu a pena nem o que sobrou.
 */
export function fraseDoCompletarSku(plano: PlanoDeCompletarSku): string {
  if (plano.comSku === 0 && plano.comEan === 0) {
    return plano.continuamVazias > 0
      ? `Nenhum SKU novo veio do Mercado Livre. ${plano.continuamVazias} variação(ões) continuam sem código — nem lá elas têm.`
      : "Nada a completar: todas as variações já têm SKU.";
  }
  const partes: string[] = [];
  if (plano.comSku > 0) partes.push(`${plano.comSku} SKU(s)`);
  if (plano.comEan > 0) partes.push(`${plano.comEan} código(s) de barras`);
  let frase = `${partes.join(" e ")} vieram do Mercado Livre.`;
  if (plano.continuamVazias > 0) {
    frase += ` ${plano.continuamVazias} variação(ões) continuam sem SKU.`;
  }
  if (plano.semCasar.length > 0) {
    frase += ` ${plano.semCasar.length} não casaram com nenhuma variação da sua base — ficaram de fora de propósito.`;
  }
  return frase;
}
