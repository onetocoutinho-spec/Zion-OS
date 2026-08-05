// A ponte entre o chat e a rota de classificação.
//
// Só transporta. A classificação é do modelo (na rota, no servidor) e a
// resposta é do domínio (`assistant/domain/perguntaDaOperacao`, no cliente,
// contra o estado que a tela já carregou). Este arquivo não decide nada.

import { cabecalhoAutenticacao } from "../supabase/sessao";
import type { CriterioDaPergunta } from "../../modules/assistant/domain/perguntaDaOperacao";

export async function classificarPergunta(
  frase: string,
  produtoAberto?: string
): Promise<CriterioDaPergunta> {
  const resposta = await fetch("/api/assistente", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ frase, produtoAberto: produtoAberto ?? "" }),
  });
  // O `.catch` não é zelo excessivo: quando esta rota estoura o tempo, a
  // plataforma devolve uma PÁGINA HTML, e `.json()` sem guarda lançava
  // `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` direto na tela do
  // lojista. Erro de parser não é acionável por ninguém; "tente de novo" é.
  const dados = (await resposta.json().catch(() => ({}))) as {
    criterio?: CriterioDaPergunta;
    erro?: string;
  };
  if (!resposta.ok || !dados.criterio) {
    throw new Error(
      dados.erro ?? "Não consegui entender a pergunta agora. Tente de novo em instantes."
    );
  }
  return dados.criterio;
}
