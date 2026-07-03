"use client";

// Seletor rápido "Executar agente IA…" usado nas páginas de detalhe de
// cliente, produto e anúncio. Escolher um agente navega para a página dele
// com o contexto já pré-selecionado via query string.

import { useRouter } from "next/navigation";
import { useLiveQuery } from "@/lib/hooks";
import { listarAgentes } from "@/lib/services/agentes";

interface ExecutarComAgenteProps {
  clienteId?: string;
  produtoId?: string;
  anuncioId?: string;
}

export function ExecutarComAgente({ clienteId, produtoId, anuncioId }: ExecutarComAgenteProps) {
  const router = useRouter();
  const { data: agentes } = useLiveQuery(listarAgentes);

  function executar(agenteId: string) {
    if (!agenteId) return;
    const qs = new URLSearchParams();
    if (clienteId) qs.set("cliente", clienteId);
    if (produtoId) qs.set("produto", produtoId);
    if (anuncioId) qs.set("anuncio", anuncioId);
    router.push(`/agentes/${agenteId}?${qs.toString()}`);
  }

  return (
    <select
      value=""
      onChange={(e) => executar(e.target.value)}
      title="Executar um agente IA com os dados desta página"
      className="cursor-pointer rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-300 outline-none transition-colors hover:bg-violet-500/20"
    >
      <option value="" className="bg-[#12121c] text-zinc-400">
        ✦ Executar agente IA…
      </option>
      {(agentes ?? []).map((a) => (
        <option key={a.id} value={a.id} className="bg-[#12121c] text-zinc-200">
          {a.nome} — {a.area}
        </option>
      ))}
    </select>
  );
}
