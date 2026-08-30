// O que o Mercado Livre EXIGE, ninguém respondeu, e ele mesmo lista as opções.
//
// ===========================================================================
// O BURACO QUE ISTO FECHA
// ===========================================================================
//
// `/cliente/atributos` mostrava só o que a IMPORTAÇÃO propôs. Um obrigatório
// que ninguém propôs — "Tipo de meias" numa meia, "Tipo de mochila" numa
// mochila — nunca aparecia, e a lojista não tinha onde responder. A publicação
// recusava, ela via a recusa, e o caminho até a resposta não existia.
//
// São 9 produtos parados assim no catálogo do T1 hoje.
//
// ===========================================================================
// AQUI NÃO SE DEDUZ NADA — O ML JÁ ESCREVEU A PERGUNTA
// ===========================================================================
//
// `atributosObrigatorios` traz `values` desde a T3, e a maioria dos
// obrigatórios vem com a lista pronta:
//
//     Tipo de meias         10 opções   Térmicas, Escolares, Soquete…
//     Tipo de mochila        6 opções   Escolar, Passeio, Urbana…
//     Tipo de comprimento    3 opções   Longo, Curtas, 3/4
//
// Então isto não é mais um lugar onde eu leio texto livre e chuto. É uma
// pergunta de múltipla escolha que o próprio marketplace formulou, com as
// opções que ele aceita — a lojista escolhe, e nenhum palpite meu entra.
//
// ===========================================================================
// SÓ `list`, E A DISTINÇÃO NÃO É DECORATIVA
// ===========================================================================
//
// `ExigenciaDaCategoria.tipo` separa `list` de `string`, e o comentário do tipo
// já diz por quê: em `list` os valores publicados são a lista INTEIRA do que ele
// aceita; em `string` são sugestão, e outro valor passa.
//
// `BRAND` é `string` e vem com 11 "opções" em MLB273770 — oferecer "escolha
// entre estas 11" ali seria afirmar um fechamento que o ML não declarou, e
// esconder da lojista a marca que ela realmente vende.

import { getSupabase, supabaseConfigurado } from "../supabase/client";
import { lerTudoPaginado } from "../supabase/paginado";
import { atributosObrigatorios } from "../marketplaces/mercadolivre";
import type {
  ExigenciaDaCategoria,
  ValorAceito,
} from "@/modules/publication/domain/atributosDoMarketplace";

