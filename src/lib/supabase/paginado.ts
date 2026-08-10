// A leitura que não para em 1.000 — uma vez, para o repositório inteiro.
//
// ===========================================================================
// A CLASSE DE DEFEITO
// ===========================================================================
//
// O PostgREST corta toda resposta em 1.000 linhas e NÃO avisa: devolve 200, sem
// erro, com `content-range: 0-999`. Quem lê recebe um array perfeitamente
// válido e conclui que aquilo é a base inteira. Nenhum teste pega isso, porque
// em memória e em base pequena o comportamento é idêntico.
//
// Este repositório já pagou quatro vezes:
//
//   importação de custos   2.085 de 3.085 variantes "não existiam", e o
//                          lojista leu "sem produto correspondente" como
//                          planilha errada
//   infrações (leitura)    1.060 infrações, 60 fora. 102 anúncios têm UMA só:
//                          se a dela cai, o anúncio troca o remédio escrito
//                          pelo ML por um palpite nosso que acerta 29%
//   infrações (retrato)    a função que existe para dizer "1.060 em 460"
//                          dizia "1.000 em ~440"
//   avaliacaoDeAlvos       o produto sem variantes vira `bloqueado`, e a
//                          escrita aparece como tendo QUEBRADO o que gravou
//
// Nas quatro, a correção foi o mesmo laço. Escrever o laço uma quinta vez seria
// montar com as próprias mãos a divergência que este arquivo existe para
// impedir.
//
// ===========================================================================
// POR QUE A MONTAGEM FICA COM QUEM CHAMA
// ===========================================================================
//
// `montar` recebe a janela e devolve a consulta pronta. Um wrapper que montasse
// o `select` escondia duas coisas que precisam continuar visíveis na chamada: a
// projeção (é ela que evita trazer JSONB de 1 MB) e o filtro de tenant (é ele
// que impede vazamento entre lojas). Nenhuma das duas pode virar padrão de
// biblioteca.
//
// ===========================================================================
// LANÇA EM ERRO, E ISSO É DELIBERADO
// ===========================================================================
//
// `supabase-js` não lança: devolve `{ data: null, error }`. Um `?? []` no lugar
// da conferência transforma falha em resposta plausível — leitura que falhou
// vira leitura que deu vazio, e o número errado sai com cara de fato.
//
// O `throw` vale para TODA página: conferir só a última resposta deixaria
// passar a falha de uma página do meio, que é justamente o caso que só aparece
// quando a base cresce.

/** O corte do PostgREST. Pedir mais numa página não adianta: ele para aqui. */
export const PAGINA = 1000;

/** Trava contra laço infinito — 200 mil linhas. Não é limite de negócio. */
const TETO_DE_PAGINAS = 200;

/** O que uma consulta do supabase-js resolve. */
export type RespostaDaConsulta = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}>;

/**
 * Lê TODAS as linhas, em páginas.
 *
 * `montar(de, ate)` precisa incluir uma ORDEM ESTÁVEL. Sem desempate
 * determinístico, a mesma linha pode vir em duas páginas e outra em nenhuma —
 * foi o que tornou a paginação do repositório confiável só depois do
 * `order("id")`.
 *
 * @param oQue nome da leitura, para a mensagem de erro dizer QUAL falhou
 */
export async function lerTudoPaginado<T>(
  oQue: string,
  montar: (de: number, ate: number) => RespostaDaConsulta
): Promise<T[]> {
  const todas: T[] = [];
  for (let pagina = 0; pagina < TETO_DE_PAGINAS; pagina++) {
    const { data, error } = await montar(pagina * PAGINA, pagina * PAGINA + PAGINA - 1);
    if (error) throw new Error(`leitura de ${oQue} falhou — ${error.message}`);
    const linhas = (data ?? []) as T[];
    todas.push(...linhas);
    if (linhas.length < PAGINA) break;
  }
  return todas;
}

/** Quantos ids cabem num `in` sem produzir URL de quilômetros. */
export const IDS_POR_LOTE = 200;

/**
 * O mesmo, quando o filtro é um `in(...)` de ids.
 *
 * DOIS limites se somam aqui, e confundir um com o outro é fácil:
 *
 *   o lote de ids   protege a URL. `in` com milhares de uuids estoura o
 *                   tamanho do request antes de qualquer corte de linhas.
 *   a paginação     protege as LINHAS. 200 produtos com 12 variantes cada são
 *                   2.400 linhas num lote só — o corte de 1.000 pega mesmo com
 *                   a URL curta.
 *
 * Por isso os dois, e não um ou outro.
 */
export async function lerTudoPorIds<T>(
  oQue: string,
  ids: readonly string[],
  montar: (lote: string[], de: number, ate: number) => RespostaDaConsulta
): Promise<T[]> {
  const todas: T[] = [];
  for (let i = 0; i < ids.length; i += IDS_POR_LOTE) {
    const lote = ids.slice(i, i + IDS_POR_LOTE) as string[];
    const doLote = await lerTudoPaginado<T>(oQue, (de, ate) => montar(lote, de, ate));
    todas.push(...doLote);
  }
  return todas;
}
