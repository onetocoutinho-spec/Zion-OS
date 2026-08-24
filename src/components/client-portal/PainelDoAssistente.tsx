"use client";

/**
 * O assistente como painel — abre sobre a tela em que a pessoa está trabalhando.
 *
 * A caixa embutida na página nunca ia parecer uma conversa: ela dividia espaço
 * com filtros e tabela, tinha 96 de altura máxima, e a resposta rolava dentro
 * de uma janelinha. Aqui a conversa ocupa a altura inteira e a tabela continua
 * visível atrás — que é o ponto: você conversa SOBRE o que está vendo.
 *
 * O contexto vem de onde a pessoa está: com um produto aberto, "o que falta
 * aqui?" é sobre ele. Isso é o que o painel tem e uma página separada não teria.
 *
 * A conversa é a MESMA da página própria — as duas leem `conversaGuardada`.
 * Se fossem dois fios, abrir a página depois de conversar aqui começaria do
 * zero, e ninguém entende por quê.
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MessagesSquare, X } from "lucide-react";
import { ChatDaOperacao } from "./ChatDaOperacao";
import { useContextoDaPergunta } from "./useEstadoDaLoja";
import { useClientPortal } from "./context";
import { notificarMudanca } from "@/lib/store";

/**
 * O painel do assistente.
 *
 * `lojaId` existe para as telas da AGÊNCIA, que não têm o provider do portal:
 * lá a loja vem do seletor global (`useLojaAtual`). Omitido, o painel segue
 * lendo a loja do portal — o caminho do lojista, inalterado.
 */
export function PainelDoAssistente({ lojaId }: { lojaId?: string | null } = {}) {
  // useSearchParams exige Suspense no App Router.
  return (
    <Suspense fallback={null}>
      <Painel lojaId={lojaId} />
    </Suspense>
  );
}

function Painel({ lojaId }: { lojaId?: string | null }) {
  const portal = useClientPortal();
  // A loja da prop VENCE: quem a passa é a casca da agência, que sabe qual
  // loja está sendo operada. Sem ela, a do portal — onde o lojista É a loja.
  const clienteId = lojaId ?? portal.clienteId;
  const [aberto, setAberto] = useState(false);
  /**
   * O FOCO tem ida e volta. O gatilho era DESMONTADO no mesmo render em que o
   * painel abria: o elemento focado deixava de existir, o foco caía no <body>,
   * e quem usa teclado tabulava pela sidebar inteira até achar o campo. Ao
   * fechar, idem. Agora o gatilho fica montado (escondido), o painel foca o
   * primeiro campo ao abrir, e devolve o foco ao gatilho ao fechar.
   */
  const gatilho = useRef<HTMLButtonElement | null>(null);
  const painel = useRef<HTMLElement | null>(null);
  // Só devolve o foco se o painel ESTEVE aberto: na montagem da página o
  // efeito roda com `aberto = false`, e focar o gatilho ali roubaria o foco
  // de onde a pessoa estava.
  const jaAbriu = useRef(false);
  useEffect(() => {
    if (aberto) {
      jaAbriu.current = true;
      const campo = painel.current?.querySelector<HTMLElement>("input:not([type=file]), textarea");
      campo?.focus();
    } else if (jaAbriu.current) {
      gatilho.current?.focus({ preventScroll: true });
    }
  }, [aberto]);
  /**
   * Qual produto está aberto — lido da URL.
   *
   * O painel vive no shell e não podia saber isso de outra forma. Mas a
   * esteira já grava o produto escolhido em `?produto=` (para o voltar do
   * navegador e um link compartilhável funcionarem), e é daí que ele vem: uma
   * peça que já existia, servindo a um segundo propósito sem precisar de fio
   * novo entre componentes.
   */
  const params = useSearchParams();
  const produtoAberto = params.get("produto");

  const pathname = usePathname();

  // Esc fecha. É o que a mão faz sem pensar, e sem isso o painel vira uma
  // armadilha em telas estreitas, onde o X pode estar fora de alcance.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  /**
   * Na página do assistente o painel não aparece.
   *
   * Seriam dois chats vivos gravando na mesma chave do storage, brigando pela
   * mesma conversa — o mesmo defeito que tirar as caixas embutidas resolveu, e
   * ele voltaria pela porta dos fundos. Um botão flutuante que abre uma cópia
   * do que já está na tela também não faz sentido para quem clica.
   *
   * A saída fica DEPOIS dos hooks: um `return` antes deles muda a quantidade
   * de hooks entre renderizações, e o React quebra em produção mesmo com o
   * type-check verde.
   */
  if (pathname?.startsWith("/cliente/assistente")) return null;

  return (
    <>
      <button
        ref={gatilho}
        type="button"
        onClick={() => setAberto(true)}
        aria-expanded={aberto}
        aria-controls="painel-do-assistente"
        className={`fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 [@media(pointer:coarse)]:min-h-12 ${
          aberto ? "pointer-events-none opacity-0" : ""
        }`}
        aria-label="Abrir o assistente"
        tabIndex={aberto ? -1 : 0}
      >
        <MessagesSquare size={16} />
        <span className="hidden sm:inline">Assistente</span>
      </button>

      {aberto && (
        <>
          {/* O fundo escurece mas NÃO some: a tabela continua legível atrás,
              porque a conversa é sobre ela. */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setAberto(false)}
            aria-hidden
          />
          <aside
            ref={painel}
            id="painel-do-assistente"
            role="dialog"
            aria-modal="true"
            aria-label="Assistente"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-white/10 bg-zinc-950 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                <MessagesSquare size={15} className="text-violet-400" />
                Assistente
              </p>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            {/* `flex-1 min-h-0` é o que faz a conversa rolar DENTRO do painel em
                vez de esticar a página inteira. Sem o `min-h-0` o flex se
                recusa a encolher e a barra de digitar sai da tela. */}
            <div className="min-h-0 flex-1">
              <ConversaDoPainel clienteId={clienteId} produtoAberto={produtoAberto} />
            </div>
          </aside>
        </>
      )}
    </>
  );
}

/**
 * A conversa — e o CONTEXTO dela — só existem com o painel aberto.
 *
 * `useContextoDaPergunta` dispara cinco consultas (catálogo com peso, resumo
 * de anúncios, TODAS as imagens, canal, infrações). Rodava em toda tela do
 * portal, antes do `if (aberto)`, para um painel que a pessoa podia nunca
 * abrir — e era a consulta pesada que já derrubou o contexto uma vez. Num
 * componente próprio, o hook só roda quando há conversa para alimentar.
 * (Auditoria do Copilot, 2026-08-22, P1.)
 */
function ConversaDoPainel({
  clienteId,
  produtoAberto,
}: {
  clienteId: string;
  produtoAberto: string | null;
}) {
  const chat = useContextoDaPergunta(clienteId, produtoAberto);
  return (
    <ChatDaOperacao
      contexto={chat.contexto}
      produtos={chat.produtos}
      clienteId={clienteId}
      // A tela ATRÁS do painel precisa mostrar o que o cartão acabou de
      // gravar. `notificarMudanca` é o mesmo sinal das escritas locais
      // (repositorio.ts): todo `useLiveQuery` aberto re-consulta. O
      // Realtime também dispara isso — quando o websocket está de pé;
      // este é o caminho que não depende dele.
      aoGravar={notificarMudanca}
      alturaCheia
      titulo={chat.contexto?.produto ? `Sobre ${chat.contexto.produto.nome}` : "Sobre a sua loja"}
    />
  );
}
