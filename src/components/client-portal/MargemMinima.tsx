"use client";

// A margem mínima — o lojista escolhe qual lucro aceita.
//
// Este número decidia sozinho o que a tela chamava de "saudável" e qual era o
// "preço ideal" de cada produto. Ele estava fixo em 5% no código: a Zion
// escolhendo pelo cliente. Aqui ele volta para quem vende.

import { useState } from "react";
import { Check, Percent } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  MARGEM_MAXIMA_PERMITIDA,
  MARGEM_MINIMA_PERMITIDA,
  margemValida,
} from "@/modules/pricing/domain/modeloPreco";
import { definirMargemMinima } from "@/lib/services/margemCliente";

export function MargemMinima({
  margem,
  onMudou,
}: {
  margem: number;
  onMudou: (nova: number) => void;
}) {
  const [valor, setValor] = useState(String(margem));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const numero = Number(valor.replace(",", "."));
  const valido = margemValida(numero);
  const mudou = valido && numero !== margem;

  async function salvar() {
    if (!mudou || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      // Adota o valor que o BANCO devolveu, não o que foi digitado.
      const gravada = await definirMargemMinima(numero);
      setValor(String(gravada));
      onMudou(gravada);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="margem-minima" className="text-[11px] uppercase tracking-wider text-zinc-500">
            Sua margem mínima
          </label>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-1.5 focus-within:border-violet-500/50">
              <input
                id="margem-minima"
                type="number"
                inputMode="decimal"
                min={MARGEM_MINIMA_PERMITIDA}
                max={MARGEM_MAXIMA_PERMITIDA}
                step="0.5"
                value={valor}
                onChange={(e) => {
                  setValor(e.target.value);
                  setErro(null);
                }}
                className="w-16 bg-transparent text-sm text-zinc-100 outline-none"
              />
              <Percent size={13} className="text-zinc-500" />
            </div>
            <Button onClick={salvar} disabled={!mudou || salvando} className="px-3 py-1.5 text-xs">
              {salvando ? "Salvando…" : salvo ? <><Check size={13} /> Salvo</> : "Salvar"}
            </Button>
          </div>
        </div>

        <p className="max-w-md flex-1 text-xs leading-relaxed text-zinc-500">
          É o lucro mínimo que você aceita numa venda. Define o{" "}
          <span className="text-amber-400">preço ideal</span> de cada produto e o que a tabela
          marca como risco. Ninguém escolhe isso por você.
        </p>
      </div>

      {!valido && valor.trim() !== "" && (
        <p className="mt-2 text-xs text-red-400">
          Escolha um valor entre {MARGEM_MINIMA_PERMITIDA}% e {MARGEM_MAXIMA_PERMITIDA}% que ainda
          sobre depois das taxas.
        </p>
      )}
      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
    </div>
  );
}
