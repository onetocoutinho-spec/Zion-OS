"use client";

// O estado de saúde de uma loja: forma + cor + motivo no tooltip.
// Forma além de cor (● ⚠ ▲) — daltonismo e impressão. O motivo SEMPRE vai
// junto: indicador sem explicação vira ruído que a agência aprende a ignorar.

import type { SaudeDaLoja } from "@/lib/contexto/saudeDaLoja";

const COR: Record<SaudeDaLoja["nivel"], string> = {
  ok: "text-emerald-400",
  atencao: "text-amber-400",
  risco: "text-red-400",
};

interface Props {
  saude: SaudeDaLoja;
  /** Mostra o rótulo ("Saudável") ao lado da forma. Padrão: só a forma. */
  comRotulo?: boolean;
  className?: string;
}

export function EstadoDaLoja({ saude, comRotulo = false, className = "" }: Props) {
  return (
    <span
      title={`${saude.rotulo}: ${saude.motivo}`}
      aria-label={`${saude.rotulo}: ${saude.motivo}`}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${COR[saude.nivel]} ${className}`}
    >
      <span aria-hidden="true" className="text-[10px] leading-none">
        {saude.forma}
      </span>
      {comRotulo && <span>{saude.rotulo}</span>}
    </span>
  );
}
