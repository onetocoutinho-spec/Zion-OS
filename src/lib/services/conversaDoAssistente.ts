// A ponte entre a tela e o laço de conversa.
//
// Só transporta — como `assistenteDaOperacao`, e pelo mesmo motivo: quem
// decide é a rota (o modelo) e o domínio (as ferramentas).
//
// O histórico do MODELO vive no BANCO (`copilot_mensagens`), desde 2026-08-22:
// o navegador manda o `conversaId` e o servidor relê as falas que ele mesmo
// gravou. O que volta em `falas` é para a TELA desenhar — não é mais o que o
// modelo vai ler no turno seguinte, e por isso não viaja de volta.

import { cabecalhoAutenticacao } from "../supabase/sessao";
import type { Fala } from "../agentes/conversaComFerramentas";
import type { Proposta } from "../../modules/assistant/domain/propostaDeCorrecao";
import type { PropostaDeAnuncio } from "../../modules/assistant/domain/propostaDeAnuncio";
import type { CadastroNaTela } from "../../modules/assistant/domain/cartaoDoCadastro";
import type { PendenciasNaTela } from "../../modules/assistant/domain/cartaoDePendencias";
import type { HistoricoDeCampo } from "../../modules/catalog/domain/procedenciaDeCampo";
import type { Consequencia } from "../../modules/workspace/domain/consequencia";
import type {
  Preparacao,
  selecionarParaPreparar,
} from "../../modules/publication/domain/preparacaoDoAnuncio";
import type { PrecoNaTela, PropostaDePrecoNaTela } from "../../modules/assistant/domain/cartaoDePreco";
import type { TarefaProposta } from "../../modules/assistant/domain/propostaDeTarefas";
import type { PedidoDeImagem } from "../../modules/assistant/domain/propostaDeImagem";

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
  /**
   * O estado da preparação de anúncio — de um produto ou do catálogo.
   *
   * Do SERVIDOR. `estado`, `etapas` e a seleção do lote em especial: eles
   * decidem o que a tela oferece, e um estado escrito pelo modelo seria uma
   * oferta feita por quem não leu o banco.
   */
  preparacao?: {
    produto?: Preparacao;
    selecao?: ReturnType<typeof selecionarParaPreparar>;
  };
  /** O ensaio da publicação — o que subiria, para ela confirmar. */
  propostaDePublicacao?: {
    anuncioId: string;
    produtoId: string;
    nome: string;
    titulo: string;
    preco: number | null;
    estoque: number | null;
    fotos: number;
    categoria: string;
  };
  /** O id que AUTORIZA a publicação. Sem ele, sem botão: a proposta não foi persistida. */
  propostaDePublicacaoId?: string;
  /** A lista de tarefas a criar. Sem `propostaDeTarefasId`, sem botão. */
  propostaDeTarefas?: TarefaProposta[];
  propostaDeTarefasId?: string;
  /** O pedido de imagem a gerar. Sem `propostaDeImagemId`, sem botão. */
  propostaDeImagem?: PedidoDeImagem;
  propostaDeImagemId?: string;
  /**
   * Descrição ou palavras-chave, atual e proposta lado a lado.
   *
   * Sem `propostaDeTextoId` não há botão: proposta que não foi persistida não
   * pode ser confirmada, e oferecer o botão prometeria o que a rota recusaria.
   */
  propostaDeTexto?: {
    campo: "descricao" | "palavras_chave";
    nome: string;
    atual: string;
    proposto: string;
    justificativa: string;
  };
  propostaDeTextoId?: string;
  /** Título atual e proposto, lado a lado. Sem `propostaDeTituloId`, sem botão. */
  propostaDeTitulo?: {
    anuncioId: string;
    produtoId: string;
    nome: string;
    tituloAtual: string;
    tituloProposto: string;
    justificativa: string;
  };
  propostaDeTituloId?: string;
  /**
   * O preço — situação de um produto com cenários, ou a triagem do catálogo.
   *
   * Do SERVIDOR, calculado pelo motor financeiro. A tela ESCREVE os números;
   * ela não os produz, e o modelo também não.
   */
  pricing?: PrecoNaTela;
  /** A proposta de trocar o preço, com a decomposição que a justifica. */
  propostaDePreco?: PropostaDePrecoNaTela & { produtoId: string };
  propostaDePrecoId?: string;
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
/**
 * O que o navegador manda: PONTEIROS, não fatos.
 *
 * Era `falas` (o histórico do modelo inteiro, com resultados de ferramenta),
 * `contexto` (as contagens e o catálogo) e o NOME do produto aberto. O servidor
 * respondia a partir disso. Agora o histórico vem do banco, as contagens são
 * medidas lá com o tenant da sessão, e o produto aberto é um id que só vale se
 * for desta loja. (Auditoria do Copilot, 2026-08-22.)
 */
