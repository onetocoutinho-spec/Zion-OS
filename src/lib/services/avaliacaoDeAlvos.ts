// O porto de leitura da consequência — restrito aos alvos, por construção.
//
// ===========================================================================
// POR QUE NÃO REUSAR `catalogoParaTriagem`
// ===========================================================================
//
// Ele lê até 300 produtos do tenant e depois se filtraria. Funcionaria hoje e
// seria a porta pela qual a ampliação entra amanhã: basta alguém esquecer o
// filtro, e a consequência de uma proposta de 12 produtos passa a falar do
// catálogo inteiro sem que nada quebre.
//
// Aqui a assinatura é a garantia: esta função recebe IDS. Não existe caminho em
// que ela leia algo que não foi pedido — não há parâmetro para isso.
//
// ===========================================================================
// AS ENTRADAS DE `avaliar()`, e por que só UMA precisa de retrato
// ===========================================================================
//
// `avaliar` consome: custo, precoAtual, taxas (embalagem + vendedorPagaFrete +
// custos do lojista), margemMinima, procedencia.comissao e custoEmConflito.
//
// A operação de peso em lote muda UMA delas: a EMBALAGEM, via
// `produto_variantes.peso`. Nenhuma outra é tocada pela escrita.
//
// Por isso as demais são lidas AGORA e usadas nos DOIS lados da comparação. Não
// é atalho — é o que torna a causalidade demonstrável: o contrafactual passa a
// ser "o mundo como está, MENOS o efeito desta operação", e a única diferença
// entre as duas contas é o que a escrita produziu.
//
// Comparar dois retratos históricos completos seria PIOR. Se alguém preencheu um
// custo entre a proposta e o clique, o retrato antigo mostraria "sem custo" e a
// diferença apareceria como efeito do peso — que não foi.
//
// `comissao` é sempre `"tabela"` neste caminho (o cálculo é local, sem chamada
// ao ML) e, portanto, nunca é o bloqueio. Conferido em `precificacaoDoCopilot`.

import { getSupabaseAdmin } from "../supabase/admin";
import { avaliar, type EntradasDoPreco } from "../../modules/pricing/domain/conversaDePreco";
import { TAXAS_PADRAO } from "../../modules/pricing/domain/modeloPreco";
import {
  embalagemDe,
  type MedidasDaVariante,
} from "../../modules/pricing/domain/embalagemDoProduto";
import { anomaliaDeCusto } from "../../modules/catalog/domain/anomaliasDoCatalogo";
import { configuracaoDoLojista } from "./precificacaoDoCopilot";
import type { AvaliacaoDeAlvo, EstadoDePricing } from "../../modules/workspace/domain/consequenciaDoLote";

/** As medidas de um produto ANTES da escrita, colhidas na leitura que a própria
 *  gravação já faz. Efêmero: não é persistido, não vai ao modelo, não vai à tela. */
export type MedidasAnteriores = ReadonlyMap<string, readonly MedidasDaVariante[]>;

interface LinhaDeProduto {
  id: string;
  nome: string;
  marca: string | null;
  custo: number | null;
  preco_venda: number | null;
  vendedor_paga_frete: boolean | null;
}

interface LinhaDeVariante extends MedidasDaVariante {
  produto_id: string;
}

/**
 * Avalia pricing para CADA alvo, antes e depois.
 *
 * `antesPorProduto` vem do snapshot pré-UPDATE. Um alvo sem entrada nele é
 * tratado como "não avaliado" — nunca como "estava vazio". Supor o estado
 * anterior de quem não foi medido é exatamente a inferência que este slice
 * recusa.
 *
 * Devolve só o que conseguiu avaliar; quem confere a cobertura é
 * `consequenciaDoLote`, comparando com `alvos`.
 */
export async function avaliacaoDeAlvos(
  clienteId: string,
  ids: readonly string[],
  antesPorProduto: MedidasAnteriores
): Promise<AvaliacaoDeAlvo[]> {
  if (ids.length === 0) return [];
  const admin = getSupabaseAdmin();

  // Duas queries, ambas escopadas por `.in(..., ids)` E pelo tenant. Nunca uma
  // varredura de catálogo.
  const [produtos, variantes, config] = await Promise.all([
    admin
      .from("produtos")
      .select("id, nome, marca, custo, preco_venda, vendedor_paga_frete")
      .eq("cliente_id", clienteId)
      .in("id", ids),
    admin
      .from("produto_variantes")
      .select("produto_id, peso, altura, largura, comprimento")
      .eq("cliente_id", clienteId)
      .in("produto_id", ids),
    configuracaoDoLojista(clienteId),
  ]);

  const linhas = (produtos.data ?? []) as LinhaDeProduto[];
  if (linhas.length === 0) return [];

  const depoisPorProduto = new Map<string, LinhaDeVariante[]>();
  for (const v of (variantes.data ?? []) as LinhaDeVariante[]) {
    const lista = depoisPorProduto.get(v.produto_id) ?? [];
    lista.push(v);
    depoisPorProduto.set(v.produto_id, lista);
  }

  const avaliacoes: AvaliacaoDeAlvo[] = [];
  for (const p of linhas) {
    // Sem retrato anterior não há comparação possível. Fica de fora, e
    // `consequenciaDoLote` transforma a ausência em `quantos: null`.
    const medidasAntes = antesPorProduto.get(p.id);
    if (!medidasAntes) continue;

    const custo = Number(p.custo ?? 0);
    const precoAtual = Number(p.preco_venda ?? 0);
    const anomalia = anomaliaDeCusto({
      id: p.id,
      nome: p.nome,
      marca: p.marca ?? "",
      modelo: "",
      custo,
      precoVenda: precoAtual,
      temFoto: true,
      variantes: [],
    });

    // As entradas comuns aos dois lados. Montadas UMA vez, de propósito.
    const comuns = {
      custo,
      precoAtual,
      margemMinima: config.margemMinima,
      procedencia: {
        comissao: "tabela" as const,
        envio: "tabela_oficial" as const,
        custosDoLojista: "informados" as const,
        reputacao: "padrao" as const,
      },
      custoEmConflito: anomalia?.explicacao ?? null,
    };
    const taxasBase = {
      ...TAXAS_PADRAO,
      custosDoLojista: config.custos,
      ...(p.vendedor_paga_frete === false ? { vendedorPagaFrete: false } : {}),
    };

    // A ÚNICA diferença entre as duas contas.
    const entradasAntes: EntradasDoPreco = {
      ...comuns,
      taxas: { ...taxasBase, embalagem: embalagemDe(medidasAntes) },
    };
    const entradasDepois: EntradasDoPreco = {
      ...comuns,
      taxas: { ...taxasBase, embalagem: embalagemDe(depoisPorProduto.get(p.id) ?? []) },
    };

    avaliacoes.push({
      produtoId: p.id,
      antes: avaliar(entradasAntes).estado as EstadoDePricing,
      depois: avaliar(entradasDepois).estado as EstadoDePricing,
    });
  }

  return avaliacoes;
}
