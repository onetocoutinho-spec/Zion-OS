"use client";

// O comportamento de teclado que todo diálogo do Zion OS precisa ter.
//
// ===========================================================================
// O DEFEITO, MEDIDO
// ===========================================================================
//
// Nove overlays no app. NENHUM prendia o foco, e só UM (o painel do
// assistente) ouvia Escape. Os dois piores eram justamente as gavetas de menu
// do celular — a da equipe e a do portal — que não faziam nem uma coisa nem
// outra.
//
// Sem foco preso, abrir a gaveta e apertar Tab passeia pela página ATRÁS do
// fundo escuro: a pessoa tabula por uma tela que não está vendo, e o anel de
// foco (que a Fase 1 acabou de acender) aparece atrás do overlay. Com leitor
// de tela é pior, porque a gaveta nem existe na leitura.
//
// ===========================================================================
// AS QUATRO COISAS, E POR QUE SÃO AS QUATRO
// ===========================================================================
//
//   1. ENTRAR    o foco vai para dentro ao abrir — senão a primeira tecla age
//                sobre a página de trás.
//   2. FICAR     Tab e Shift+Tab circulam dentro (a regra está em
//                `focoPreso.ts`, com teste).
//   3. SAIR      Escape fecha. É o que a mão faz sem pensar.
//   4. VOLTAR    ao fechar, o foco volta ao botão que abriu — senão ele cai no
//                `body` e o próximo Tab recomeça a página do zero.
//
// A quarta é a que se esquece, e é a que faz a diferença entre "acessível" e
// "utilizável": sem ela, fechar um modal no meio de uma tabela de 40 linhas
// devolve a pessoa para o topo da página.

import { useEffect, useRef, type RefObject } from "react";
import { proximoIndiceDoFoco, SELETOR_FOCAVEL } from "./focoPreso";

interface Opcoes {
  /**
   * De onde o foco veio, quando `document.activeElement` não serve.
   *
   * O caso real é o painel do assistente: o botão flutuante é renderizado em
   * `{!aberto && …}`, então no instante em que o painel abre o botão JÁ saiu do
   * DOM e o `activeElement` virou o `body`. Devolver o foco ao `body` é perdê-lo.
   * Quem tem esse formato guarda o gatilho num ref e passa aqui.
   */
  gatilho?: RefObject<HTMLElement | null>;
}

/**
 * Prende o foco dentro do diálogo enquanto `aberto`.
 *
 * @param aberto   se o diálogo está na tela
 * @param aoFechar o que Escape faz — ou `null` quando Escape NÃO deve fechar.
 *                 `null` não é preguiça: a missão de republicação
 *                 (`MissaoRepublicacao`) é uma decisão bloqueante em que sair
 *                 sem escolher é um estado inválido. Ali o foco fica preso e
 *                 o Escape não resolve nada — de propósito.
 * @returns o ref para pôr na caixa do diálogo
 */
export function useDialogo<T extends HTMLElement = HTMLDivElement>(
  aberto: boolean,
  aoFechar: (() => void) | null,
  opcoes: Opcoes = {}
): RefObject<T | null> {
  const caixaRef = useRef<T>(null);

  // O callback entra por ref para não reassinar o listener a cada render. Um
  // `aoFechar` recriado toda vez (o comum: arrow inline) refaria o efeito, e
  // refazer o efeito reexecuta o foco inicial — o cursor pularia do campo que
  // a pessoa está preenchendo de volta para o começo do formulário.
  //
  // A atualização vai num EFEITO e não no corpo do componente: escrever em ref
  // durante o render é proibido em React concorrente, porque o render pode ser
  // descartado e refeito — e o lint pega (`Cannot access refs during render`).
  const aoFecharRef = useRef(aoFechar);
  useEffect(() => {
    aoFecharRef.current = aoFechar;
  });

  const gatilhoExterno = opcoes.gatilho;

  useEffect(() => {
    if (!aberto) return;
    const caixa = caixaRef.current;
    if (!caixa) return;

    // Para onde devolver o foco no fim. Lido AGORA, antes de mexer em nada.
    const gatilho =
      gatilhoExterno?.current ?? (document.activeElement as HTMLElement | null);

    // A caixa precisa poder receber foco para o caso de não haver nada focável
    // dentro (um diálogo só de texto). `-1` porque ela recebe por programa e
    // não deve virar uma parada do Tab — ver `SELETOR_FOCAVEL`.
    if (!caixa.hasAttribute("tabindex")) caixa.setAttribute("tabindex", "-1");

    /**
     * Relida a cada tecla, e não uma vez só.
     *
     * O conteúdo do diálogo muda enquanto ele está aberto: o botão "Publicar"
     * desabilita durante o envio, um passo aparece, uma lista carrega. Uma
     * lista capturada na abertura apontaria para elementos que já saíram.
     *
     * `offsetParent === null` derruba o que está escondido (`hidden`, display
     * none). O `position: fixed` não tem offsetParent mesmo visível, daí a
     * segunda condição.
     */
    const focaveis = () =>
      Array.from(caixa.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)).filter(
        (el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed"
      );

    const primeiro = focaveis()[0];
    (primeiro ?? caixa).focus();

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const fechar = aoFecharRef.current;
        if (!fechar) return;
        // `stopPropagation` para o Escape não atravessar diálogos empilhados e
        // fechar os dois de uma vez (publicar abre a missão por cima).
        e.stopPropagation();
        fechar();
        return;
      }

      if (e.key !== "Tab") return;

      const lista = focaveis();
      const alvo = proximoIndiceDoFoco(
        lista.length,
        lista.indexOf(document.activeElement as HTMLElement),
        e.shiftKey
      );
      if (alvo === null) return; // o navegador segue, e é o certo no meio
      e.preventDefault();
      lista[alvo]?.focus();
    };

    // Fase de CAPTURA: o Escape chega aqui antes de qualquer handler de dentro
    // do diálogo, e o Tab é interceptado antes de o navegador mover o foco.
    document.addEventListener("keydown", aoTeclar, true);

    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      // `isConnected`: se a página trocou embaixo, o gatilho é um nó solto e
      // focá-lo não faz nada — mas checar deixa a intenção legível.
      if (gatilho?.isConnected) gatilho.focus();
    };
  }, [aberto, gatilhoExterno]);

  return caixaRef;
}
