"use client";

// A aba avisa que está velha — no carregamento, não só depois de uma operação.
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// Quatro vezes em 01–02/08/2026 uma aba aberta atravessou um deploy e entregou
// resultado parcial que se lê como completo:
//
//   · a importação de 279 anúncios gravou ZERO estado de marketplace;
//   · a atualização de estado dos 502 não rodou;
//   · a linha de "campos exigidos" não apareceu, e não dava para dizer se era
//     ausência de defeito ou ausência de código;
//   · o botão "O que o ML manda" não estava na tela, já estando no ar.
//
// O detector anterior viajava na resposta de `/api/ml/importar-anuncios`, então
// só falava DEPOIS de uma importação. O quarto caso ele não pegava: abrir a
// tela e não achar um botão não é uma operação.
//
// ===========================================================================
// O QUE ELE NÃO FAZ
// ===========================================================================
//
// Recarregar sozinho. Uma recarga automática no meio de uma importação de 781
// anúncios mataria a operação — e trocar de aba, coisa muito menor, já apagou
// uma mensagem de resultado. Quem decide quando recarregar é quem está usando.
//
// E é DISPENSÁVEL: quem fecha continua trabalhando. Um aviso que não sai da
// frente vira obstáculo, e obstáculo se contorna sem ler.

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import {
  abaDesatualizada,
  AVISO_ABA_DESATUALIZADA,
} from "@/modules/integration/domain/abaDesatualizada";

/** Intervalo mínimo entre duas consultas, para o foco não virar enxurrada. */
const ESPERA_ENTRE_CONSULTAS_MS = 60_000;

export function AvisoDeVersao() {
  const [velha, setVelha] = useState(false);
  const [dispensado, setDispensado] = useState(false);

  useEffect(() => {
    let vivo = true;
    let ultima = 0;

    async function conferir() {
      // Só vale conferir quando a aba está visível: em segundo plano o
      // navegador estrangula o tempo e a resposta chegaria fora de hora.
      if (document.visibilityState !== "visible") return;
      const agora = Date.now();
      if (agora - ultima < ESPERA_ENTRE_CONSULTAS_MS) return;
      ultima = agora;
      try {
        const r = await fetch("/api/versao", { cache: "no-store" });
        if (!r.ok) return; // servidor sem a rota: não sei, e não sei não é aviso
        const d = (await r.json()) as { versao?: string };
        if (!vivo) return;
        setVelha(
          abaDesatualizada({
            doNavegador: process.env.NEXT_PUBLIC_VERSAO,
            doServidor: d.versao,
          })
        );
      } catch {
        // Rede fora não é versão velha. Silêncio.
      }
    }

    void conferir();
    // A aba pode ficar aberta por horas: reconfere quando ela volta à frente.
    // É um `fetch` de 30 bytes, não uma recarga de perfil — o defeito do
    // AuthGate foi refazer trabalho pesado no foco, não olhar para o foco.
    document.addEventListener("visibilitychange", conferir);
    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", conferir);
    };
  }, []);

  if (!velha || dispensado) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300"
    >
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <p className="flex-1">{AVISO_ABA_DESATUALIZADA}</p>
      <button
        type="button"
        onClick={() => setDispensado(true)}
        aria-label="Dispensar aviso"
        className="shrink-0 rounded p-1 text-amber-400/70 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
      >
        <X size={15} />
      </button>
    </div>
  );
}