export interface PonteirosDaConversa {
  /**
   * Qual loja está sendo operada. Para o LOJISTA o servidor ignora (a loja é a
   * do perfil); para agência e equipe é obrigatório e conferido no banco.
   */
  lojaId: string;
  /** O id do produto aberto na tela, se houver. */
  produtoAbertoId?: string | null;
  /** A rota da tela, para a conversa nascer com contexto no banco. */
  rota?: string;
  /**
   * A conversa ATIVA desta aba, quando já existe (INC-005).
   *
   * Ausente no primeiro turno: o servidor cria e devolve o id em `fim`. Dali em
   * diante ele volta aqui, e os turnos param de virar uma conversa cada.
   *
   * Quem manda é o servidor: se este id for inexistente, malformado ou de outro
   * cliente, `garantirConversa` ignora e cria — e o `conversaId` da resposta é o
   * que vale.
   */
  conversaId?: string;
}

export async function conversar(
  mensagem: string,
  ponteiros: PonteirosDaConversa,
  aoVivo?: AoVivo,
  /** Para o botão "Parar": aborta o fetch, e o servidor percebe e para o laço. */
  signal?: AbortSignal
): Promise<RespostaDaConversa> {
  const resposta = await fetch("/api/assistente/conversa", {
    method: "POST",
    ...(signal ? { signal } : {}),
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({
      mensagem,
      lojaId: ponteiros.lojaId,
      ...(ponteiros.produtoAbertoId ? { produtoAbertoId: ponteiros.produtoAbertoId } : {}),
      ...(ponteiros.rota ? { rota: ponteiros.rota } : {}),
      ...(ponteiros.conversaId ? { conversaId: ponteiros.conversaId } : {}),
    }),
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
          ...(e.preparacao
            ? { preparacao: e.preparacao as RespostaDaConversa["preparacao"] }
            : {}),
          ...(e.propostaDePublicacao
            ? {
                propostaDePublicacao:
                  e.propostaDePublicacao as RespostaDaConversa["propostaDePublicacao"],
              }
            : {}),
          ...(e.propostaDeTexto
            ? { propostaDeTexto: e.propostaDeTexto as RespostaDaConversa["propostaDeTexto"] }
            : {}),
          ...(typeof e.propostaDeTextoId === "string"
            ? { propostaDeTextoId: e.propostaDeTextoId }
            : {}),
          ...(e.propostaDeTitulo
            ? { propostaDeTitulo: e.propostaDeTitulo as RespostaDaConversa["propostaDeTitulo"] }
            : {}),
          ...(typeof e.propostaDeTituloId === "string"
            ? { propostaDeTituloId: e.propostaDeTituloId }
            : {}),
          ...(typeof e.propostaDePublicacaoId === "string"
            ? { propostaDePublicacaoId: e.propostaDePublicacaoId }
            : {}),
          ...(Array.isArray(e.propostaDeTarefas) && typeof e.propostaDeTarefasId === "string"
            ? { propostaDeTarefas: e.propostaDeTarefas as TarefaProposta[], propostaDeTarefasId: e.propostaDeTarefasId }
            : {}),
          ...(e.propostaDeImagem && typeof e.propostaDeImagemId === "string"
            ? { propostaDeImagem: e.propostaDeImagem as PedidoDeImagem, propostaDeImagemId: e.propostaDeImagemId }
            : {}),
          ...(e.pricing ? { pricing: e.pricing as PrecoNaTela } : {}),
          ...(e.propostaDePreco
            ? { propostaDePreco: e.propostaDePreco as RespostaDaConversa["propostaDePreco"] }
            : {}),
          ...(typeof e.propostaDePrecoId === "string"
            ? { propostaDePrecoId: e.propostaDePrecoId }
            : {}),
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
  /**
   * O que esta operação comprovadamente causou — calculado pelo DOMÍNIO, no
   * servidor, sobre os registros que a proposta ofereceu.
   *
   * `null` quando não é demonstrável, e `null` é resultado válido. A tela NÃO
   * recalcula, não estima e não transforma `null` em zero: ela só apresenta.
   */
  consequencia?: Consequencia | null;
  /** Só na publicação: a palavra do Mercado Livre sobre o anúncio criado. */
  mlItemId?: string;
  permalink?: string | null;
  statusNoML?: string | null;
  /** Só na imagem: a versão gerada e a URL assinada (1 h) para mostrar. */
  versaoId?: string;
  imagemUrl?: string | null;
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
    // Atravessa como veio. Este arquivo só transporta — não deriva contagem,
    // não completa campo faltante e não troca `null` por zero.
    ...(dados.consequencia !== undefined ? { consequencia: dados.consequencia } : {}),
    ...(typeof dados.mlItemId === "string" ? { mlItemId: dados.mlItemId } : {}),
    ...(dados.permalink !== undefined ? { permalink: dados.permalink } : {}),
    ...(dados.statusNoML !== undefined ? { statusNoML: dados.statusNoML } : {}),
    ...(typeof dados.versaoId === "string" ? { versaoId: dados.versaoId } : {}),
    ...(dados.imagemUrl !== undefined ? { imagemUrl: dados.imagemUrl } : {}),
  };
}
