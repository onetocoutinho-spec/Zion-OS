import { criarRepositorio } from "../repositorio";
import { atributoParaApp, atributoParaBanco } from "../supabase/mappers";
import type { ProdutoAtributoRow } from "../supabase/database.types";
import type { ProdutoAtributo } from "../types";

const repo = criarRepositorio<ProdutoAtributo, ProdutoAtributoRow>({
  tabela: "produto_atributos",
  colecao: "produtoAtributos",
  prefixoIdLocal: "atr",
  selecao: "*",
  paraApp: atributoParaApp,
  paraBanco: atributoParaBanco,
});

export async function listarAtributosDoProduto(produtoId: string): Promise<ProdutoAtributo[]> {
  return repo.listar({ coluna: "produto_id", valor: produtoId, campoLocal: "produtoId" });
}

export async function criarAtributo(
  dados: Omit<ProdutoAtributo, "id">
): Promise<ProdutoAtributo> {
  return repo.criar(dados);
}

export async function atualizarAtributo(
  id: string,
  dados: Partial<ProdutoAtributo>
): Promise<ProdutoAtributo | null> {
  return repo.atualizar(id, dados);
}

export async function excluirAtributo(id: string): Promise<void> {
  return repo.excluir(id);
}

/**
 * Troca os atributos que VIERAM DO MARKETPLACE por este conjunto — DES-002.
 *
 * IDEMPOTÊNCIA SEM MIGRAÇÃO (D2). Rodar duas vezes não pode duplicar, e não há
 * índice único em `(produto_id, nome_atributo)` — criar um seria DDL. A chave é
 * o escopo: apaga só as linhas com `origem = "Marketplace"` deste produto e
 * insere de novo.
 *
 * O que a lojista digitou (`origem = "Manual"`) e o que veio de template
 * SOBREVIVEM. O apagão é do que nós mesmos escrevemos, e de mais nada.
 *
 * `obrigatorio: false` SEMPRE (D3). Não significa "não é obrigatório" —
 * significa que esta tabela não responde isso. Quem responde é o Mercado Livre,
 * por categoria, na hora de publicar. Gravar aqui criaria uma cópia que
 * envelhece no dia em que o ML mudar a lista ou o produto mudar de categoria.
 *
 * `tipoAtributo: "texto"` porque é o que o ML devolve — `value_name` é string.
 * O id estável do atributo (`OUTSOLE_MATERIAL`) não tem coluna própria e se
 * perde; isso é aceitável justamente por causa do D2, que reescreve tudo a cada
 * enriquecimento em vez de casar linha a linha.
 */
export async function substituirAtributosDoMarketplace(
  produtoId: string,
  atributos: readonly { nomeAtributo: string; valorAtributo: string }[]
): Promise<void> {
  await repo.excluirPorFiltro(
    { coluna: "produto_id", valor: produtoId, campoLocal: "produtoId" },
    { coluna: "origem", campoLocal: "origem", valor: "Marketplace" }
  );
  if (atributos.length === 0) return;
  await repo.criarVarios(
    atributos.map((a) => ({
      produtoId,
      nomeAtributo: a.nomeAtributo,
      valorAtributo: a.valorAtributo,
      tipoAtributo: "texto" as const,
      obrigatorio: false,
      origem: "Marketplace" as const,
    }))
  );
}
