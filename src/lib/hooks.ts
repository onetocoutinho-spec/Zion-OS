"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribe } from "./store";
import {
  classificarEstado,
  comoErro,
  type EstadoAssincrono,
} from "./estadoAssincrono";

export type { EstadoAssincrono };

export interface ConsultaViva<T> {
  /** O dado. `null` enquanto carrega, quando não há, e quando falhou. */
  data: T | null;
  /** Preservado: `true` só no primeiro carregamento, antes de qualquer resposta. */
  carregando: boolean;
  /** Preservado. */
  reload: () => void;
  /** O estado explícito. Use este para decidir o que a superfície mostra. */
  estado: EstadoAssincrono;
  /** A falha, quando houve. `null` nos outros três estados. */
  erro: Error | null;
  /**
   * Uma nova busca está em voo E já existe resposta anterior na tela.
   *
   * Serve ao drill-down: trocar o produto aberto mantém `carregando: false` e o
   * dado ANTERIOR visível. Sem este sinal, clicar no produto B mostra os dados
   * do produto A como se fossem do B — sem nada na tela denunciando.
   */
  revalidando: boolean;
}

interface Opcoes<T> {
  /**
   * A noção de vazio DESTA consulta, quando o default não serve.
   *
   * O default trata `null`, `[]`, `""` e coleções de tamanho zero como vazio, e
   * NUNCA trata `0`, `false` ou objeto presente como vazio. Ver `estadoAssincrono`.
   */
  vazio?: (dado: T) => boolean;
}

/**
 * Executa uma consulta assíncrona da camada de serviços e re-executa
 * automaticamente sempre que qualquer dado do store mudar.
 *
 * Os dados chegam após o mount (`carregando=true` no primeiro render) — isso
 * evita divergência de hidratação entre servidor e localStorage.
 *
 * ---------------------------------------------------------------------------
 * O CONTRATO É ADITIVO, e isso não é detalhe
 * ---------------------------------------------------------------------------
 *
 * Existem 73 arquivos consumindo este hook, todos desestruturando campos
 * nomeados (`data`, `carregando`, `reload`) — nenhum usa spread ou repassa o
 * objeto adiante. `data`, `carregando` e `reload` mantêm exatamente o
 * comportamento anterior; `estado`, `erro` e `revalidando` são novos.
 *
 * Nenhuma tela precisa mudar para continuar funcionando. As que quiserem
 * distinguir falha de vazio passam a poder.
 *
 * ---------------------------------------------------------------------------
 * O QUE FOI CORRIGIDO
 * ---------------------------------------------------------------------------
 *
 * O `catch` gravava `{ data: null, carregando: false }` — o MESMO valor de uma
 * consulta que não achou nada. "O servidor recusou" e "não existe nenhum" eram
 * indistinguíveis, e pedem coisas opostas do lojista.
 *
 * O erro continua no console e continua NÃO travando a tela em "carregando".
 * O que mudou é que agora ele também chega a quem desenha.
 */
export function useLiveQuery<T>(
  query: () => Promise<T>,
  deps: unknown[] = [],
  opcoes: Opcoes<T> = {}
): ConsultaViva<T> {
  const [estado, setEstado] = useState<{
    data: T | null;
    carregando: boolean;
    erro: Error | null;
  }>({ data: null, carregando: true, erro: null });
  const [revalidando, setRevalidando] = useState(false);

  // `já respondeu alguma vez` — em ref e não em state de propósito: entra na
  // decisão de marcar `revalidando`, e como state provocaria um render a mais
  // por resposta sem mudar nada na tela.
  const jaRespondeu = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    let ativo = true;
    // Só é revalidação quando já houve resposta. Na primeira vez quem fala é
    // `carregando`, e marcar os dois seria pedir à tela que escolhesse.
    if (jaRespondeu.current) setRevalidando(true);
    query()
      .then((result) => {
        if (!ativo) return;
        jaRespondeu.current = true;
        setEstado({ data: result, carregando: false, erro: null });
        setRevalidando(false);
      })
      .catch((bruto) => {
        // Erros do Supabase (rede, RLS, schema ausente) não podem travar a tela
        // em "carregando" — loga, e agora TAMBÉM entrega o erro a quem desenha.
        console.error("[Zion OS] Falha ao consultar dados:", bruto);
        if (!ativo) return;
        jaRespondeu.current = true;
        setEstado({ data: null, carregando: false, erro: comoErro(bruto) });
        setRevalidando(false);
      });
    return () => {
      ativo = false;
    };
  }, deps);

  useEffect(() => {
    const cancel = run();
    const unsubscribe = subscribe(run);
    return () => {
      cancel();
      unsubscribe();
    };
  }, [run]);

  const situacao = classificarEstado({
    carregando: estado.carregando,
    erro: estado.erro,
    dado: estado.data,
    vazio: opcoes.vazio as ((dado: unknown) => boolean) | undefined,
  });

  return { ...estado, reload: run, estado: situacao, revalidando };
}
