// A regra de um filtro de tela que vive na URL.
//
// POR QUE NA URL E NÃO EM `useState`
//
// Um filtro em `useState` morre no F5 e não vai junto quando a pessoa cola o
// link no WhatsApp da equipe — "olha os produtos críticos do cliente X" chegava
// como "todos os produtos de todos". A régua `ui-ux-pro-max` (Navigation:
// "Update URL on state/view changes") dá isso como defeito Medium.
//
// O QUE ESTE MÓDULO DECIDE (e tem teste)
//
// 1. O valor PADRÃO não aparece na URL. `?cadastro=Todos` é ruído; a ausência
//    do parâmetro já diz "todos". Assim o link limpo continua limpo.
// 2. Os outros parâmetros são preservados — em especial `?loja=`, que é de
//    outro dono (LojaAtualProvider) e não pode ser apagado por um filtro.
// 3. Um valor desconhecido na URL cai no padrão, sem quebrar a tela: quem
//    digitou `?cadastro=xyz` vê "Todos", não uma lista vazia sem explicação.
//
// Aqui só a regra; o cabeamento com o Next é `useFiltroNaUrl`.

/** Lê o filtro da query; padrão quando ausente ou fora das opções. */
export function lerFiltro(
  params: { get(chave: string): string | null },
  chave: string,
  padrao: string,
  opcoes?: readonly string[]
): string {
  const v = params.get(chave);
  if (v === null || v === "") return padrao;
  if (opcoes && !opcoes.includes(v)) return padrao;
  return v;
}

/** A query com o filtro aplicado. Valor igual ao padrão REMOVE o parâmetro. */
export function queryComFiltro(
  queryAtual: string,
  chave: string,
  valor: string,
  padrao: string
): string {
  const params = new URLSearchParams(queryAtual.startsWith("?") ? queryAtual.slice(1) : queryAtual);
  if (valor === padrao || valor === "") params.delete(chave);
  else params.set(chave, valor);
  const s = params.toString();
  return s ? `?${s}` : "";
}
