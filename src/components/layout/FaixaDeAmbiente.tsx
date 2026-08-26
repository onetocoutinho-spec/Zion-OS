"use client";

// A faixa que diz, no topo de tudo, que este é o ambiente de teste.
//
// ===========================================================================
// POR QUE FORA DO AuthGate
// ===========================================================================
//
// Mesma razão do `AvisoDeVersao` logo ao lado: a tela de login é justamente
// onde a informação vale mais. É ali que se digita a senha, e digitar a senha
// da conta real numa tela que se pensava ser de teste é o começo do erro — não
// o fim dele.
//
// ===========================================================================
// POR QUE NÃO É DISPENSÁVEL
// ===========================================================================
//
// O `AvisoDeVersao` tem um "x" porque quem fecha continua trabalhando: o aviso
// é sobre uma aba velha, e a pessoa pode escolher recarregar depois. Aqui não —
// a faixa não avisa de um problema a resolver, ela DIZ ONDE VOCÊ ESTÁ. Fechar
// não muda o ambiente, só apaga a resposta.
//
// Ela é fina e não cobre nada: ocupa uma linha e empurra o resto para baixo.

import { useEffect, useState } from "react";
import { AlertTriangle, FlaskConical } from "lucide-react";
import {
  faixaDeAmbiente,
  type FaixaDeAmbiente as Faixa,
} from "@/modules/portal/domain/faixaDeAmbiente";
import { lerMarcaDoAmbiente } from "@/lib/services/ambiente";

/**
 * O navegador é quem sabe se a página está aberta na máquina de quem
 * desenvolve. O banco não tem como saber quem está falando com ele.
 */
function emLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

const ESTILO: Record<"teste" | "perigo", string> = {
  teste:
    "bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-400/25",
  // Vermelho e mais forte: aqui não é contexto, é a conta que paga do outro
  // lado da tela.
  perigo: "bg-red-600/25 text-red-100 ring-1 ring-inset ring-red-400/40",
};

export function FaixaDeAmbiente() {
  const [faixa, setFaixa] = useState<Faixa | null>(null);

  useEffect(() => {
    let vivo = true;
    void lerMarcaDoAmbiente().then((marca) => {
      if (!vivo) return;
      const f = faixaDeAmbiente(marca, emLocalhost());
      setFaixa(f.mostrar ? f : null);
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (!faixa || faixa.tom === "nenhum") return null;
  const Icone = faixa.tom === "perigo" ? AlertTriangle : FlaskConical;

  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-2 px-3 py-1.5 text-center text-[12px] font-medium ${ESTILO[faixa.tom]}`}
    >
      <Icone size={13} className="shrink-0" />
      <span>{faixa.texto}</span>
    </div>
  );
}
