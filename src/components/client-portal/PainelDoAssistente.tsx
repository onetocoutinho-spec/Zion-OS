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

import { Suspense, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MessagesSquare, X } from "lucide-react";
import { useDialogo } from "@/components/ui/useDialogo";
import { ChatDaOperacao } from "./ChatDaOperacao";
import { useContextoDaPergunta } from "./useEstadoDaLoja";
import { useClientPortal } from "./context";

/**
 * O botão flutuante que abre o painel.
 *
 * `bottom` e `right` saem de `calc(…env(safe-area-inset-*))` e não do
 * `bottom-5 right-5` de antes. Num iPhone em retrato, 1,25rem cravado põe o
 * botão em cima da faixa do indicador de home: o toque vira "voltar ao início"
 * do sistema e o assistente não abre. O inset da direita é o mesmo problema em
 * paisagem, do lado do recorte. Em tela sem recorte os dois valem 0.
 *
 * OS 3.5rem A MAIS ATÉ `lg` são a `NavegacaoDeBaixo`, que ocupa a faixa
 * inferior no celular. Sem eles o botão flutuaria EM CIMA da barra, cobrindo
 * uma das cinco áreas — e seria a de "Zion", a última, porque o botão está à
 * direita. De `lg` para cima a barra não existe (a sidebar assume) e o botão
 * volta para junto do canto.
 */
const CLASSE_DO_BOTAO_FLUTUANTE =
  "fixed bottom-[calc(3.5rem+1.25rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-40 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 lg:bottom-[calc(1.25rem+env(safe-area-inset-bottom))] [@media(pointer:coarse)]:min-h-12";

export function PainelDoAssistente() {
  // useSearchParams exige Suspense no App Router.
  return (
    <Suspense fallback={null}>
      <Painel />
    </Suspense>
  );
}

function Painel() {
  const { clienteId } = useClientPortal();
  const [aberto, setAberto] = useState(false);
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
  const chat = useContextoDaPergunta(clienteId, params.get("produto"));

  const pathname = usePathname();

  /**
   * Esc fecha — e agora o foco também fica preso e volta para o botão.
   *
   * O Escape já estava aqui, num efeito próprio: era o único dos nove overlays
   * do app que o tinha. O que faltava era o resto, e o hook traz os quatro.
   *
   * O GATILHO PRECISA SER GUARDADO À MÃO, e este é o único lugar do app onde
   * isso é verdade: o botão flutuante é renderizado em `{!aberto && …}`, então
   * no instante em que o painel abre ele JÁ saiu do DOM e o `activeElement`
   * virou o `body`. Sem guardar antes, fechar devolveria o foco ao nada.
   */
  const gatilho = useRef<HTMLButtonElement | null>(null);
  const painel = useDialogo<HTMLElement>(aberto, () => setAberto(false), { gatilho });

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
      {!aberto && (
        <button
          ref={gatilho}
          type="button"
          onClick={() => setAberto(true)}
          className={CLASSE_DO_BOTAO_FLUTUANTE}
          aria-label="Abrir o assistente"
        >
          <MessagesSquare size={16} />
          <span className="hidden sm:inline">Assistente</span>
        </button>
      )}

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
              <ChatDaOperacao
                contexto={chat.contexto}
                produtos={chat.produtos}
                clienteId={clienteId}
                alturaCheia
                titulo={
                  chat.contexto?.produto
                    ? `Sobre ${chat.contexto.produto.nome}`
                    : "Sobre a sua loja"
                }
              />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
