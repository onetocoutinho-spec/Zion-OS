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
import type { PropostaDeAnuncio } from "../../modules/assistant/domain/propostaDeAnuncio";

export interface RespostaDaConversa {
  texto: string;
  /** O histórico atualizado — devolve na próxima chamada para manter o fio. */
  falas: Fala[];
  /** As ferramentas que rodaram. Aparece na tela: é auditoria, não enfeite. */
  ferramentas: string[];
  tokens: number;
  /** Um cartão para confirmar. Nada foi gravado. */
  proposta?: Proposta;
  /** Um cartão para GERAR o anúncio. Nada foi gerado — leva minutos e cota. */
  propostaDeAnuncio?: PropostaDeAnuncio;
}

/** O que a tela recebe enquanto a resposta acontece. */
export interface AoVivo {
  /** Um pedaço de texto acabou de chegar. Some com o acumulado e redesenha. */
  aoTexto: (textoAcumulado: string) => void;
  /** Uma ferramenta começou a rodar. Aparece na tela no lugar do silêncio. */
  aoFerramenta: (nome: string) => void;
}

/**
 * Conversa, entregando a resposta enquanto ela chega.
 *
 * A promessa só resolve no fim — quem quiser o total espera; quem quiser o
 * texto aparecendo usa `aoVivo`. As duas coisas ao mesmo tempo evitam que a
 * tela tenha que remontar o estado final a partir dos pedaços.
 */
export async function conversar(
  mensagem: string,
  falas: readonly Fala[],
  contexto: ContextoDasFerramentas,
  produtoAberto?: string,
  aoVivo?: AoVivo
): Promise<RespostaDaConversa> {
  const resposta = await fetch("/api/assistente/conversa", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ mensagem, falas, contexto, produtoAberto: produtoAberto ?? "" }),
  });
  if (!resposta.ok || !resposta.body) {
    const erro = await resposta.json().catch(() => ({}));
    throw new Error((erro as { erro?: string }).erro ?? "Não consegui responder agora.");
  }

  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let sobra = "";
  let acumulado = "";
  let fim: RespostaDaConversa | null = null;
  let erro: string | null = null;

  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    // O corte da rede não respeita linha: a metade de um JSON fica em `sobra`
    // até o pedaço seguinte completá-la.
    sobra += decodificador.decode(value, { stream: true });
    const linhas = sobra.split("\n");
    sobra = linhas.pop() ?? "";
    for (const linha of linhas) {
      if (!linha.trim()) continue;
      let e: Record<string, unknown>;
      try {
        e = JSON.parse(linha);
      } catch {
        continue;
      }
      if (e.tipo === "texto" && typeof e.delta === "string") {
        acumulado += e.delta;
        aoVivo?.aoTexto(acumulado);
      } else if (e.tipo === "ferramenta" && typeof e.nome === "string") {
        aoVivo?.aoFerramenta(e.nome);
      } else if (e.tipo === "erro") {
        erro = typeof e.erro === "string" ? e.erro : "Não consegui responder agora.";
      } else if (e.tipo === "fim") {
        fim = {
          texto: typeof e.texto === "string" ? e.texto : acumulado,
          falas: (e.falas as Fala[]) ?? [],
          ferramentas: (e.ferramentas as string[]) ?? [],
          tokens: (e.tokens as number) ?? 0,
          ...(e.proposta ? { proposta: e.proposta as Proposta } : {}),
          ...(e.propostaDeAnuncio
            ? { propostaDeAnuncio: e.propostaDeAnuncio as PropostaDeAnuncio }
            : {}),
        };
      }
    }
  }

  if (erro) throw new Error(erro);
  if (!fim) throw new Error("A resposta foi interrompida no meio.");
  return fim;
}
