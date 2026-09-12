// O que a importação LEU e a lojista ainda não confirmou.
//
// ===========================================================================
// POR QUE ESTAS LINHAS FICAM ESPERANDO
// ===========================================================================
//
// A importação da planilha lê gênero e tipo de calçado das palavras-chave do
// ERP e grava em `produto_atributos` com `origem: "Importação"`. Isso é
// dedução — texto livre de SEO, não um campo "Gênero" preenchido — e por isso
// `fichaDoCadastro` a IGNORA: publicar a partir dela seria afirmar, sob a conta
// da lojista, algo que ela não disse.
//
// A revisão de 28/08 fechou essa porta porque não havia onde ela revisar. Este
// serviço e a tela `/cliente/atributos` são o "onde". Confirmado, o atributo
// passa a valer como resposta dela — e aí, sim, publica.
//
// ===========================================================================
// EM LOTE, AGRUPADO PELO VALOR
// ===========================================================================
//
// A resposta é quase sempre a mesma dentro de um grupo: vinte chinelos de que
// se leu "Infantil" são vinte vezes a mesma pergunta. Produto a produto ela
// abandona no décimo; agrupado, decide em um minuto.
//
// O agrupamento é feito aqui, no serviço, e não na tela: quem monta o grupo é
// quem sabe a forma do dado, e a tela que só desenha não erra a contagem.

import { getSupabase, supabaseConfigurado } from "../supabase/client";
import { lerTudoPaginado } from "../supabase/paginado";
import { atualizarAtributo, excluirAtributo } from "./produtoAtributos";

/** A origem que a importação grava, e que a publicação ignora até ser confirmada. */
export const ORIGEM_PROPOSTA = "Importação";

/** A origem de uma resposta DELA — a mesma da aba de atributos. */
export const ORIGEM_CONFIRMADA = "Manual";

export interface ProdutoDaProposta {
  atributoId: string;
  produtoId: string;
  produto: string;
}

/** Uma pergunta: "destes N produtos, lemos <valor> para <atributo>". */
export interface GrupoDeProposta {
  /** Nome exibido do atributo, como o ML o chama ("Gênero"). */
  atributo: string;
  /** O valor lido ("Infantil", "Chinelo"). */
  valor: string;
  produtos: ProdutoDaProposta[];
}

interface LinhaDaProposta {
  id: string;
  produto_id: string | null;
  nome_atributo: string | null;
  valor_atributo: string | null;
  produtos: { nome: string | null } | { nome: string | null }[] | null;
}

/** O nome do produto vem do join; o PostgREST devolve objeto OU array. */
function nomeDoProduto(l: LinhaDaProposta): string {
  const p = Array.isArray(l.produtos) ? l.produtos[0] : l.produtos;
  return (p?.nome ?? "").trim();
}

/**
 * As propostas em aberto, agrupadas por (atributo, valor).
 *
 * Lista vazia quando o Supabase não está configurado ou a leitura falha — a
 * tela mostra "nada a confirmar", que é o estado de antes desta função existir.
 * Falhar aqui não pode inventar uma pergunta nem esconder um erro de outra
 * natureza: quem distingue vazio de falha é `useLiveQuery`, e por isso a
 * exceção SOBE em vez de virar `[]`.
 */
export async function listarPropostasDoCliente(clienteId: string): Promise<GrupoDeProposta[]> {
  if (!supabaseConfigurado || !clienteId) return [];
  const linhas = await lerTudoPaginado<LinhaDaProposta>(
    "propostas de atributo",
    (de, ate) =>
      getSupabase()
        .from("produto_atributos")
        .select("id, produto_id, nome_atributo, valor_atributo, produtos(nome)")
        .eq("cliente_id", clienteId)
        .eq("origem", ORIGEM_PROPOSTA)
        .order("id", { ascending: true })
        .range(de, ate)
  );

  const grupos = new Map<string, GrupoDeProposta>();
  for (const l of linhas) {
    const atributo = (l.nome_atributo ?? "").trim();
    const valor = (l.valor_atributo ?? "").trim();
    const produtoId = (l.produto_id ?? "").trim();
    if (!atributo || !valor || !produtoId) continue;
    const chave = `${atributo}|${valor}`;
    const grupo = grupos.get(chave) ?? { atributo, valor, produtos: [] };
    grupo.produtos.push({
      atributoId: l.id,
      produtoId,
      // Sem nome, o id: melhor uma linha feia que uma linha muda, porque ela
      // precisa reconhecer o produto para poder discordar.
      produto: nomeDoProduto(l) || produtoId,
    });
    grupos.set(chave, grupo);
  }

  // Maior grupo primeiro: é onde um clique resolve mais.
  return [...grupos.values()].sort((a, b) => b.produtos.length - a.produtos.length);
}

/**
 * Confirma: o valor lido passa a ser a resposta DELA.
 *
 * Só troca a origem. O valor não muda — se ela concorda, o que a importação
 * leu já era o certo, e reescrevê-lo seria uma gravação a mais para o mesmo
 * conteúdo. A origem é a diferença inteira: é ela que `fichaDoCadastro` lê
 * para decidir se aquilo pode ir ao Mercado Livre.
 */
export async function confirmarPropostas(atributoIds: readonly string[]): Promise<void> {
  for (const id of atributoIds) {
    await atualizarAtributo(id, { origem: ORIGEM_CONFIRMADA });
  }
}

/**
 * Ela discorda: corrige o valor E confirma, numa gravação só.
 *
 * Corrigir sem confirmar deixaria a linha em aberto com um valor que ela mesma
 * escreveu — a tela pediria de novo a confirmação de uma resposta dela, que é
 * a forma mais rápida de ensinar alguém a ignorar a tela.
 */
export async function corrigirProposta(atributoId: string, valor: string): Promise<void> {
  const limpo = valor.trim();
  if (!limpo) return;
  await atualizarAtributo(atributoId, { valorAtributo: limpo, origem: ORIGEM_CONFIRMADA });
}

/**
 * Ela recusa: a proposta some, e o atributo volta a faltar.
 *
 * É diferente de corrigir. "Não é isso" sem saber o que é continua sendo uma
 * resposta — e a publicação volta a cobrar o atributo, que é o comportamento
 * certo para o que ninguém sabe.
 */
export async function descartarProposta(atributoId: string): Promise<void> {
  await excluirAtributo(atributoId);
}
