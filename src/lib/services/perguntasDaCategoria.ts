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
//
// `boolean` ENTRA JUNTO, e a medição é que trouxe. "É kit de fábrica"
// (MLB455517) chega com `value_type: "boolean"` e os dois valores publicados,
// Sim e Não — fechamento igual ao de `list`, declarado com outra palavra.
// Deixá-lo de fora por causa do nome do tipo travaria a publicação num campo
// que tem exatamente duas respostas possíveis.

import { getSupabase, supabaseConfigurado } from "../supabase/client";
import { lerTudoPaginado } from "../supabase/paginado";
import { cabecalhoAutenticacao } from "../supabase/sessao";
import { criarAtributosBulk } from "./produtoAtributos";
import {
  semAcentoNemCaixa,
  type ExigenciaDaCategoria,
  type ValorAceito,
} from "@/modules/publication/domain/atributosDoMarketplace";

/**
 * AS EXIGÊNCIAS VÊM PELO SERVIDOR — a CSP não deixa este código falar com o ML.
 *
 * ===========================================================================
 * O DEFEITO, ACHADO NA REVISÃO DE 28/08/2026
 * ===========================================================================
 *
 * A primeira versão chamava `atributosObrigatorios` daqui, e este arquivo roda
 * no NAVEGADOR. `next.config.ts` declara
 * `connect-src 'self' *.supabase.co static.cloudflareinsights.com vercel.live`
 * — `api.mercadolibre.com` não está lá.
 *
 * O navegador recusava a requisição, o `catch` daquela função devolvia `[]`
 * ("sem confirmação, não se bloqueia nada", que é a regra certa PARA ELA), e a
 * tela mostrava ZERO perguntas. Sempre, sem erro e sem log. As três fatias da
 * T3 não funcionavam, e a medição que as validou rodou em Node, onde não há CSP.
 *
 * Os outros cinco chamadores de `atributosObrigatorios` são de servidor. Este
 * era o primeiro do navegador — e a restrição já tinha sido medida no mesmo dia,
 * ao decidir onde pôr o enriquecimento do caminho clássico.
 *
 * `/api/ml/categoria` já existia e já tinha o caminho sem token: id conhecido,
 * atributos públicos, sem precisar da credencial do ML.
 *
 * ===========================================================================
 * AQUI A FALHA SOBE, e é o oposto da regra de lá
 * ===========================================================================
 *
 * `atributosObrigatorios` engole o erro porque na PUBLICAÇÃO não conseguir
 * perguntar não pode virar bloqueio. Nesta tela o efeito seria inverso: a
 * lojista veria "nada esperando você" enquanto 111 obrigatórios seguem travando
 * anúncios. Então a exceção SOBE, `useLiveQuery` a transforma em `estado: erro`,
 * e a tela diz que não conseguiu perguntar.
 */
async function exigenciasDaCategoria(
  clienteId: string,
  categoria: string
): Promise<ExigenciaDaCategoria[]> {
  const cacheada = CACHE_DE_EXIGENCIAS.get(categoria);
  if (cacheada) return cacheada;

  const r = await fetch("/api/ml/categoria", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ clienteId, categoriaId: categoria }),
  });
  if (!r.ok) throw new Error(`não consegui ler as exigências de ${categoria} (${r.status})`);
  const corpo = (await r.json()) as { obrigatorios?: ExigenciaDaCategoria[] };
  const exigencias = corpo.obrigatorios ?? [];
  CACHE_DE_EXIGENCIAS.set(categoria, exigencias);
  return exigencias;
}

/**
 * O que o ML exige numa categoria não muda entre dois cliques.
 *
 * Sem isto, cada resposta da lojista dispara `useLiveQuery` de novo e o
 * navegador refaz UMA ida por categoria — nove no T1, e noventa para responder
 * as dez perguntas. O cache vive enquanto a aba viver: recarregar a página o
 * esvazia, que é a janela certa para um dado que muda em meses.
 */
const CACHE_DE_EXIGENCIAS = new Map<string, ExigenciaDaCategoria[]>();

