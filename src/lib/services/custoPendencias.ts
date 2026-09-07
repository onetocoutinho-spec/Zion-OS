// Acesso do NAVEGADOR à tela "Custos da loja" — chama as rotas de servidor.
//
// POR QUE ROTA, E NÃO LEITURA DIRETA POR RLS
//
// `custo_pendencias` (migração 087) só libera `select` ao tenant — a escrita é
// só `service_role`, de propósito (resolver uma pendência precisa gravar quem
// resolveu com o id verdadeiro da sessão do SERVIDOR, e gravar a procedência
// do valor vencedor na MESMA operação). Como escrever precisa de rota mesmo,
// ler pela mesma rota evita duas fontes de verdade para a mesma linha — uma
// via RLS direto, outra via servidor — divergindo no dia em que uma delas
// mudar sozinha.

import { cabecalhoAutenticacao } from "../supabase/sessao";
import type { CandidatoDeCusto, LinhaDeCusto } from "../../modules/catalog/domain/custosDoCatalogo";

/**
 * Envia os candidatos que uma importação de planilha achou em disputa.
 *
 * NUNCA lança: um erro aqui não pode derrubar a importação que já aconteceu
 * (produtos e variantes já foram gravados quando isto é chamado). Perder o
 * registro da disputa é ruim; perder a gravação que o lojista autorizou é
 * pior. Mesma regra de `registrarProcedencia`.
 */
export async function sincronizarPendenciasDeCusto(
  clienteId: string,
  itens: readonly { produtoId: string; candidatos: readonly CandidatoDeCusto[] }[]
): Promise<void> {
  if (itens.length === 0) return;
  try {
    const resposta = await fetch("/api/catalogo/custos/pendencias", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
      body: JSON.stringify({ clienteId, itens }),
    });
    if (!resposta.ok) {
      console.error("[custoPendencias] a rota recusou registrar a disputa:", await resposta.text());
    }
  } catch (e) {
    console.error("[custoPendencias] falha ao registrar a disputa da importação:", e);
  }
}

/**
 * Registra a procedência de um custo definido FORA da tela de Custos — a
 * caixa de custo da Precificação, ou a caixa de resolver ambíguos
 * pós-importação (as duas chamam `definirCustoEscolhido`).
 *
 * NUNCA lança, mesma regra de `sincronizarPendenciasDeCusto`: o custo já foi
 * gravado quando isto é chamado, e uma falha aqui não pode desfazer isso —
 * só deixa a coluna "Fonte" sem este registro até a próxima edição.
 */
export async function registrarProcedenciaDeCusto(params: {
  clienteId: string;
  produtoId: string;
  valor: number;
  valorAnterior: number | null;
}): Promise<void> {
  try {
    const resposta = await fetch("/api/catalogo/custos/procedencia", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
      body: JSON.stringify({
        clienteId: params.clienteId,
        registros: [
          {
            produtoId: params.produtoId,
            valor: params.valor,
            valorAnterior: params.valorAnterior,
            origem: "cliente",
            metodo: "cadastro_manual",
          },
        ],
      }),
    });
    if (!resposta.ok) {
      console.error("[custoPendencias] a rota recusou registrar a procedência do custo:", await resposta.text());
    }
  } catch (e) {
    console.error("[custoPendencias] falha ao registrar a procedência do custo:", e);
  }
}

/**
 * O mesmo, em lote, para os produtos que uma importação de planilha gravou
 * SEM disputa (a maioria de uma importação — os ambíguos vão por
 * `sincronizarPendenciasDeCusto`, nunca por aqui).
 */
export async function registrarProcedenciasDaImportacao(
  clienteId: string,
  itens: readonly { produtoId: string; valor: number; valorAnterior: number | null }[]
): Promise<void> {
  if (itens.length === 0) return;
  try {
    const resposta = await fetch("/api/catalogo/custos/procedencia", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
      body: JSON.stringify({
        clienteId,
        registros: itens.map((i) => ({ ...i, origem: "planilha", metodo: "importacao" })),
      }),
    });
    if (!resposta.ok) {
      console.error(
        "[custoPendencias] a rota recusou registrar a procedência da importação:",
        await resposta.text()
      );
    }
  } catch (e) {
    console.error("[custoPendencias] falha ao registrar a procedência da importação:", e);
  }
}

/** As linhas da tabela de Custos da loja, já com estado e ordenação padrão. */
export async function listarCustosDoCatalogo(clienteId: string): Promise<LinhaDeCusto[]> {
  const resposta = await fetch(`/api/catalogo/custos?clienteId=${encodeURIComponent(clienteId)}`, {
    headers: await cabecalhoAutenticacao(),
  });
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null);
    throw new Error(corpo?.erro ?? "Não foi possível carregar os custos.");
  }
  const corpo = (await resposta.json()) as { linhas: LinhaDeCusto[] };
  return corpo.linhas;
}

export type ResultadoDaGravacao = { ok: true } | { ok: false; erro: string };

/**
 * Define o custo de um produto a partir da tela de Custos.
 *
 * Se houver uma pendência aberta para o produto, `valor` a RESOLVE — a rota
 * decide isso do lado do servidor a partir do que está gravado, não de uma
 * flag que o navegador mandaria. Um clique só, dois desfechos possíveis.
 */
export async function definirOuResolverCusto(params: {
  clienteId: string;
  produtoId: string;
  valor: number;
}): Promise<ResultadoDaGravacao> {
  const resposta = await fetch("/api/catalogo/custos", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify(params),
  });
  const corpo = await resposta.json().catch(() => ({}) as { erro?: string });
  if (!resposta.ok) {
    return { ok: false, erro: corpo?.erro ?? "Não foi possível gravar." };
  }
  return { ok: true };
}
