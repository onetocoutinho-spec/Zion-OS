// A LOJA ATUAL — a regra pura de "em qual loja eu estou".
//
// POR QUE ISTO EXISTE
//
// O painel da agência/equipe não tinha contexto de loja: dez telas guardavam
// a própria escolha num `useState`, quatro pelo id e seis pelo NOME da
// empresa, com defaults divergentes ("", "Todos", ou o primeiro da lista). Num
// fluxo real de oito telas sobre uma loja só, a agência escolhia a mesma loja
// sete vezes — e em /vendas e /otimizar-lote um F5 trocava SILENCIOSAMENTE
// para a primeira loja da lista. (docs/product/ux/02-PROBLEMS.md, P0 #1)
//
// Este módulo é a fonte única. Ele não conhece React nem o Next: recebe o que
// cada camada sabe e devolve a loja e de onde ela veio. A precedência é fixa e
// documentada em docs/product/ux/03-RECOMMENDED-EXPERIENCE.md §Contexto global:
//
//   1. segmento de URL  /lojas/<id>/...   (a Store experience da agência — ainda
//                                          sem rota hoje, mas a regra já a reconhece)
//   2. query            ?loja=<id>        (telas cross-store; o link é compartilhável)
//   3. cookie           zion.loja          (a última escolha; só agência/equipe)
//   4. perfil           cliente → a própria loja, sempre
//   5. nada             portfólio (não é erro: é o modo natural da agência)
//
// A URL vence sempre. O cookie é só o fallback de quem abriu a tela sem query.
// Nenhuma camada "auto-seleciona a primeira loja": escolher por alguém é o
// defeito que este módulo existe para encerrar.

export type OrigemDaLoja = "url" | "query" | "cookie" | "perfil" | "nenhuma";

export interface ResolucaoDaLoja {
  lojaId: string | null;
  origem: OrigemDaLoja;
}

export interface EntradaDaResolucao {
  pathname: string;
  /** O valor de `?loja=`; `null` quando ausente. */
  lojaDaQuery: string | null;
  /** O valor do cookie `zion.loja`; `null` quando ausente. */
  lojaDoCookie: string | null;
  perfil: { papel: "equipe" | "cliente" | "agencia"; clienteId: string | null } | null;
  /**
   * As lojas que este usuário alcança. `null` = ainda não se sabe (carregando);
   * nesse caso o cookie e a query são aceitos provisoriamente e revalidados
   * quando a lista chegar.
   */
  lojasAlcancaveis: readonly { id: string }[] | null;
}

export const NOME_DO_COOKIE = "zion.loja";
const UM_MES_EM_SEGUNDOS = 60 * 60 * 24 * 30;

/** `/lojas/<id>` ou `/lojas/<id>/qualquer/coisa` → `<id>`; senão `null`. */
export function lojaDoSegmento(pathname: string): string | null {
  const m = /^\/lojas\/([^/?#]+)(?:[/?#]|$)/.exec(pathname);
  if (!m) return null;
  const id = decodeURIComponent(m[1]);
  // "/lojas/novo" é a tela de criar loja, não uma loja.
  return id === "novo" ? null : id;
}

function alcanca(id: string, lojas: EntradaDaResolucao["lojasAlcancaveis"]): boolean {
  if (lojas === null) return true; // ainda não sabemos; aceita e revalida depois
  return lojas.some((l) => l.id === id);
}

export function resolverLojaAtual(e: EntradaDaResolucao): ResolucaoDaLoja {
  // O lojista É a loja. Nada na URL ou no cookie muda isso.
  if (e.perfil?.papel === "cliente") {
    return { lojaId: e.perfil.clienteId, origem: "perfil" };
  }

  const daUrl = lojaDoSegmento(e.pathname);
  if (daUrl) {
    // Um link para loja sem acesso NÃO cai silenciosamente noutra loja: devolve
    // a loja pedida e deixa a tela mostrar o 403 explicativo.
    return { lojaId: daUrl, origem: "url" };
  }

  if (e.lojaDaQuery && alcanca(e.lojaDaQuery, e.lojasAlcancaveis)) {
    return { lojaId: e.lojaDaQuery, origem: "query" };
  }

  if (e.lojaDoCookie && alcanca(e.lojaDoCookie, e.lojasAlcancaveis)) {
    return { lojaId: e.lojaDoCookie, origem: "cookie" };
  }

  return { lojaId: null, origem: "nenhuma" };
}

/** Lê `zion.loja` de uma string no formato de `document.cookie`. Puro. */
export function lerCookieDaLoja(cookieHeader: string): string | null {
  for (const parte of cookieHeader.split(";")) {
    const [nome, ...resto] = parte.trim().split("=");
    if (nome === NOME_DO_COOKIE) {
      const valor = resto.join("=");
      return valor ? decodeURIComponent(valor) : null;
    }
  }
  return null;
}

/** A string a atribuir a `document.cookie` para gravar ou apagar a loja. Puro. */
export function cookieDaLoja(lojaId: string | null): string {
  if (lojaId === null) {
    return `${NOME_DO_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
  return `${NOME_DO_COOKIE}=${encodeURIComponent(lojaId)}; Path=/; Max-Age=${UM_MES_EM_SEGUNDOS}; SameSite=Lax`;
}

/**
 * A query string com `?loja=` atualizado (ou removido), preservando o resto.
 * Devolve `""` quando não sobra nenhum parâmetro. Puro.
 */
export function queryComLoja(queryAtual: string, lojaId: string | null): string {
  const params = new URLSearchParams(queryAtual.startsWith("?") ? queryAtual.slice(1) : queryAtual);
  if (lojaId) params.set("loja", lojaId);
  else params.delete("loja");
  const s = params.toString();
  return s ? `?${s}` : "";
}
