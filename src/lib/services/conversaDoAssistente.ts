// A ponte entre a tela e o laço de conversa.
//
// Só transporta — como `assistenteDaOperacao`, e pelo mesmo motivo: quem
// decide é a rota (o modelo) e o domínio (as ferramentas). A diferença é que
// aqui vai e volta o HISTÓRICO, porque a conversa tem fio.
//
// O histórico vive na TELA, não no servidor. Um servidor com sessão de conversa
// precisaria de armazenamento, expiração e limpeza — e a primeira coisa que
// quebraria é o lojista abrir duas abas. Aqui cada tela tem o seu fio, e fechar
// a aba encerra a conversa, que é o que uma pessoa espera.

import { cabecalhoAutenticacao } from "../supabase/sessao";
import type { Fala } from "../agentes/conversaComFerramentas";
import type { ContextoDasFerramentas } from "../../modules/assistant/domain/executarFerramenta";
import type { Proposta } from "../../modules/assistant/domain/propostaDeCorrecao";

export interface RespostaDaConversa {
  texto: string;
  /** O histórico atualizado — devolve na próxima chamada para manter o fio. */
  falas: Fala[];
  /** As ferramentas que rodaram. Aparece na tela: é auditoria, não enfeite. */
  ferramentas: string[];
  tokens: number;
  /** Um cartão para confirmar. Nada foi gravado. */
  proposta?: Proposta;
}

export async function conversar(
  mensagem: string,
  falas: readonly Fala[],
  contexto: ContextoDasFerramentas,
  produtoAberto?: string
): Promise<RespostaDaConversa> {
  const resposta = await fetch("/api/assistente/conversa", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ mensagem, falas, contexto, produtoAberto: produtoAberto ?? "" }),
  });
  const dados = (await resposta.json()) as Partial<RespostaDaConversa> & { erro?: string };
  if (!resposta.ok || typeof dados.texto !== "string") {
    throw new Error(dados.erro ?? "Não consegui responder agora.");
  }
  return {
    texto: dados.texto,
    falas: dados.falas ?? [],
    ferramentas: dados.ferramentas ?? [],
    tokens: dados.tokens ?? 0,
    ...(dados.proposta ? { proposta: dados.proposta } : {}),
  };
}
