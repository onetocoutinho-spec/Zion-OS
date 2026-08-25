// O atalho do teclado para pular a navegação.
//
// ===========================================================================
// POR QUE EXISTE
// ===========================================================================
//
// A sidebar do portal tem 5 áreas, e a área aberta abre as sub-telas dela.
// Quem navega por teclado atravessa ~12 paradas — hambúrguer, logo, cinco
// áreas, as sub-telas, busca, e-mail, avatar, sair — ANTES do primeiro
// elemento do conteúdo. E atravessa de novo a cada troca de página.
//
// ===========================================================================
// POR QUE AQUI E NÃO NO layout.tsx
// ===========================================================================
//
// O `AppShell` devolve `<>{children}</>` cru em três casos: /definir-senha
// (tela pública de tela cheia), /z (moldura própria) e todo /cliente/* (que
// tem o `ClientPortalShell`). Um atalho no layout raiz apontaria para um
// `#conteudo` que não existe nessas rotas — um link que não vai a lugar nenhum
// é pior que nenhum link.
//
// Então ele mora nas DUAS cascas que de fato têm navegação para pular, e o id
// sai daqui para que âncora e alvo não possam divergir.

/** O id do `<main>`. Uma constante porque o link e o alvo têm que casar. */
export const ID_DO_CONTEUDO = "conteudo";

/**
 * Invisível até receber foco, e aí vira um botão no canto superior esquerdo.
 *
 * `focus:` e não `focus-visible:`: o elemento é `sr-only` e nenhum mouse
 * consegue clicar nele, então não existe o clique que faria o anel piscar sem
 * motivo. Aqui as duas pseudo-classes dariam no mesmo, e `focus:` é a que não
 * depende da heurística do navegador.
 */
export function PularParaConteudo() {
  return (
    <a
      href={`#${ID_DO_CONTEUDO}`}
      className="sr-only rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
    >
      Pular para o conteúdo
    </a>
  );
}
