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
 * Troca TODOS os atributos que vieram do marketplace, deste cliente — DES-002.
 *
 * ESCOPO POR CLIENTE, E NÃO POR PRODUTO — e isso é conserto, não estilo.
 *
 * A primeira versão fazia um par apagar+inserir POR PRODUTO. Com 73 produtos
 * eram 146 escritas, e cada escrita chama `notificarMudanca()`, que faz as 5
 * `useLiveQuery` da tela recarregarem — duas delas puxando ~600 linhas. Isso é
 * uma tempestade de ~730 requisições, e o navegador desistiu no nono produto:
 *
 *   TypeError: Failed to fetch
 *
 * Agora são DUAS requisições: um DELETE por cliente e um INSERT em lote (que já
 * faz chunk de 500 e notifica uma vez só). O `cliente_id` que a migração 049
 * acrescentou é o que tornou isso possível — antes não havia por onde escopar.
 *
 * E o escopo maior é mais correto: um produto que PERDEU um atributo no ML
 * também tem a linha velha removida. Por produto, ela sobreviveria para sempre.
 *
 * IDEMPOTÊNCIA SEM MIGRAÇÃO (D2). Rodar duas vezes não pode duplicar, e não há
 * índice único em `(produto_id, nome_atributo)` — criar um seria DDL. A chave é
 * o escopo: apaga as linhas com `origem = "Marketplace"` deste cliente e insere
 * de novo.
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
  clienteId: string,
  atributos: readonly { produtoId: string; nomeAtributo: string; valorAtributo: string }[]
): Promise<void> {
  // 1 de 2: apaga o conjunto inteiro do marketplace deste cliente.
  await repo.excluirPorFiltro(
    { coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" },
    { coluna: "origem", campoLocal: "origem", valor: "Marketplace" }
  );
  if (atributos.length === 0) return;
  // 2 de 2: um insert em lote. `retornar: false` porque ninguém usa as linhas
  // criadas, e pedi-las de volta traria ~1.000 registros à toa.
  await repo.criarVarios(
    atributos.map((a) => ({
      produtoId: a.produtoId,
      // O tenant vem de fora, da sessão — nunca é derivado do produto aqui.
      // Derivar exigiria uma leitura a mais e daria à função uma autoridade que
      // ela não deve ter: quem sabe de quem é a sessão é quem a abriu.
      clienteId,
      nomeAtributo: a.nomeAtributo,
      valorAtributo: a.valorAtributo,
      tipoAtributo: "texto" as const,
      obrigatorio: false,
      origem: "Marketplace" as const,
    })),
    { retornar: false }
  );
}
