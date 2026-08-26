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
import { FlaskConical } from "lucide-react";
import { faixaDeAmbiente } from "@/modules/portal/domain/faixaDeAmbiente";
import { lerMarcaDoAmbiente } from "@/lib/services/ambiente";

export function FaixaDeAmbiente() {
  const [texto, setTexto] = useState("");

  useEffect(() => {
    let vivo = true;
    void lerMarcaDoAmbiente().then((marca) => {
      if (!vivo) return;
      const f = faixaDeAmbiente(marca);
      setTexto(f.mostrar ? f.texto : "");
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (!texto) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-500/15 px-3 py-1.5 text-center text-[12px] font-medium text-amber-200 ring-1 ring-inset ring-amber-400/25"
    >
      <FlaskConical size={13} className="shrink-0" />
      <span>{texto}</span>
    </div>
  );
}
