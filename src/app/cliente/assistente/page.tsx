"use client";

// A conversa, com a tela inteira.
//
// O painel serve para perguntar sobre o que se está vendo — ele fica por cima
// da tabela, e o produto aberto vira contexto. Esta página serve ao contrário:
// para quando a conversa É o trabalho, e a tabela atrás só atrapalharia.
//
// As duas são a MESMA conversa. `ChatDaOperacao` lê e grava em
// `conversaGuardada` com a chave do cliente, então o que foi dito no painel
// está aqui e vice-versa. Dois fios paralelos seriam a coisa mais confusa
// possível: você conversa, abre a página, e o assistente não lembra de nada.

import { Suspense } from "react";
import { ChatDaOperacao } from "@/components/client-portal/ChatDaOperacao";
import { useContextoDaPergunta } from "@/components/client-portal/useEstadoDaLoja";
import { useClientPortal } from "@/components/client-portal/context";

export default function AssistentePage() {
  return (
    <Suspense fallback={null}>
      <Conversa />
    </Suspense>
  );
}

function Conversa() {
  const { clienteId } = useClientPortal();
  // Sem produto em foco: aqui a conversa é sobre a operação, não sobre uma
  // linha da tabela. Quem quer falar de um produto usa o painel, de dentro dele.
  const chat = useContextoDaPergunta(clienteId);

  return (
    // `h-[calc(100vh-9rem)]` e não `h-full`: o shell dá padding e cabeçalho, e
    // `h-full` num filho de container sem altura definida colapsa para o
    // conteúdo — a barra de digitar acabaria no meio da tela.
    <div className="flex h-[calc(100vh-9rem)] flex-col rounded-xl border border-white/10 bg-zinc-900/40">
      <ChatDaOperacao
        contexto={chat.contexto}
        produtos={chat.produtos}
        clienteId={clienteId}
        alturaCheia
        titulo="Assistente"
      />
    </div>
  );
}