/** Os `value_type` em que os valores publicados são a lista INTEIRA do aceito. */
const TIPOS_FECHADOS = new Set(["list", "boolean"]);

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

  // UMA ida por categoria, e as categorias EM PARALELO: elas não dependem uma
  // da outra, e em série a tela espera nove viagens somadas.
  const respostas = await Promise.all(
    [...new Set(categoriaDo.values())].map(
      async (cat) => [cat, await exigenciasDaCategoria(clienteId, cat)] as const
    )
  );
  const exigencias = new Map<string, readonly ExigenciaDaCategoria[]>(respostas);

  // SÓ AS LINHAS DOS ATRIBUTOS QUE PODEM VIRAR PERGUNTA — e por isso esta
  // leitura vem DEPOIS das exigências, e não antes.
  //
  // A versão anterior trazia `produto_atributos` inteira: 1.341 linhas no T1, e
  // dezenas de milhares numa loja de 10 mil produtos, para responder "o que
  // falta". Só interessam os nomes que alguma categoria exige em lista fechada,
  // e eles são poucos — Gênero, Tipo de calçado, Tipo de meias, o que vier.
  const nomesQuePodemFaltar = [
    ...new Set(
      [...exigencias.values()].flatMap((lista) => lista.filter(ehFechada).map((e) => e.nome))
    ),
  ];
  const jaPerguntado = nomesQuePodemFaltar.length
    ? await lerTudoPaginado<{ produto_id: string | null; nome_atributo: string | null }>(
        "atributos do produto",
        (de, ate) =>
          getSupabase()
            .from("produto_atributos")
            .select("produto_id, nome_atributo")
            .eq("cliente_id", clienteId)
            .in("nome_atributo", nomesQuePodemFaltar)
            .order("id", { ascending: true })
            .range(de, ate)
      )
    : [];

  const tem = new Set(
    jaPerguntado
      .filter((a) => a.produto_id && a.nome_atributo)
      .map((a) => `${a.produto_id}|${semAcentoNemCaixa(a.nome_atributo as string)}`)
  );

  return agruparPerguntas({ categoriaDo, nomeDo, jaTem: tem, exigencias });
}

/** Fechada E com opções publicadas: a única forma que vira múltipla escolha. */
function ehFechada(e: ExigenciaDaCategoria): boolean {
  return TIPOS_FECHADOS.has(e.tipo ?? "") && !!e.valoresAceitos?.length;
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
      // Fechado E com opções publicadas: só aí a pergunta é de escolha. Ver o
      // topo do arquivo para por que `string` fica de fora e `boolean` entra.
      if (!ehFechada(e)) continue;
      if (jaTem.has(`${pid}|${semAcentoNemCaixa(e.nome)}`)) continue;
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

/**
 * A RESPOSTA DELA — vira linha em `produto_atributos`, com a origem da tela.
 *
 * `Manual` e não `Importação`: isto não é proposta, é o que ela escolheu de uma
 * lista que o Mercado Livre publicou. `fichaDoCadastro` aceita, e a publicação
 * passa a ter o obrigatório.
 *
 * Uma linha por produto, com o MESMO valor: a pergunta é do grupo, a resposta é
 * de cada produto. Guardar por grupo economizaria linhas e perderia a única
 * coisa que importa depois — de quem é a resposta quando ela mudar um só.
 */
export async function responderPergunta(entrada: {
  clienteId: string;
  produtoIds: readonly string[];
  /** O nome exibido do atributo, como o ML o chama. */
  atributo: string;
  valor: string;
}): Promise<void> {
  const valor = entrada.valor.trim();
  if (!valor || entrada.produtoIds.length === 0) return;
  await criarAtributosBulk(
    entrada.produtoIds.map((produtoId) => ({
      produtoId,
      clienteId: entrada.clienteId,
      nomeAtributo: entrada.atributo,
      valorAtributo: valor,
      tipoAtributo: "texto" as const,
      // `true` AQUI e `false` na importação, e a diferença tem razão: esta
      // linha nasce da lista de OBRIGATÓRIOS da categoria, então o campo é
      // verdade. A importação deduz das palavras-chave sem consultar categoria
      // nenhuma — ela não sabe se aquilo é exigido, e gravar `true` ali seria
      // afirmar o que não se mediu. Igualar os dois apagaria a informação.
      obrigatorio: true,
      origem: "Manual" as const,
    }))
  );
}
