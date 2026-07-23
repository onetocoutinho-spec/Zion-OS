"use client";

// Reprojeção oficial dos Patterns (E5.7) — o botão que aposenta o script.
//
// Gatilho sempre HUMANO (R-PD-1: sob demanda, sem cron, sem gatilho
// automático). Executa `reprojetar()` e exibe o relatório de auditoria
// completo: antes × depois, novos/alterados/inalterados, órfãos (listados,
// jamais apagados) e a verificação de idempotência DESTA execução.

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  reprojetar,
  type RelatorioReprojecao,
} from "@/modules/adaptive-intelligence/application/reprojection";

export function ReprojecaoPadroes({ aoConcluir }: { aoConcluir?: () => void }) {
  const [executando, setExecutando] = useState(false);
  const [relatorio, setRelatorio] = useState<RelatorioReprojecao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function executar() {
    setExecutando(true);
    setErro(null);
    try {
      const r = await reprojetar();
      setRelatorio(r);
      aoConcluir?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha na reprojeção.");
    } finally {
      setExecutando(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={executar}
          disabled={executando}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#12121c] px-3 py-1.5 font-medium text-zinc-200 transition-colors hover:border-white/20 disabled:opacity-50"
        >
          <RefreshCw size={13} className={executando ? "animate-spin" : ""} />
          {executando ? "Reprojetando…" : "Reprojetar padrões"}
        </button>
        <span className="text-zinc-500">
          Reconstrói a projeção `padroes` a partir do Journal — determinística e idempotente
          (RFC-AIL-004 §7.3); gatilho sempre humano.
        </span>
      </div>

      {erro && <p className="mt-2 text-red-400">{erro}</p>}

      {relatorio && (
        <div className="mt-2 border-t border-white/5 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={relatorio.idempotencia === "verificada_identica" ? "green" : "red"}>
              {`idempotência ${relatorio.idempotencia === "verificada_identica" ? "verificada" : "DIVERGENTE"}`}
            </Badge>
            <span className="text-zinc-400">
              {relatorio.escopo.decisoesLidas} decisões → {relatorio.depois} patterns ·{" "}
              {relatorio.novos} novos · {relatorio.alterados} alterados · {relatorio.inalterados} inalterados
            </span>
            {relatorio.orfaos.length > 0 && (
              <Badge tone="orange">{`${relatorio.orfaos.length} órfão(s) — listados, não apagados`}</Badge>
            )}
          </div>
          <p className="mt-1 leading-relaxed text-zinc-500">{relatorio.explanation}</p>
        </div>
      )}
    </div>
  );
}
