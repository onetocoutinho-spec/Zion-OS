"use client";

// O ASSISTENTE nas telas de quem opera VÁRIAS lojas.
//
// ===========================================================================
// POR QUE ISTO PRECISOU EXISTIR
// ===========================================================================
//
// Auditoria de 24/08/2026: o painel do Copilot estava montado em 100% das
// telas do portal do lojista e em NENHUMA das ~40 telas internas. A agência —
// que opera várias lojas e é quem mais precisa de "qual loja precisa da minha
// atenção?" — não tinha por onde perguntar, embora o servidor já suportasse o
// papel `agencia` e a ferramenta `comparar_lojas` já existisse só para ela.
//
// ===========================================================================
// A DECISÃO: SÓ COM LOJA ESCOLHIDA
// ===========================================================================
//
// Para o lojista a loja é implícita — ele É a loja. Para a agência não: o
// servidor recusa a conversa sem `lojaId` ("Escolha a loja que você está
// operando"), e essa recusa é deliberada, porque uma loja escolhida por
// padrão seria uma loja escolhida por ninguém.
//
// Então o botão só aparece quando há loja no seletor global. Mostrar um chat
// que responde 403 a toda pergunta seria pior que não mostrar chat nenhum — e
// esconder o botão é a forma honesta de dizer "escolha a loja primeiro", que é
// o que a própria casca já pede na tela.
//
// Com uma loja escolhida, as perguntas de agência continuam alcançáveis:
// `comparar_lojas` mede TODAS as lojas do alcance da conta, não a selecionada.

import { PainelDoAssistente } from "@/components/client-portal/PainelDoAssistente";
import { useLojaAtual } from "@/lib/contexto/LojaAtualProvider";

export function AssistenteDaAgencia() {
  const { lojaId } = useLojaAtual();
  if (!lojaId) return null;
  return <PainelDoAssistente lojaId={lojaId} />;
}
