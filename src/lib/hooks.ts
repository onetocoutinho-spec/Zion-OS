"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribe } from "./store";

/**
 * Executa uma consulta assíncrona da camada de serviços e re-executa
 * automaticamente sempre que qualquer dado do store mudar.
 *
 * Os dados chegam após o mount (carregando=true no primeiro render) — isso
 * evita divergência de hidratação entre servidor e localStorage. Quando o
 * sistema migrar para Supabase, este hook continua funcionando (ou pode ser
 * trocado por React Query) sem alterar as telas.
 */
export function useLiveQuery<T>(
  query: () => Promise<T>,
  deps: unknown[] = []
): { data: T | null; carregando: boolean; reload: () => void } {
  const [estado, setEstado] = useState<{ data: T | null; carregando: boolean }>({
    data: null,
    carregando: true,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    let ativo = true;
    query().then((result) => {
      if (ativo) setEstado({ data: result, carregando: false });
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

  return { ...estado, reload: run };
}
