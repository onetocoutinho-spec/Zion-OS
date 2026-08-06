"use client";

// A voz do portal — o que um leitor de tela ouve quando algo acontece sozinho.
//
// ===========================================================================
// O DEFEITO, MEDIDO
// ===========================================================================
//
// `aria-live` no app inteiro: UMA ocorrência. E as operações do portal são
// justamente as longas e assíncronas — publicar no ML, otimizar com IA,
// importar planilha. Todas terminam mudando um pedaço da tela que pode estar
// fora do foco, e nenhuma dizia nada.
//
// Para quem enxerga, o cartão verde aparecendo já é o aviso. Para quem usa
// leitor de tela, publicar um anúncio era: aperta Enter, silêncio, e nenhuma
// forma de saber se deu certo sem sair caçando pela página.
//
// ===========================================================================
// POR QUE UMA REGIÃO SÓ, NO SHELL
// ===========================================================================
//
// Mesmo argumento do `PainelDoAssistente` morar no shell: uma peça repetida em
// N páginas diverge na primeira que alguém esquecer. E há um motivo técnico
// somado — leitor de tela só anuncia mudanças de uma região que JÁ ESTAVA no
// DOM quando o texto mudou. Uma região montada junto com a mensagem costuma
// não falar. Ficando no shell, ela existe desde sempre e sempre fala.

import { createContext, useCallback, useContext, useRef, useState } from "react";

/** Como o anúncio interrompe quem estiver falando. */
export type Urgencia =
  /** Espera a fala atual terminar. O padrão, e o certo para "deu certo". */
  | "educado"
  /** Interrompe. Só para erro: a pessoa precisa saber antes de seguir. */
  | "urgente";

const ContextoDeAnuncios = createContext<((texto: string, urgencia?: Urgencia) => void) | null>(
  null
);

/**
 * Anuncia um fato para quem usa leitor de tela.
 *
 * Fora do provider devolve uma função que não faz nada, de propósito: o painel
 * da equipe não tem a região, e uma peça compartilhada entre os dois lados não
 * pode quebrar por causa disso.
 */
export function useAnunciar(): (texto: string, urgencia?: Urgencia) => void {
  const anunciar = useContext(ContextoDeAnuncios);
  return anunciar ?? semAnuncio;
}

function semAnuncio() {
  /* sem região montada: nada a fazer */
}

export function ProvedorDeAnuncios({ children }: { children: React.ReactNode }) {
  const [educado, setEducado] = useState("");
  const [urgente, setUrgente] = useState("");

  /**
   * Um contador colado no texto.
   *
   * Anunciar a MESMA frase duas vezes seguidas (publicar dois anúncios, os dois
   * "Anúncio publicado.") não muda o conteúdo da região, e sem mudança o leitor
   * de tela não fala a segunda vez. O sufixo invisível garante a mudança.
   *
   * `​` (espaço de largura zero) repetido: não ocupa espaço, não é lido em
   * voz alta, e é diferente a cada chamada.
   */
  const n = useRef(0);

  const anunciar = useCallback((texto: string, urgencia: Urgencia = "educado") => {
    const limpo = texto.trim();
    if (!limpo) return;
    n.current += 1;
    const marcado = limpo + "​".repeat((n.current % 4) + 1);
    if (urgencia === "urgente") setUrgente(marcado);
    else setEducado(marcado);
  }, []);

  return (
    <ContextoDeAnuncios.Provider value={anunciar}>
      {children}
      {/* As DUAS regiões existem desde a montagem e nunca são desmontadas.
          `sr-only` e não `hidden`: o que está com `display: none` não é lido. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {educado}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {urgente}
      </div>
    </ContextoDeAnuncios.Provider>
  );
}