function semAcento(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export interface ProdutoDaPergunta {
  produtoId: string;
  produto: string;
}

/** Uma pergunta: "destes N produtos, qual é o <atributo>?" */
export interface GrupoDePergunta {
  /** A categoria do ML que exige o atributo — a mesma pergunta muda por categoria. */
  categoria: string;
  /** Nome exibido do atributo, como o ML o chama ("Tipo de meias"). */
  atributo: string;
  /** As opções que o ML aceita. Nunca vazia: sem opções não há pergunta fechada. */
  opcoes: readonly ValorAceito[];
  /** A ajuda que o PRÓPRIO ML escreve, quando ele escreve. */
  dica?: string;
  produtos: ProdutoDaPergunta[];
}

interface LinhaDoAnuncio {
  produto_id: string | null;
  categoria_ml: string | null;
  produtos: { nome: string | null } | { nome: string | null }[] | null;
}

function nomeDoProduto(l: LinhaDoAnuncio): string {
  const p = Array.isArray(l.produtos) ? l.produtos[0] : l.produtos;
  return (p?.nome ?? "").trim();
}

/**
 * As perguntas em aberto, agrupadas por (categoria, atributo).
 *
 * "Em aberto" é o que NÃO TEM LINHA NENHUMA em `produto_atributos` — nem
 * resposta dela, nem proposta da importação. Perguntar o que já está proposto
 * duplicaria a mesma questão em duas seções da tela: uma pedindo confirmação e
 * outra pedindo resposta. Medido no T1: 479 perguntas se contasse a proposta
 * como ausência, 110 contando como já perguntado.
 */
export async function perguntasEmAberto(clienteId: string): Promise<GrupoDePergunta[]> {
  if (!supabaseConfigurado || !clienteId) return [];

  const anuncios = await lerTudoPaginado<LinhaDoAnuncio>(
    "categorias dos anúncios",
    (de, ate) =>
      getSupabase()
        .from("anuncios_gerados")
        .select("produto_id, categoria_ml, produtos(nome)")
        .eq("cliente_id", clienteId)
        .not("categoria_ml", "is", null)
        .order("id", { ascending: true })
        .range(de, ate)
  );

  const jaPerguntado = await lerTudoPaginado<{ produto_id: string | null; nome_atributo: string | null }>(
    "atributos do produto",
    (de, ate) =>
      getSupabase()
        .from("produto_atributos")
        .select("produto_id, nome_atributo")
        .eq("cliente_id", clienteId)
        .order("id", { ascending: true })
        .range(de, ate)
  );

  const tem = new Set(
    jaPerguntado
      .filter((a) => a.produto_id && a.nome_atributo)
      .map((a) => `${a.produto_id}|${semAcento(a.nome_atributo as string)}`)
  );

  // Um produto pode ter vários anúncios; a categoria é do produto, e o primeiro
  // que a declarar responde pelos demais — é a mesma escolha de
  // `categoriasDosProdutos`, e pelo mesmo motivo.
  const categoriaDo = new Map<string, string>();
  const nomeDo = new Map<string, string>();
  for (const l of anuncios) {
    const pid = (l.produto_id ?? "").trim();
    const cat = (l.categoria_ml ?? "").trim();
    if (!pid || !cat || categoriaDo.has(pid)) continue;
    categoriaDo.set(pid, cat);
    nomeDo.set(pid, nomeDoProduto(l) || pid);
  }

  // UMA ida ao ML por categoria, não por produto.
  const exigencias = new Map<string, Awaited<ReturnType<typeof atributosObrigatorios>>>();
  for (const cat of new Set(categoriaDo.values())) {
    exigencias.set(cat, await atributosObrigatorios(cat));
  }

  return agruparPerguntas({ categoriaDo, nomeDo, jaTem: tem, exigencias });
}

/**
 * A DECISÃO, sem banco e sem rede — é o que dá para provar em teste.
 *
 * `perguntasEmAberto` acima é leitura; a regra é esta. Separadas porque a
 * primeira só roda com a sessão da lojista (a RLS recusa fora do app) e a
 * segunda precisa rodar em qualquer lugar: um script que reimplementasse esta
 * regra para "conferir" responderia por um sistema que não existe.
 */
export function agruparPerguntas(entrada: {
  /** produto → categoria do ML. */
  categoriaDo: ReadonlyMap<string, string>;
  /** produto → nome, para a lojista reconhecer o que está respondendo. */
  nomeDo: ReadonlyMap<string, string>;
  /** `produtoId|atributo-sem-acento` do que já tem linha — resposta OU proposta. */
  jaTem: ReadonlySet<string>;
  exigencias: ReadonlyMap<string, readonly ExigenciaDaCategoria[]>;
}): GrupoDePergunta[] {
  const { categoriaDo, nomeDo, jaTem, exigencias } = entrada;
  const grupos = new Map<string, GrupoDePergunta>();
  for (const [pid, cat] of categoriaDo) {
    for (const e of exigencias.get(cat) ?? []) {
      // `list` com opções: só aí a pergunta é fechada. Ver o topo do arquivo.
      if (e.tipo !== "list" || !e.valoresAceitos?.length) continue;
      if (jaTem.has(`${pid}|${semAcento(e.nome)}`)) continue;
      const chave = `${cat}|${e.nome}`;
      const grupo =
        grupos.get(chave) ??
        ({
          categoria: cat,
          atributo: e.nome,
          opcoes: e.valoresAceitos,
          ...(e.dica ? { dica: e.dica } : {}),
          produtos: [],
        } as GrupoDePergunta);
      grupo.produtos.push({ produtoId: pid, produto: nomeDo.get(pid) ?? pid });
      grupos.set(chave, grupo);
    }
  }
  return [...grupos.values()].sort((a, b) => b.produtos.length - a.produtos.length);
}
