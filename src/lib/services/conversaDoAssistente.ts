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
import type { CadastroNaTela } from "../../modules/assistant/domain/cartaoDoCadastro";
import type { PendenciasNaTela } from "../../modules/assistant/domain/cartaoDePendencias";
import type { HistoricoDeCampo } from "../../modules/catalog/domain/procedenciaDeCampo";

export interface RespostaDaConversa {
  texto: string;
  /** O histórico atualizado — devolve na próxima chamada para manter o fio. */
  falas: Fala[];
  /** As ferramentas que rodaram. Aparece na tela: é auditoria, não enfeite. */
  ferramentas: string[];
  tokens: number;
  /** Um cartão para confirmar. Nada foi gravado. */
  proposta?: Proposta;
  /**
   * O ID da proposta PERSISTIDA — é o que autoriza a execução.
   *
   * Sem ele não há botão: uma proposta que não chegou ao banco não pode ser
   * confirmada, porque a confirmação precisa referenciar um registro que o
   * servidor consiga carregar, conferir o tenant e revalidar contra o estado
   * atual. O objeto `proposta` acima serve só para DESENHAR o cartão.
   */
  propostaId?: string;
  /** O fio no banco. A tela devolve na próxima chamada. */
  conversaId?: string;
  /**
   * O escopo de um LOTE — contagens vindas do SERVIDOR.
   *
   * O cartão não pergunta ao modelo quantos serão alterados: ele lê daqui. Um
   * número que o modelo escreveu é um número que ele pode ter errado, e o que
   * está sendo aprovado é justamente a quantidade.
   */
  escopo?: {
    campo: "peso" | "custo";
    /** Unidade canônica da Proposal: gramas. A tela converte para exibir. */
    valor: number;
    resumo: string;
    produtosAfetados: number;
    variacoesAfetadas: number;
    naoAlterados: number;
    amostra: string[];
  };
  /** Um cartão para GERAR o anúncio. Nada foi gerado — leva minutos e cota. */
  propostaDeAnuncio?: PropostaDeAnuncio;
  /**
   * O cadastro em conversa — o que já se sabe, a grade, e o que falta.
   *
   * Tudo vem do SERVIDOR, do Draft persistido. O `status` e o `prontoParaCriar`
   * em especial: eles decidem se existe botão de criar, e um estado escrito pelo
   * modelo seria um botão oferecido por quem não leu o banco.
   */
  cadastro?: CadastroNaTela;
  /**
   * O painel de pendências — o plano inteiro, com os grupos.
   *
   * O modelo recebeu o RESUMO; a tela recebe os grupos. São os mesmos números:
   * os dois saem do mesmo plano, calculado no domínio. A tela não soma nada.
   */
  pendencias?: PendenciasNaTela;
  /** O histórico de um campo — a resposta de "de onde veio isso?". */
  procedencia?: HistoricoDeCampo;
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
          ...(typeof e.propostaId === "string" ? { propostaId: e.propostaId } : {}),
          ...(typeof e.conversaId === "string" ? { conversaId: e.conversaId } : {}),
          ...(e.escopo ? { escopo: e.escopo as RespostaDaConversa["escopo"] } : {}),
          ...(e.propostaDeAnuncio
            ? { propostaDeAnuncio: e.propostaDeAnuncio as PropostaDeAnuncio }
            : {}),
          ...(e.cadastro ? { cadastro: e.cadastro as CadastroNaTela } : {}),
          ...(e.pendencias ? { pendencias: e.pendencias as PendenciasNaTela } : {}),
          ...(e.procedencia ? { procedencia: e.procedencia as HistoricoDeCampo } : {}),
        };
      }
    }
  }

  if (erro) throw new Error(erro);
  if (!fim) throw new Error("A resposta foi interrompida no meio.");
  return fim;
}

/**
 * Confirma uma proposta — pelo ID, contra o servidor.
 *
 * A tela NÃO grava mais. Ela manda o id e o servidor faz o trabalho que só ele
 * pode fazer com confiança: carregar a proposta do banco, conferir o tenant
 * contra a sessão, revalidar as precondições contra o estado de agora, reservar
 * a execução de forma atômica e auditar o resultado.
 *
 * Antes disso, `executarProposta` gravava do navegador com um objeto que a
 * própria tela montou — e um objeto vindo do cliente pode ser qualquer coisa.
 */
export interface ResultadoDaConfirmacao {
  ok: boolean;
  mensagem: string;
  /** Verdadeiro quando a proposta já tinha sido executada (duplo clique). */
  jaFeito?: boolean;
  motivo?: string;
  afetados?: number;
  /** O produto que nasceu, quando a proposta era de cadastro. */
  produtoId?: string;
}

export async function confirmarProposta(propostaId: string): Promise<ResultadoDaConfirmacao> {
  const resposta = await fetch("/api/assistente/proposta", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ propostaId }),
  });
  const dados = (await resposta.json().catch(() => ({}))) as Partial<ResultadoDaConfirmacao> & {
    erro?: string;
  };
  return {
    ok: Boolean(dados.ok),
    mensagem: dados.mensagem ?? dados.erro ?? "Não consegui confirmar agora.",
    ...(dados.jaFeito ? { jaFeito: true } : {}),
    ...(dados.motivo ? { motivo: dados.motivo } : {}),
    ...(typeof dados.afetados === "number" ? { afetados: dados.afetados } : {}),
    ...(typeof dados.produtoId === "string" ? { produtoId: dados.produtoId } : {}),
  };
}
