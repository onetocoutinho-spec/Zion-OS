import { criarRepositorio } from "../repositorio";
import { autorAtual } from "../auth/autorAtual";
import { produtoParaApp, produtoParaBanco } from "../supabase/mappers";
import type { ProdutoRow } from "../supabase/database.types";
import type { Produto } from "../types";
import {
  capturarDecisao,
  type DecisionJournal,
} from "../../modules/adaptive-intelligence/decision-journal.ts";

const repo = criarRepositorio<Produto, ProdutoRow>({
  tabela: "produtos",
  colecao: "produtos",
  prefixoIdLocal: "prd",
  selecao: "*, clientes(empresa)",
  paraApp: produtoParaApp,
  paraBanco: produtoParaBanco,
});

export async function listarProdutos(): Promise<Produto[]> {
  return repo.listar();
}

export async function buscarProduto(id: string): Promise<Produto | null> {
  return repo.buscar(id);
}

export async function listarProdutosDoCliente(clienteId: string): Promise<Produto[]> {
  return repo.listar({ coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" });
}

export async function criarProduto(dados: Omit<Produto, "id">): Promise<Produto> {
  return repo.criar(dados);
}

/** Cria muitos produtos de uma vez (importação da base). */
export async function criarProdutos(dados: Omit<Produto, "id">[]): Promise<Produto[]> {
  return repo.criarVarios(dados);
}

// ── Observador lateral · Natural Aggregate PRODUTO (AIL, PR-004) ─────────────
// atualizarProduto é o funil por onde as decisões de campo do produto passam
// (ProdutoForm, tela de medidas, editor de kit). Campos observados abaixo:
// adicionar um campo futuro (atributos, fornecedor…) = acrescentar uma linha.
// A captura exige DELTA REAL (leitura prévia condicional: só quando o payload
// contém campo observado) e é fire-and-forget via capturarDecisao — o fluxo
// de negócio jamais depende da AIL. Ver docs/engineering/AIL_SIGNAL_MAP.md.
const CAMPOS_OBSERVADOS = [
  { campo: "categoriaMarketplace", propriedade: "categoriaMarketplaceSugerida", contexto: "catalogo" },
  { campo: "precoVenda", propriedade: "precoVenda", contexto: "precificacao" },
  { campo: "tabelaMedidas", propriedade: "tabelaMedidasOverride", contexto: "catalogo" },
] as const;

type PropriedadeObservada = (typeof CAMPOS_OBSERVADOS)[number]["propriedade"];

/** Valor observável de um campo, como texto canônico simples (null = ausente). */
function valorObservado(produto: Produto, propriedade: PropriedadeObservada): string | null {
  const bruto = produto[propriedade];
  if (bruto === undefined || bruto === null) return null;
  const texto = String(bruto).trim();
  return texto ? texto : null;
}

function observarCorrecoesDoProduto(
  anterior: Produto,
  atual: Produto,
  presentes: readonly (typeof CAMPOS_OBSERVADOS)[number][],
  autor: string,
  journal?: DecisionJournal
): void {
  for (const c of presentes) {
    const valorNovo = valorObservado(atual, c.propriedade);
    if (valorNovo === null) continue; // limpar um campo não é decisão aprendível
    capturarDecisao(
      {
        empresa: atual.clienteId,
        contexto: c.contexto,
        entidade: { tipo: "produto", id: atual.id },
        campo: c.campo,
        valorAnterior: valorObservado(anterior, c.propriedade),
        valorNovo,
        origem: "produtos.atualizarProduto",
        autor,
      },
      journal
    );
  }
}

export async function atualizarProduto(
  id: string,
  dados: Partial<Produto>,
  journal?: DecisionJournal
): Promise<Produto | null> {
  const presentes = CAMPOS_OBSERVADOS.filter((c) => dados[c.propriedade] !== undefined);
  const anterior = presentes.length > 0 ? await repo.buscar(id) : null;
  const resultado = await repo.atualizar(id, dados);
  // Autoria (E4.2.3): resolvida só quando haverá captura — autorAtual nunca lança.
  if (anterior && resultado)
    observarCorrecoesDoProduto(anterior, resultado, presentes, await autorAtual(), journal);
  return resultado;
}

export async function excluirProduto(id: string): Promise<void> {
  return repo.excluir(id);
}

/** Atualiza vários produtos de uma vez (ex.: custos em massa). */
export async function atualizarProdutosBulk(produtos: Produto[]): Promise<void> {
  return repo.atualizarVarios(produtos);
}

/**
 * Exclui os produtos importados do Mercado Livre do cliente (variações caem
 * em cascata). Usado pela reimportação "substituir".
 */
export async function excluirProdutosImportadosML(clienteId: string): Promise<void> {
  // Prefixo comum "Importado do " cobre os dois formatos gravados ao longo do
  // tempo: "Importado do ML (...)" e "Importado do Mercado Livre (...)".
  return repo.excluirPorFiltro(
    { coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" },
    { coluna: "observacoes", campoLocal: "observacoes", valor: "Importado do " }
  );
}
