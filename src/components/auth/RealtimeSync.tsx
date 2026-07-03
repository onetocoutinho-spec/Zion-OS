"use client";

// Sincronização em tempo real via Supabase Realtime.
//
// Ouve qualquer INSERT/UPDATE/DELETE no schema public e dispara o mesmo
// notificarMudanca() usado pelas escritas locais — o useLiveQuery de todas
// as telas abertas re-executa as consultas. Assim, edições de um colega
// aparecem sem recarregar a página.
//
// Requer que as tabelas estejam na publication supabase_realtime
// (rode database/supabase-realtime.sql uma vez no SQL Editor).

import { useEffect } from "react";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";
import { notificarMudanca } from "@/lib/store";

export function RealtimeSync() {
  useEffect(() => {
    if (!supabaseConfigurado) return;
    const sb = getSupabase();

    const canal = sb
      .channel("zion-os-mudancas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        () => notificarMudanca()
      )
      .subscribe();

    return () => {
      sb.removeChannel(canal);
    };
  }, []);

  return null;
}
