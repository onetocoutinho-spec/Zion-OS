"use client";

// O título da aba do navegador.
//
// ===========================================================================
// O DEFEITO, MEDIDO
// ===========================================================================
//
// `export const metadata` no app: ZERO, em 68 rotas. Conferido no HTML servido:
// `/cliente` devolve `<title>Zion OS — Zion Company</title>`, igual a todas as
// outras. Quem trabalha com produtos numa aba, preços em outra e o Mercado
// Livre numa terceira tem três abas idênticas — e o histórico do navegador
// vira 68 linhas com o mesmo nome.
//
// ===========================================================================
// POR QUE NÃO `export const metadata` EM CADA ROTA
// ===========================================================================
//
// Seria o caminho do Next, e daria SSR do título. Mas 66 das 68 páginas são
// `"use client"`, então cada uma precisaria de um `layout.tsx` só para o
// metadata — 17 arquivos novos só no portal, cada um repetindo um nome que JÁ
// EXISTE em `modules/portal/domain/navegacao` (`AREAS`, com título por área e
// rótulo por tela).
//
// E a própria `ClientPortalShell` já diz por que isso é ruim, sobre este mesmo
// título: "Duas fontes de verdade para o mesmo título envelhecem em direções
// diferentes." Renomear "Preços" no menu e esquecer o `layout.tsx` daria um
// menu dizendo uma coisa e a aba dizendo outra.
//
// O QUE SE PERDE: o título do HTML inicial continua sendo o padrão, e só muda
// depois da hidratação. Atrás de um login, sem indexação, isso não custa nada —
// e é o preço de ter UMA fonte de verdade.

import { useEffect } from "react";

/** O que fica depois do travessão. Curto: a aba tem pouco espaço. */
export const SUFIXO_DA_ABA = "Zion OS";

/**
 * Monta o título da aba a partir do nome da tela.
 *
 * A tela vem PRIMEIRO porque a aba encolhe pela direita: com seis abas abertas,
 * o navegador mostra os primeiros caracteres. "Produtos — Zi…" informa; "Zion
 * OS — Pr…" não distingue nada de nada.
 */
export function montarTituloDaAba(tela: string | null | undefined): string {
  const nome = tela?.trim();
  if (!nome) return SUFIXO_DA_ABA;
  // Uma tela chamada "Zion OS" (ou um sufixo já aplicado por engano) não vira
  // "Zion OS — Zion OS".
  if (nome === SUFIXO_DA_ABA || nome.endsWith(` — ${SUFIXO_DA_ABA}`)) return nome;
  return `${nome} — ${SUFIXO_DA_ABA}`;
}

/**
 * Mantém a aba com o nome da tela atual.
 *
 * Fica nas duas cascas, ao lado de onde o nome da tela já é calculado para o
 * cabeçalho — o mesmo valor serve aos dois, e é isso que impede a divergência.
 *
 * `null` SIGNIFICA "NÃO MEXA", e não "sem título". A distinção é necessária
 * porque as duas cascas se aninham: o `AppShell` envolve TODAS as rotas,
 * inclusive `/cliente/*`, onde ele devolve os filhos crus e quem manda é a
 * `ClientPortalShell`. Como efeito de filho roda antes do de pai, um `AppShell`
 * que escrevesse "Zion OS" nesse caso apagaria o "Produtos — Zion OS" que o
 * portal acabou de pôr — e o título voltaria a ser um só, agora com mais
 * código.
 */
export function useTituloDaAba(tela: string | null): void {
  useEffect(() => {
    if (tela === null) return;
    document.title = montarTituloDaAba(tela);
  }, [tela]);
}
