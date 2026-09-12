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

    // ===================================================================
    // A QUINTA VEZ — 26/08/2026, e a primeira que GRAVOU DADO
    // ===================================================================
    //
    // `visibilitychange` só dispara quando a aba fica OCULTA: outra aba
    // selecionada, ou janela minimizada. TROCAR DE JANELA NÃO DISPARA — o
    // navegador continua "visible" com a janela atrás de outra.
    //
    // Foi exatamente o caso: o app numa janela, o terminal em outra, a aba
    // aberta desde antes do deploy. O detector conferiu UMA vez, no
    // carregamento, quando servidor e pacote ainda concordavam — e nunca mais.
    // No meio disso uma importação de 1003 produtos entrou com o pacote velho
    // e gravou 7224 variações com PESO ZERO, porque o campo de peso só existia
    // no pacote novo.
    //
    // `focus` pega a volta para a janela, que é o gesto que a pessoa faz de
    // fato. O intervalo pega quem nunca sai: uma hora de tela aberta sem trocar
    // de janela também atravessa deploy. Os dois passam pela mesma trava de um
    // minuto — o gatilho mudou, a frequência não.
    window.addEventListener("focus", conferir);
    const relogio = setInterval(conferir, ESPERA_ENTRE_CONSULTAS_MS * 5);

    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", conferir);
      window.removeEventListener("focus", conferir);
      clearInterval(relogio);
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
