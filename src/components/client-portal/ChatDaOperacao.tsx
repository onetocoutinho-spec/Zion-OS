"use client";

/**
 * O chat da operação — perguntar em português sobre a própria loja.
 *
 * A divisão do trabalho é a que o EXP-004 mediu e o EXP-005 confirmou:
 *
 *   o modelo traduz a intenção · o código responde com o dado real
 *
 * A rota classifica a frase e devolve uma intenção. O domínio resolve essa
 * intenção contra o estado que ESTA tela já carregou do banco. Nenhum número
 * que aparece aqui passou pelo modelo — ele nunca viu contagem nenhuma.
 *
 * Por isso o chat pode dizer "não sei" sem constrangimento: a lista do que ele
 * sabe responder é fechada e vem do domínio, não de uma promessa de marketing.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Send,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Loader2,
  MessagesSquare,
  Paperclip,
} from "lucide-react";
import { classificarPergunta } from "@/lib/services/assistenteDaOperacao";
import { conversar, confirmarProposta } from "@/lib/services/conversaDoAssistente";
import { Markdown } from "@/components/client-portal/Markdown";
import type { PropostaDeAnuncio } from "@/modules/assistant/domain/propostaDeAnuncio";
import type { Fala } from "@/lib/agentes/conversaComFerramentas";
import type { RespostaDaConversa } from "@/lib/services/conversaDoAssistente";
import type { Consequencia } from "@/modules/workspace/domain/consequencia";
import { ofertasQueValem, rotuloDoDesbloqueio } from "@/modules/workspace/domain/consequencia";
import { desfechoPorVencimento } from "@/modules/assistant/domain/vencimentoNaTela";
import {
  desfechoDaConfirmacao,
  estadoDoCartao,
} from "@/modules/assistant/domain/cartaoDoLote";
import {
  desfechoDaCriacao,
  escreverGrade,
  estadoDoCartaoDeCadastro,
  type CadastroNaTela,
  type DesfechoDoCadastro,
} from "@/modules/assistant/domain/cartaoDoCadastro";
import {
  comoPedir,
  estadoDoPainel,
  selosDaProcedencia,
  type PendenciasNaTela,
} from "@/modules/assistant/domain/cartaoDePendencias";
import {
  escreverProcedencia,
  type HistoricoDeCampo,
} from "@/modules/catalog/domain/procedenciaDeCampo";
import {
  estadoDoCartaoDeTitulo,
  estadoDoPainelDePreparacao,
  tomDaEtapa,
  type PreparacaoNaTela,
  type TituloNaTela,
  type TextoNaTela,
  estadoDoCartaoDeTexto,
} from "@/modules/assistant/domain/cartaoDaPreparacao";
import {
  estadoDoCartaoDePreco,
  estadoDoPainelDePreco,
  type PrecoNaTela,
  type PropostaDePrecoNaTela,
} from "@/modules/assistant/domain/cartaoDePreco";

type EscopoNaTela = NonNullable<RespostaDaConversa["escopo"]>;
import {
  chaveDaConversa,
  chaveDoFio,
  lerGuardada,
  paraGuardar,
} from "@/modules/assistant/domain/conversaGuardada";
import {
  montarProposta,
  type Proposta,
  type ProdutoAlvo,
} from "@/modules/assistant/domain/propostaDeCorrecao";
import {
  responder,
  POSSO_RESPONDER,
  type ContextoDaPergunta,
  type CriterioDaPergunta,
  type RespostaDaOperacao,
} from "@/modules/assistant/domain/perguntaDaOperacao";
import {
  ehSaudacao,
  RESPOSTA_DA_SAUDACAO,
} from "@/modules/assistant/domain/saudacaoDaConversa";
import { formatBRLExato } from "@/lib/format";
import { importarPeso } from "@/lib/services/importacaoPeso";
import { useClientPortal } from "./context";
import { ConferirCatalogo } from "./ConferirCatalogo";
import { ConferirFoto, medirFoto, type FotoMedida } from "./ConferirFoto";
import { uploadImagemProduto, promoverImagemACapa } from "@/lib/services/storageImagens";
import { publicarNoML } from "@/lib/services/publicacaoML";
import { buscarAnuncioGerado as registroDeAnuncio } from "@/lib/services/anunciosGerados";
import { decodificarTexto } from "@/lib/textoDeArquivo";
import {
  analisarProdutosCsv,
  confirmarImportacaoProdutos,
  type AnaliseProdutos,
} from "@/lib/services/importacaoProdutos";
import { oQueEssaPlanilhaE } from "@/modules/catalog/domain/oQueEssaPlanilhaE";
import { lerPlanilha, type PlanilhaLida } from "@/lib/planilha";
import { ConferirPeso } from "./ConferirPeso";
import { ImportarCatalogoPdf } from "./ImportarCatalogoPdf";
import { ConferirPlanilha } from "@/components/client-portal/ConferirPlanilha";
import { importarCustos, type ResultadoCustos } from "@/lib/services/importacaoCustos";
import type { Mapeamento } from "@/modules/catalog/domain/mapeamentoPlanilha";

/**
 * O desfecho da importação de custos, dito por inteiro.
 *
 * As QUATRO contagens aparecem sempre, inclusive as zeradas. "42 produtos
 * atualizados" sozinho lê-se como sucesso completo; com "8 não encontrados" ao
 * lado, ela sabe que sobrou trabalho — e o número que falta é o que a faria
 * procurar.
 *
 * Os ambíguos vêm com NOME e com os custos que brigaram: recusar de propósito
 * só é honesto se a pessoa puder resolver.
 */
function ResultadoDaPlanilha({ r }: { r: ResultadoCustos }) {
  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
      <p className="text-zinc-200">
        Gravei o custo em <strong>{r.produtos}</strong> produto(s) e{" "}
        <strong>{r.variantes}</strong> variação(ões), de {r.linhasCsv} linha(s) na planilha.
      </p>
      {r.naoEncontrados > 0 && (
        <p className="text-amber-300">
          {r.naoEncontrados} linha(s) não casaram com nenhum produto — provavelmente o nome
          está diferente do que está aqui. Elas não foram gravadas.
        </p>
      )}
      {r.ambiguos > 0 && (
        <div className="text-amber-300">
          <p>
            {r.ambiguos} produto(s) ficaram de fora porque a planilha trouxe custos
            DIFERENTES para eles. Gravar qualquer um seria chutar:
          </p>
          <ul className="mt-1 list-inside list-disc text-xs text-zinc-400">
            {r.detalhesAmbiguos.slice(0, 5).map((a) => (
              <li key={a.produtoId}>
                {a.produto} — {a.candidatos.map((c) => formatBRLExato(c.custo)).join(" · ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.aviso && <p className="text-xs text-zinc-500">{r.aviso}</p>}
    </div>
  );
}

/** Um turno da conversa. A pergunta é do operador; a resposta é do domínio. */
interface Turno {
  pergunta: string;
  /**
   * A planilha que ela largou no chat, ainda NÃO importada.
   *
   * Mora no turno pelo mesmo motivo que a `proposta`: a confirmação pertence
   * ao turno. Se ela perguntar outra coisa antes de confirmar, a conferência
   * continua no lugar dela em vez de um botão "Importar" flutuando apontando
   * para um arquivo que saiu de vista.
   *
   * NÃO atravessa o recarregamento — `paraGuardar` copia campos nomeados e
   * este não está lá. É o certo: um arquivo que a pessoa não confirmou não
   * deve reaparecer autorizado depois de um F5.
   */
  planilha?: PlanilhaLida;
  /** O que o roteador decidiu que ela é. Decide qual conferência a tela mostra. */
  especie?: "custo" | "peso" | "catalogo";
  /** Um PDF de catálogo do fornecedor largado no clipe. Outro caminho inteiro. */
  pdf?: File;
  /** A análise do catálogo em planilha — a única importação que CRIA. */
  catalogo?: AnaliseProdutos;
  /** Uma foto largada no clipe, já medida — o veredicto vem antes de subir. */
  foto?: { arquivo: File; medida: FotoMedida };
  /** O que a importação fez. Presente = já gravou, e a conferência sai. */
  custosImportados?: ResultadoCustos;
  importandoPlanilha?: boolean;
  /** O que o modelo entendeu. Mostrado em cinza — é auditoria, não resposta. */
  interpretacao?: string;
  resposta?: RespostaDaOperacao;
  /**
   * Uma mudança PROPOSTA, ainda não executada.
   *
   * Fica aqui e não numa variável de estado solta porque a confirmação
   * pertence ao turno: se a pessoa perguntar outra coisa antes de confirmar, a
   * proposta antiga continua visível no seu lugar, em vez de o botão "Gravar"
   * flutuar na tela apontando para algo que já saiu de vista.
   */
  proposta?: Proposta;
  /**
   * O ID da proposta PERSISTIDA. Sem ele não existe botão.
   *
   * O objeto `proposta` acima desenha o cartão; este id é o que AUTORIZA. Uma
   * proposta que não chegou ao banco não pode ser confirmada — e mostrar botão
   * para ela seria oferecer uma ação que o servidor vai recusar.
   */
  propostaId?: string;
  /**
   * Quando a RESPOSTA chegou ao navegador. Existe só para o vencimento na tela
   * (INC-006). Não atravessa o recarregamento — `paraGuardar` não o copia — e
   * não precisa: a proposta também não atravessa, então um turno retomado do
   * disco não tem botão. Presente apenas quando o turno trouxe autorização.
   */
  chegouEm?: number;
  /**
   * O escopo de um LOTE. Presente só quando a proposta atinge vários alvos.
   *
   * As contagens vêm do SERVIDOR, nunca do modelo: o que está sendo aprovado é
   * justamente a quantidade, e um número que o modelo escreveu é um número que
   * ele pode ter errado.
   */
  escopo?: EscopoNaTela;
  /**
   * O que aconteceu depois de confirmar. Trava o cartão contra duplo clique.
   *
   * `cegoParaAIL` é opcional porque um turno RETOMADO do disco não sabe — e
   * `false` ali seria uma afirmação falsa sobre uma gravação que a AIL pode
   * muito bem não ter visto.
   */
  desfecho?: {
    ok: boolean;
    mensagem: string;
    cegoParaAIL?: boolean;
    /** O servidor recusou porque o catálogo mudou. Nada foi criado. */
    stale?: boolean;
    /** O produto que nasceu, quando a proposta era de cadastro. */
    produtoId?: string;
    /**
     * O que a operação comprovadamente causou. Vem PRONTO do servidor.
     *
     * A tela não recalcula, não consulta produto, não deriva contagem e não
     * transforma `null` em zero. Se vier `null`, não há cartão de consequência —
     * e isso é um resultado, não uma lacuna a preencher.
     */
    consequencia?: Consequencia | null;
  };
  /**
   * O cadastro em conversa — estado do Draft PERSISTIDO, vindo do servidor.
   *
   * Fica no turno como a proposta: se a pessoa perguntar outra coisa antes de
   * confirmar, o cartão continua no lugar dele em vez de flutuar apontando para
   * um cadastro que já saiu de vista.
   */
  cadastro?: CadastroNaTela;
  /**
   * O painel de pendências — o plano inteiro, vindo do domínio.
   *
   * Fica no turno como os outros cartões: se a pessoa perguntar outra coisa, o
   * painel continua no lugar dele em vez de flutuar apontando para uma análise
   * que já saiu de vista.
   */
  pendencias?: PendenciasNaTela;
  /** A resposta de "de onde veio isso?" — com origem desconhecida quando é. */
  procedencia?: HistoricoDeCampo;
  /** O estado da preparação de anúncio — de um produto ou do catálogo. */
  preparacao?: PreparacaoNaTela;
  /** Título atual e proposto, lado a lado. */
  /** O ensaio da publicação. Sem `anuncioId` não há o que publicar. */
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
  /** Já publicou? Impede o segundo clique antes de a rota precisar recusar. */
  publicando?: boolean;
  propostaDeTexto?: TextoNaTela;
  /** Sem ele, não há botão: proposta não persistida não pode ser confirmada. */
  propostaDeTextoId?: string;
  propostaDeTitulo?: TituloNaTela;
  /** O id que AUTORIZA a troca do título. Sem ele, não há botão. */
  propostaDeTituloId?: string;
  /** Preço, margem e lucro — do motor financeiro, nunca do modelo. */
  pricing?: PrecoNaTela;
  /** A proposta de trocar o preço, com o detalhamento que a justifica. */
  propostaDePreco?: PropostaDePrecoNaTela;
  /** O id que AUTORIZA a troca do preço. Sem ele, não há botão. */
  propostaDePrecoId?: string;
  /**
   * Uma proposta de GERAR ANÚNCIO, ainda não disparada.
   *
   * Separada da de gravação porque o botão faz outra coisa: em vez de escrever
   * um campo, leva para a esteira e a dispara. São dois verbos diferentes e
   * dois riscos diferentes — misturá-los num cartão só faria um deles mentir.
   */
  propostaDeAnuncio?: PropostaDeAnuncio;
  /** No modo conversa: a fala do assistente, escrita por ele. */
  texto?: string;
  /**
   * Quais ferramentas rodaram para produzir esta resposta.
   *
   * Fica visível de propósito. É a única forma de quem lê saber se um número
   * veio do banco ou de lugar nenhum — e num chat que conversa livre, essa
   * distinção não se enxerga pela forma da frase.
   */
  ferramentas?: readonly string[];
  erro?: string;
}

/**
 * Sugestões de partida.
 *
 * Uma caixa de texto vazia com "pergunte alguma coisa" transfere para quem
 * pergunta o trabalho de adivinhar o vocabulário. Estas três são clicáveis e
 * cobrem os três formatos de resposta — número, passo e lista.
 */
const SUGESTOES_LOJA = [
  "O que eu resolvo primeiro?",
  "Quantos produtos estão sem custo?",
  "Por que não consigo precificar?",
];

const SUGESTOES_PRODUTO = [
  "O que falta neste produto?",
  "Por que ele não pode ser anunciado?",
  "Quantos produtos estão sem peso?",
];

export function ChatDaOperacao({
  contexto,
  produtos = [],
  clienteId,
  titulo = "Pergunte sobre a sua loja",
  alturaCheia = false,
  aoGravar,
}: {
  /**
   * `null` enquanto os dados carregam — e o chat NÃO some por isso.
   *
   * Ele já sumiu: a tela montava com `{contexto && <ChatDaOperacao/>}`, e
   * bastava uma das quatro consultas recarregar para o contexto ficar nulo por
   * um instante, o React destruir o componente e a conversa inteira ir junto —
   * no meio de uma resposta. Aceitar `null` aqui é o que mantém o componente
   * vivo; ele só desabilita a entrada enquanto não sabe os números.
   */
  contexto: ContextoDaPergunta | null;
  /** O catálogo, para o código resolver de QUAL produto a frase fala. */
  produtos?: readonly ProdutoAlvo[];
  clienteId: string;
  titulo?: string;
  /**
   * No painel e na página: ocupa a altura toda e a conversa rola dentro dela.
   *
   * Embutido numa página, o chat precisa de teto (`max-h-96`) para não empurrar
   * o resto. Num painel dedicado, esse mesmo teto é o que faz a resposta rolar
   * numa janelinha com espaço vazio embaixo.
   */
  alturaCheia?: boolean;
  /** Chamado depois de uma gravação, para a tela recarregar o que mudou. */
  aoGravar?: () => void;
}) {
  const { nome: nomeDoPortal } = useClientPortal();
  const [frase, setFrase] = useState("");
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [ocupado, setOcupado] = useState(false);
  /**
   * Relógio SÓ para o vencimento do cartão (INC-006).
   *
   * Ele não decide nada: o servidor continua carregando a proposta do banco e
   * recusando com 409 se passou. Existe porque sem tique o cartão vencido só
   * se atualizaria no próximo render — e o próximo render costuma ser o clique.
   */
  const [agora, setAgora] = useState(() => Date.now());
  /**
   * Modo conversa: o laço com ferramentas, que guarda o fio e conduz.
   *
   * Fica DESLIGADO por padrão porque custa várias vezes mais que a rota de
   * intenção, e a maioria das perguntas é uma só — "quantos sem custo?" não
   * precisa de fio.
   *
   * O NÚMERO DEIXOU DE SER ESCRITO AQUI, e o motivo é o defeito que a AUD-001
   * caçou o dia inteiro: o custo estava documentado em DOIS lugares com valores
   * diferentes ("~2.600 tokens" neste arquivo, "~1.800" na rota), e nenhum dos
   * dois era conferível. Duas fontes para o mesmo fato é a forma exata do erro.
   *
   * O provedor já devolve `usageMetadata.totalTokenCount` a cada turno e nós
   * jogávamos fora. Agora ele é somado e MOSTRADO — o custo do modo conversa
   * passa a ser medido nesta conta, nesta conversa, em vez de afirmado.
   *
   * Os dois vivem lado a lado de propósito. Trocar um pelo outro deixaria a
   * operação sem base de comparação e sem saída se o custo doer.
   */
  const [conversando, setConversando] = useState(false);
  /** Tokens gastos no fio atual — medidos, não estimados. Zera ao trocar de modo. */
  const [tokensDoFio, setTokensDoFio] = useState(0);
  /** O fio. Vive aqui, não no servidor: fechar a aba encerra a conversa. */
  const [falas, setFalas] = useState<readonly Fala[]>([]);
  /**
   * A CONVERSA ATIVA no banco — a identidade que agrupa os turnos (INC-005).
   *
   * Não é o histórico: `turnos` e `falas` vivem no `localStorage` e sobrevivem
   * ao fechar a aba; este id vive no `sessionStorage` e morre com ela. Reabrir
   * restaura a conversa na tela e começa uma conversa nova no banco — é o
   * contrato, não um defeito.
   *
   * Antes disto o id era devolvido pelo servidor a cada turno e descartado
   * aqui, e cada requisição virava uma linha em `copilot_conversas`.
   */
  const [conversaId, setConversaId] = useState<string | null>(null);
  const fimDaLista = useRef<HTMLDivElement>(null);

  /** O servidor é a autoridade sobre o id: o que ele devolve é o que vale. */
  const guardarFio = useCallback(
    (id: string) => {
      setConversaId(id);
      try {
        sessionStorage.setItem(chaveDoFio(clienteId), id);
      } catch {
        // sem sessionStorage o id continua em memória: sobrevive ao turno
        // seguinte, não ao reload. Degradar assim é melhor que não conversar.
      }
    },
    [clienteId]
  );

  /** Encerra a conversa ativa. O histórico na tela não é afetado. */
  const esquecerFio = useCallback(() => {
    setConversaId(null);
    try {
      sessionStorage.removeItem(chaveDoFio(clienteId));
    } catch {
      // idem
    }
  }, [clienteId]);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turnos]);

  // O tique só roda enquanto existe cartão vivo — turno com autorização e sem
  // desfecho. Sem isso seria um re-render de meio em meio minuto para sempre,
  // numa tela que passa a maior parte do tempo sem nada a expirar.
  /**
   * O desfecho que o cartão deve mostrar: o REAL, se já houve; senão o de
   * vencimento, se a validade passou.
   *
   * Nesta ordem, e não na inversa: um cartão já confirmado mostra o que
   * aconteceu, não que venceu. O vencimento só fala quando nada aconteceu.
   */
  const desfechoNaTela = (t: Turno, quando: number): Turno["desfecho"] =>
    t.desfecho ?? desfechoPorVencimento(t.chegouEm, quando);

  const temCartaoVivo = turnos.some((t) => t.chegouEm !== undefined && !t.desfecho);
  useEffect(() => {
    if (!temCartaoVivo) return;
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [temCartaoVivo]);

  /**
   * Retoma a conversa guardada — uma vez, na montagem.
   *
   * `retomou` existe porque sem ele um recarregamento das consultas
   * reescreveria os turnos por cima do que a pessoa acabou de dizer. É a mesma
   * trava da retomada de produto na esteira, pelo mesmo motivo.
   */
  const [retomou, setRetomou] = useState(false);
  useEffect(() => {
    if (retomou) return;
    setRetomou(true);
    // A identidade da aba é lida ANTES e SEPARADO do histórico: ela existe
    // mesmo sem turnos guardados (aba recarregada no meio da primeira
    // pergunta), e o histórico existe sem ela (aba nova, cache antigo).
    try {
      const id = sessionStorage.getItem(chaveDoFio(clienteId));
      if (id) setConversaId(id);
    } catch {
      // storage indisponível: a aba começa sem identidade e o primeiro turno
      // cria uma conversa nova.
    }
    try {
      const g = lerGuardada(localStorage.getItem(chaveDaConversa(clienteId)));
      if (!g || g.turnos.length === 0) return;
      // `resposta` volta do disco como `unknown` — o formato é do domínio do
      // assistente e `conversaGuardada` só o transporta. A asserção fica AQUI,
      // na borda de leitura, e não no módulo de armazenamento: validar lá
      // duplicaria o contrato em dois lugares, que é o defeito do dia.
      setTurnos(
        g.turnos.map((t) => ({
          ...t,
          resposta: t.resposta as RespostaDaOperacao | undefined,
        }))
      );
      setFalas(g.falas as Fala[]);
    } catch {
      // storage indisponível (aba anônima, cota): a conversa começa do zero
    }
  }, [retomou, clienteId]);

  // Grava a cada mudança. A PROPOSTA não atravessa — ver `conversaGuardada`.
  useEffect(() => {
    if (!retomou || turnos.length === 0) return;
    try {
      localStorage.setItem(
        chaveDaConversa(clienteId),
        JSON.stringify(paraGuardar(turnos, falas))
      );
    } catch {
      // cota estourada: a conversa continua na tela, só não sobrevive ao F5
    }
  }, [turnos, falas, clienteId, retomou]);

  const perguntar = useCallback(
    async (texto: string) => {
      const pergunta = texto.trim();
      // Sem contexto não há resposta honesta: responder com zeros seria pior
      // que esperar meio segundo.
      if (!pergunta || ocupado || !contexto) return;
      setFrase("");
      setOcupado(true);
      setTurnos((t) => [...t, { pergunta }]);
      try {
        // O caminho de conversa vira FUNÇÃO porque agora tem dois chamadores: o
        // modo explícito e a escalada automática de uma pergunta que a rota
        // barata não entendeu.
        const responderConversando = async (pergunta: string) => {
          // O texto e o rastro de ferramenta chegam ao vivo, no lugar do
          // "Lendo os seus dados…" parado. Com ferramentas, uma resposta leva
          // de 2 a 8 segundos — tempo demais para uma tela muda.
          const aoVivo = {
            aoTexto: (acumulado: string) =>
              setTurnos((t) =>
                t.map((turno, i) => (i === t.length - 1 ? { ...turno, texto: acumulado } : turno))
              ),
            aoFerramenta: (nomeDaFerramenta: string) =>
              setTurnos((t) =>
                t.map((turno, i) =>
                  i === t.length - 1
                    ? { ...turno, ferramentas: [...(turno.ferramentas ?? []), nomeDaFerramenta] }
                    : turno
                )
              ),
          };
          const r = await conversar(
            pergunta,
            falas,
            { pergunta: contexto, produtos, produtoAberto: contexto.produto ?? null },
            contexto.produto?.nome,
            aoVivo,
            conversaId ?? undefined
          );
          // O id do SERVIDOR é a autoridade. Se o que mandamos não existia, era
          // malformado ou de outro cliente, `garantirConversa` criou outro — e é
          // esse que vale daqui em diante.
          if (r.conversaId) guardarFio(r.conversaId);
          // O custo REAL do turno, do provedor. Somado no fio porque é o fio
          // que a lojista paga — um turno isolado não diz o que a conversa custa.
          if (typeof r.tokens === "number") setTokensDoFio((t) => t + r.tokens);
          setFalas(r.falas);
          setTurnos((t) =>
            t.map((turno, i) =>
              i === t.length - 1
                ? {
                    ...turno,
                    texto: r.texto,
                    ferramentas: r.ferramentas,
                    // Carimbo de chegada — só quando veio autorização. É o que
                    // faz o cartão parar de oferecer o botão depois da validade
                    // (INC-006). Mesmo conjunto de ids que `confirmar` resolve.
                    ...(r.propostaId ||
                    r.propostaDePrecoId ||
                    r.propostaDeTituloId ||
                    r.propostaDeTextoId ||
                    // O ENSAIO TAMBÉM VENCE, e aqui vencer importa MAIS: ele
                    // mostra preço e estoque, e publicar um ensaio velho põe no
                    // ar um preço que já não é o dela.
                    r.propostaDePublicacao ||
                    r.cadastro?.propostaId
                      ? { chegouEm: Date.now() }
                      : {}),
                    ...(r.proposta && r.propostaId
                      ? { proposta: r.proposta, propostaId: r.propostaId }
                      : {}),
                    ...(r.escopo && r.propostaId
                      ? { escopo: r.escopo, propostaId: r.propostaId }
                      : {}),
                    ...(r.propostaDeAnuncio
                      ? { propostaDeAnuncio: r.propostaDeAnuncio }
                      : {}),
                    // O cadastro traz o próprio `propostaId` quando há
                    // autorização montada. Ele NÃO passa pelo campo genérico:
                    // os dois cartões oferecem verbos diferentes, e um id só
                    // faria o botão errado aparecer.
                    ...(r.cadastro ? { cadastro: r.cadastro } : {}),
                    ...(r.pendencias ? { pendencias: r.pendencias } : {}),
                    ...(r.procedencia ? { procedencia: r.procedencia } : {}),
                    ...(r.preparacao ? { preparacao: r.preparacao } : {}),
                    ...(r.propostaDePublicacao
                      ? { propostaDePublicacao: r.propostaDePublicacao }
                      : {}),
                    ...(r.propostaDeTexto
                      ? {
                          propostaDeTexto: r.propostaDeTexto,
                          propostaDeTextoId: r.propostaDeTextoId,
                        }
                      : {}),
                    ...(r.propostaDeTitulo
                      ? {
                          propostaDeTitulo: r.propostaDeTitulo,
                          propostaDeTituloId: r.propostaDeTituloId,
                        }
                      : {}),
                    ...(r.pricing ? { pricing: r.pricing } : {}),
                    ...(r.propostaDePreco
                      ? {
                          propostaDePreco: r.propostaDePreco,
                          propostaDePrecoId: r.propostaDePrecoId,
                        }
                      : {}),
                  }
                : turno
            )
          );
        };

        if (conversando) {
          await responderConversando(pergunta);
          return;
        }

        // CUMPRIMENTO NÃO É PERGUNTA, e não vale uma chamada de rede.
        //
        // "Olá" caía em `fora_do_alcance` e recebia "Não entendi a sua
        // pergunta" — na PRIMEIRA frase que a lojista escreve. Ver
        // `saudacaoDaConversa`: a decisão é da frase inteira, então "bom dia,
        // quantos estão sem peso?" continua sendo a pergunta, não o "bom dia".
        if (ehSaudacao(pergunta)) {
          setTurnos((t) =>
            t.map((turno, i) =>
              i === t.length - 1
                ? {
                    ...turno,
                    resposta: {
                      tipo: "saudacao",
                      frase: RESPOSTA_DA_SAUDACAO,
                      posso: POSSO_RESPONDER,
                    },
                  }
                : turno
            )
          );
          return;
        }

        // ===================================================================
        // A VIA RÁPIDA CAINDO NÃO É MOTIVO PARA A LOJISTA FICAR SEM RESPOSTA
        // ===================================================================
        //
        // A rota `/api/assistente` classifica com Gemini Flash. Quando o
        // provedor falha ela devolve 502 com "Não consegui entender agora.
        // Tente de novo em instantes" — e a rota está certa: registra a causa
        // no log e não vaza configuração do servidor para a tela.
        //
        // O que estava errado era o CLIENTE tratar isso como fim de linha.
        // Medido em produção em 11/08/2026: a pergunta voltou 502, a lojista
        // leu a desculpa, e a repetição idêntica funcionou — sintoma clássico
        // de falha transitória do provedor.
        //
        // O fio roda em OUTRO provedor (Anthropic) e tem as 22 ferramentas.
        // Enquanto ele responde, a via rápida cair é um detalhe de custo, não
        // uma parede. As três portas de escalada já existiam para "não
        // entendi" e "não sei"; esta é a quarta, para "não consegui perguntar".
        //
        // Se o fio TAMBÉM falhar, o erro dele sobe normalmente pelo catch de
        // baixo — dois provedores fora do ar é uma parede de verdade, e aí a
        // desculpa é honesta.
        let criterio: CriterioDaPergunta;
        try {
          criterio = await classificarPergunta(pergunta, contexto.produto?.nome);
        } catch (falhaDaViaRapida) {
          console.error("[chat] via rápida indisponível, escalando:", falhaDaViaRapida);
          await responderConversando(pergunta);
          return;
        }

        // ESCALADA AUTOMÁTICA — o interruptor vira roteamento.
        //
        // O classificador já dizia `entendeu: false` quando a pergunta não cabe
        // na lista fechada de assuntos, e ninguém usava esse sinal: a rota
        // barata devolvia "não sei" e a conversa ficava atrás de um botão que a
        // lojista tinha que descobrir.
        //
        // Pedir a ela que escolha entre "barato e limitado" e "caro e capaz" é
        // transferir uma decisão do SISTEMA para quem não tem como tomá-la —
        // ela não sabe de antemão qual pergunta precisa de fio.
        //
        // E a escolha estava invertida: medido em 03/08/2026, o caminho CARO
        // foi o honesto ("não tenho como saber") e o barato respondeu outra
        // coisa afirmando ter entendido.
        //
        // Agora o barato é a via rápida, não o teto: resolve o caso comum
        // (39/39 na extração de intenção, EXP-004) e, quando não entende,
        // repassa em vez de inventar. O custo continua baixo porque a maioria
        // das perguntas não escala — e o contador de tokens do fio mostra
        // quando escala.
        if (!criterio.entendeu) {
          await responderConversando(pergunta);
          return;
        }
        // Ditar um valor não é perguntar. Vira PROPOSTA — nada é gravado até
        // alguém ler o cartão e clicar. Ver `propostaDeCorrecao`.
        const encerra =
          criterio.intencao === "preencher"
            ? {
                proposta: montarProposta(
                  criterio,
                  produtos,
                  contexto.produto
                    ? { id: contexto.produto.id, nome: contexto.produto.nome }
                    : null
                ),
              }
            : // A resposta é montada AQUI, contra o estado real. O que voltou do
              // servidor foi só a intenção.
              { resposta: responder(criterio, contexto) };

        // ===================================================================
        // A SEGUNDA PORTA DA ESCALADA: entendeu, mas não sei responder
        // ===================================================================
        //
        // A escalada acima cobre `!entendeu` — a frase que não cabe em assunto
        // nenhum. Ela NÃO cobre o caso oposto e mais comum: o modelo entendeu
        // perfeitamente, escreveu a interpretação, e a lista fechada não tinha
        // balde.
        //
        // Medido em 10/08/2026, em produção: "quanto sai de mim em cada venda?"
        // voltou com a interpretação correta ("você quer saber quanto sai do
        // seu bolso") seguida da lista "o que eu consigo responder". A
        // ferramenta `meus_custos` existia e respondia essa pergunta — atrás de
        // um botão desligado que a lojista não tem como saber que existe.
        //
        // É estrutural, não um caso: `nao_sei` nasce em QUATRO lugares (intenção
        // fora da lista, produto não aberto, assunto desconhecido, capacidade
        // desconhecida), e o caminho do fio resolve os quatro — inclusive "não
        // há produto aberto", porque lá existe `achar_produto`.
        //
        // Toda capacidade nova cai aqui. A lista fechada responde seis coisas;
        // o fio tem dezoito ferramentas. Sem esta porta, cada ferramenta nova
        // nasce inalcançável pelo caminho padrão.
        //
        // O CUSTO: uma classificação desperdiçada — Gemini Flash, teto de 400
        // tokens. É o preço de a lojista nunca ver a parede, e ele não cresce:
        // a maioria das perguntas continua sendo resolvida pela via rápida.
        if ("resposta" in encerra && encerra.resposta?.tipo === "nao_sei") {
          await responderConversando(pergunta);
          return;
        }

        // ===================================================================
        // A TERCEIRA PORTA: entendi o valor, mas quem autoriza é o servidor
        // ===================================================================
        //
        // `montarProposta` roda AQUI, no navegador, e por isso não pode gravar
        // nada: uma proposta sem autorização persistida é só um texto bonito.
        // Desde 29/07 o cartão de `pronta` exige `propostaId` para existir — e
        // está certo, é a primitiva que impede o clique de virar escrita sem
        // passar pelo servidor.
        //
        // O que faltou foi ALGUÉM criar esse id no caminho barato. Resultado
        // medido em produção em 11/08/2026, três vezes seguidas: a lojista diz
        // "o custo do Chinelo Havaianas Top Liso e 28,40", o classificador
        // acerta tudo (`preencher` / `custo` / `28,40` / termos do alvo), o
        // domínio monta a proposta certa — e a tela fica MUDA. Treze dias
        // assim, na única frase que a lojista escreve sozinha sem ser
        // perguntada.
        //
        // O fio resolve porque lá a proposta nasce no servidor: `propor_gravacao`
        // persiste, revalida a precondição e devolve o id. Custa uma chamada a
        // mais; ditar um custo é raro e gravar errado é caro.
        if ("proposta" in encerra && encerra.proposta?.tipo === "pronta") {
          await responderConversando(pergunta);
          return;
        }

        setTurnos((t) =>
          t.map((turno, i) =>
            i === t.length - 1
              ? { ...turno, ...encerra, interpretacao: criterio.interpretacao }
              : turno
          )
        );
      } catch (e) {
        const erro = e instanceof Error ? e.message : "Não consegui responder agora.";
        setTurnos((t) => t.map((turno, i) => (i === t.length - 1 ? { ...turno, erro } : turno)));
      } finally {
        setOcupado(false);
      }
    },
    [contexto, ocupado, produtos, conversando, falas, conversaId, guardarFio]
  );

  /**
   * Grava — só a partir de uma proposta que já está na tela.
   *
   * O índice do turno é o que amarra o cartão à gravação: `executarProposta`
   * recebe o objeto que a pessoa leu, não campos remontados a partir da frase.
   */
  const confirmar = useCallback(
    async (indice: number) => {
      const alvo = turnos[indice];
      // O cadastro carrega o próprio id: os dois cartões podem coexistir num
      // turno, e confundir os dois confirmaria a proposta errada.
      // A LISTA É NOMINAL, e por isso é armadilha: um cartão novo cujo id não
      // entre aqui renderiza o botão e o clique não faz NADA — sem erro, sem
      // requisição, sem pista. Foi o que aconteceu com `propostaDeTextoId` em
      // 10/08/2026, e a sentinela `todoCartaoConfirma` guarda a lista agora.
      const id =
        alvo?.cadastro?.propostaId ??
        alvo?.propostaDeTituloId ??
        alvo?.propostaDeTextoId ??
        alvo?.propostaDePrecoId ??
        alvo?.propostaId;
      const ehCadastro = Boolean(alvo?.cadastro?.propostaId);
      // Sem ID persistido não há o que confirmar. A checagem repete a do
      // render de propósito: um clique que escapou (teclado, corrida de
      // estado) não pode virar uma chamada sem autorização.
      // `Date.now()` e não o `agora` do relógio: um clique disparado logo depois
      // do último tique não pode passar por válido. E a chamada direta, em vez
      // de `desfechoNaTela`, mantém este callback estável entre renders.
      if (!id || alvo.desfecho || desfechoPorVencimento(alvo.chegouEm, Date.now()) || ocupado) {
        return;
      }
      setOcupado(true);
      try {
        // O SERVIDOR decide. Ele carrega a proposta do banco, confere o tenant
        // contra a sessão, revalida as precondições contra o estado de agora,
        // reserva a execução de forma atômica e audita. A tela só mostra.
        const r = await confirmarProposta(id);
        setTurnos((t) =>
          t.map((turno, i) =>
            i === indice
              ? {
                  ...turno,
                  desfecho: {
                    ...(ehCadastro ? desfechoDaCriacao(r) : desfechoDaConfirmacao(r)),
                    // Atravessa como veio do servidor. Nada é derivado aqui.
                    ...(r.consequencia !== undefined ? { consequencia: r.consequencia } : {}),
                  },
                }
              : turno
          )
        );
        if (r.ok) aoGravar?.();
      } catch (e) {
        const erro = e instanceof Error ? e.message : "Não consegui confirmar.";
        setTurnos((t) =>
          t.map((turno, i) =>
            i === indice ? { ...turno, desfecho: { ok: false, mensagem: erro } } : turno
          )
        );
      } finally {
        setOcupado(false);
      }
    },
    [turnos, ocupado, aoGravar]
  );

  /** Descarta a proposta sem gravar. O turno some da lista de pendentes. */
  const descartar = useCallback((indice: number) => {
    setTurnos((t) =>
      t.map((turno, i) =>
        i === indice
          ? { ...turno, desfecho: { ok: false, mensagem: "Descartado. Nada foi gravado.", cegoParaAIL: false } }
          : turno
      )
    );
  }, []);

  /**
   * A planilha chegou. O QUE ACONTECE AQUI É DETERMINÍSTICO, e é de propósito.
   *
   * `lerPlanilha` e `sugerirMapeamento` são funções puras e testadas. Mandar os
   * cabeçalhos para o modelo adivinhar a coluna de custo trocaria uma regra
   * conferível por um palpite — e o mapeamento decide para onde vai dinheiro.
   * Numa planilha real, a versão que adivinhava gravou 87 "custos" que eram
   * referências de modelo, um deles de R$ 30.277.872,00.
   *
   * O chat é a porta; quem entende a planilha continua sendo o domínio.
   */
  async function receberPlanilha(arquivo: File) {
    // ===================================================================
    // PDF NÃO É PLANILHA, E O CAMINHO É OUTRO INTEIRO
    // ===================================================================
    //
    // Planilha se lê no navegador, de graça, e o mapeamento é decidido por
    // função pura. Catálogo em PDF precisa de um MODELO para transcrever, e
    // isso custa dinheiro proporcional ao tamanho do arquivo — por isso a tela
    // de Importar MEDE antes e mostra o custo para a lojista decidir.
    //
    // Tentar ler um PDF com `lerPlanilha` daria "não consegui ler esse
    // arquivo", que é verdade e inútil: ela largou o catálogo do fornecedor,
    // que é exatamente o que o Zion sabe transcrever.
    //
    // O componente é O MESMO da tela de Importar, não uma cópia: medir →
    // mostrar o custo → ela decide → extrair → conferir → gravar continua
    // acontecendo em um lugar só. O que mudou foi ele aceitar um arquivo já
    // escolhido, para ela não ter que escolher duas vezes.
    // ===================================================================
    // FOTO: o veredicto ANTES do upload
    // ===================================================================
    //
    // 127 anúncios desta lojista estão travados por capa pequena. Uma foto que
    // não é quadrada com 1200 de lado NÃO destrava nada — e subir primeiro
    // para descobrir depois gastaria a viagem dela ao fabricante, o upload e a
    // espera, para o anúncio continuar onde estava.
    //
    // O navegador sabe a dimensão antes de qualquer byte subir. Medir aqui é
    // barato e é a única coisa que muda a decisão dela.
    if (arquivo.type.startsWith("image/")) {
      const medida = await medirFoto(arquivo);
      if (!medida) {
        setTurnos((t) => [
          ...t,
          {
            pergunta: `Enviei a foto ${arquivo.name}`,
            erro: "Não consegui abrir esse arquivo como imagem. Ele pode estar corrompido ou num formato que o navegador não lê.",
          },
        ]);
        return;
      }
      setTurnos((t) => [
        ...t,
        { pergunta: `Enviei a foto ${arquivo.name}`, foto: { arquivo, medida } },
      ]);
      return;
    }

    if (arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name)) {
      setTurnos((t) => [...t, { pergunta: `Enviei o catálogo ${arquivo.name}`, pdf: arquivo }]);
      return;
    }

    try {
      const planilha = await lerPlanilha(arquivo);

      // ===================================================================
      // O CLIPE DEIXA DE SER "A PORTA DOS CUSTOS"
      // ===================================================================
      //
      // Até 10/08/2026 todo arquivo largado aqui era tratado como planilha de
      // CUSTO. Uma planilha de peso caía na conferência de custos, não achava
      // coluna de custo, e a lojista recebia uma tela pedindo para ela apontar
      // uma coluna que a planilha não tem.
      //
      // Quem decide agora é `oQueEssaPlanilhaE`, pelos CABEÇALHOS — mesma
      // decisão toda vez, sem modelo. Cada espécie segue para o domínio dela,
      // com a disciplina dela:
      //
      //   custo  → conferência do mapeamento antes de gravar (colunas de custo
      //            são ambíguas: já gravaram R$ 30.277.872,00 como custo)
      //   peso   → detecção estrita, sem conferência de mapeamento: ou os
      //            cabeçalhos são inequívocos, ou o domínio recusa com
      //            instrução ("renomeie para peso_kg")
      //
      // AMBÍGUA e NENHUMA não viram palpite: viram frase. Uma planilha com
      // custo E peso é legítima, e escolher por ela gravaria metade do que ela
      // trouxe sem dizer qual metade.
      const especie = oQueEssaPlanilhaE(planilha.headers);
      if (especie.especie === "nenhuma" || especie.especie === "ambigua") {
        setTurnos((t) => [
          ...t,
          {
            pergunta: `Enviei a planilha ${arquivo.name}`,
            erro:
              especie.especie === "nenhuma"
                ? especie.mensagem
                : `${especie.porque} Me diga qual das duas você quer importar e mande de novo só com essa coluna.`,
          },
        ]);
        return;
      }

      if (especie.especie === "catalogo") {
        // ANÁLISE PRECISA DO TEXTO CRU, e isso não é detalhe de implementação.
        //
        // `analisarProdutosCsv` lê o texto do arquivo, não a planilha já
        // interpretada — é ele que sabe agrupar variações por código do ERP.
        // Reconstruir CSV a partir das linhas lidas perderia aspas e vírgulas
        // dentro de campo, e uma vírgula perdida vira produto com nome cortado.
        //
        // Por isso só CSV entra por aqui. Um .xlsx de catálogo é recusado com
        // instrução, em vez de importado de um jeito que pode cortar nomes.
        if (!/\.csv$/i.test(arquivo.name)) {
          setTurnos((t) => [
            ...t,
            {
              pergunta: `Enviei a planilha ${arquivo.name}`,
              erro:
                "Isto parece um catálogo de produtos, e para criar produtos eu preciso do arquivo em CSV. " +
                "Salve como CSV no Excel (Arquivo → Salvar como → CSV) e mande de novo.",
            },
          ]);
          return;
        }
        const analise = analisarProdutosCsv(decodificarTexto(await arquivo.arrayBuffer()).texto);
        setTurnos((t) => [
          ...t,
          { pergunta: `Enviei a planilha ${arquivo.name}`, planilha, especie: "catalogo", catalogo: analise },
        ]);
        return;
      }

      setTurnos((t) => [
        ...t,
        { pergunta: `Enviei a planilha ${arquivo.name}`, planilha, especie: especie.especie },
      ]);
    } catch (e) {
      setTurnos((t) => [
        ...t,
        {
          pergunta: `Enviei a planilha ${arquivo.name}`,
          erro:
            e instanceof Error
              ? `Não consegui ler esse arquivo: ${e.message}`
              : "Não consegui ler esse arquivo.",
        },
      ]);
    }
  }

  /**
   * A gravação do PESO. Irmã de `confirmarPlanilha`, e por isso mesmo separada.
   *
   * Poderia ser um `if` dentro da outra. Não é, porque as duas gravam em
   * lugares diferentes com relatórios diferentes, e um parâmetro a mais numa
   * função que já grava dinheiro é onde o próximo defeito mudo entra.
   */
  /**
   * A criação do CATÁLOGO. A única das quatro que aumenta a base.
   *
   * Separada das irmãs pela mesma razão que elas são separadas entre si: gravam
   * em lugares diferentes com relatórios diferentes. Aqui o relatório diz
   * "criei", não "importei" — porque é o que aconteceu com a base dela.
   */
  /**
   * O envio da FOTO. Irmã das outras confirmações, e separada pelo mesmo motivo.
   *
   * `uploadImagemProduto` e `promoverImagemACapa` são os MESMOS serviços da tela
   * de Imagens — a capa promovida aqui rebaixa a anterior lá, porque é a mesma
   * função que faz as duas coisas.
   */
  /**
   * PUBLICAR — a única ação do chat que o comprador vê.
   *
   * ===================================================================
   * PASSA PELA ROTA, NÃO AO REDOR DELA
   * ===================================================================
   *
   * `publicarNoML` faz `fetch("/api/ml/publicar")` — a MESMA rota da tela da
   * equipe, com as MESMAS guardas (conexão, credencial e a trava de infração
   * que falha fechada). Um caminho próprio até o ML seria uma segunda cópia
   * daquelas guardas, e a trava de infração é a última coisa neste repositório
   * que pode ter duas versões: republicar o que o ML cancelou é reincidência.
   *
   * O cartão é a autorização; a rota é o guarda. Nenhum dos dois substitui o
   * outro.
   */
  async function publicar(indice: number) {
    const alvo = turnos[indice];
    const p = alvo?.propostaDePublicacao;
    if (!p || !clienteId || alvo?.publicando) return;
    setTurnos((t) => t.map((turno, i) => (i === indice ? { ...turno, publicando: true } : turno)));
    try {
      const reg = await registroDeAnuncio(p.anuncioId);
      if (!reg) throw new Error("Não achei o anúncio preparado. Peça de novo e eu refaço.");
      const r = await publicarNoML(reg, true);
      setTurnos((t) =>
        t.map((turno, i) =>
          i === indice
            ? {
                ...turno,
                propostaDePublicacao: undefined,
                publicando: false,
                // O QUE ACONTECEU, com o link. Sem link, sem afirmação de que
                // está no ar — foi o erro que eu cometi três vezes em 03/08.
                texto: r.permalink
                  ? `Publiquei "${p.nome}" no Mercado Livre. Está no ar: ${r.permalink}`
                  : `Publiquei "${p.nome}" no Mercado Livre${r.id ? ` (${r.id})` : ""}.`,
              }
            : turno
        )
      );
      aoGravar?.();
    } catch (e) {
      setTurnos((t) =>
        t.map((turno, i) =>
          i === indice
            ? {
                ...turno,
                publicando: false,
                // A RECUSA DA ROTA CHEGA INTEIRA. "Não consegui publicar" no
                // lugar de "o ML já cancelou 2 anúncios deste produto por
                // infração" esconderia justamente o que ela precisa resolver.
                erro: e instanceof Error ? e.message : "Não consegui publicar agora.",
              }
            : turno
        )
      );
    }
  }

  async function confirmarFoto(indice: number, comoCapa: boolean) {
    const alvo = turnos[indice];
    const produto = contexto?.produto;
    if (!alvo?.foto || !clienteId || !produto) return;
    setTurnos((t) =>
      t.map((turno, i) => (i === indice ? { ...turno, importandoPlanilha: true } : turno))
    );
    try {
      const img = await uploadImagemProduto({
        clienteId,
        produtoId: produto.id,
        file: alvo.foto.arquivo,
      });
      // A CAPA É UM SEGUNDO PASSO, e falhar nele não desfaz o upload: a foto
      // está lá, e dizer "não subiu" seria mentira. Por isso o catch separado.
      let virouCapa = false;
      if (comoCapa) {
        try {
          await promoverImagemACapa(produto.id, img.id);
          virouCapa = true;
        } catch (e) {
          console.error("[chat/foto] subiu mas não virou capa:", e);
        }
      }
      const m = alvo.foto.medida;
      setTurnos((t) =>
        t.map((turno, i) =>
          i === indice
            ? {
                ...turno,
                foto: undefined,
                importandoPlanilha: false,
                texto:
                  `Subi a foto para ${produto.nome} (${m.largura} × ${m.altura}).` +
                  (comoCapa
                    ? virouCapa
                      ? " Ela é a capa agora."
                      : " Subiu, mas não consegui marcá-la como capa — dá para fazer isso na tela de Imagens."
                    : ""),
              }
            : turno
        )
      );
      aoGravar?.();
    } catch (e) {
      setTurnos((t) =>
        t.map((turno, i) =>
          i === indice
            ? {
                ...turno,
                importandoPlanilha: false,
                erro: e instanceof Error ? e.message : "Não consegui subir a foto.",
              }
            : turno
        )
      );
    }
  }

  async function confirmarCatalogo(indice: number) {
    const alvo = turnos[indice];
    if (!alvo?.catalogo || !clienteId) return;
    setTurnos((t) =>
      t.map((turno, i) => (i === indice ? { ...turno, importandoPlanilha: true } : turno))
    );
    try {
      const r = await confirmarImportacaoProdutos({
        clienteId,
        // O nome vem do contexto do portal, não de prop nova: quem cria
        // produto precisa carimbar de quem é, e o portal já sabe.
        cliente: nomeDoPortal,
        linhas: alvo.catalogo.linhas,
      });
      setTurnos((t) =>
        t.map((turno, i) =>
          i === indice
            ? {
                ...turno,
                catalogo: undefined,
                planilha: undefined,
                importandoPlanilha: false,
                // "CRIEI", não "importei" — é o que aconteceu com a base dela.
                // E a margem baixa vem junto: cinquenta produtos criados com
                // margem apertada é notícia, não detalhe.
                texto:
                  `Criei ${r.total} produto(s)` +
                  (r.totalVariacoes ? ` e ${r.totalVariacoes} variação(ões)` : "") +
                  " na sua base." +
                  (r.comMargemBaixa > 0
                    ? ` ${r.comMargemBaixa} deles ficaram com margem abaixo do seu mínimo — vale conferir o preço antes de anunciar.`
                    : ""),
              }
            : turno
        )
      );
      aoGravar?.();
    } catch (e) {
      setTurnos((t) =>
        t.map((turno, i) =>
          i === indice
            ? {
                ...turno,
                importandoPlanilha: false,
                erro: e instanceof Error ? e.message : "Não consegui criar os produtos.",
              }
            : turno
        )
      );
    }
  }

  async function confirmarPeso(indice: number) {
    const alvo = turnos[indice];
    if (!alvo?.planilha || !clienteId) return;
    setTurnos((t) =>
      t.map((turno, i) => (i === indice ? { ...turno, importandoPlanilha: true } : turno))
    );
    try {
      const r = await importarPeso(clienteId, alvo.planilha);
      setTurnos((t) =>
        t.map((turno, i) =>
          i === indice
            ? {
                ...turno,
                planilha: undefined,
                importandoPlanilha: false,
                // AS QUATRO CONTAGENS, como no relatório de custos. "84
                // variações" sozinho lê-se como sucesso completo; o número que
                // falta é justamente o que a faria procurar o que ficou para
                // trás.
                texto:
                  `Gravei o peso em ${r.produtos} produto(s) e ${r.variantes} variação(ões), ` +
                  `de ${r.linhasCsv} linha(s) na planilha.` +
                  (r.naoEncontrados > 0
                    ? ` ${r.naoEncontrados} linha(s) não casaram com nenhuma variação — o SKU ou EAN não existe aqui.`
                    : "") +
                  (r.semPeso > 0
                    ? ` ${r.semPeso} linha(s) vieram sem peso utilizável (vazio, zero ou texto) e ficaram de fora.`
                    : ""),
              }
            : turno
        )
      );
      aoGravar?.();
    } catch (e) {
      setTurnos((t) =>
        t.map((turno, i) =>
          i === indice
            ? {
                ...turno,
                importandoPlanilha: false,
                erro: e instanceof Error ? e.message : "Não consegui gravar o peso.",
              }
            : turno
        )
      );
    }
  }

  async function confirmarPlanilha(indice: number, mapa: Mapeamento) {
    const alvo = turnos[indice];
    if (!alvo?.planilha || !clienteId) return;
    setTurnos((t) =>
      t.map((turno, i) => (i === indice ? { ...turno, importandoPlanilha: true } : turno))
    );
    try {
      const r = await importarCustos(clienteId, alvo.planilha, mapa);
      setTurnos((t) =>
        t.map((turno, i) =>
          i === indice
            ? { ...turno, custosImportados: r, planilha: undefined, importandoPlanilha: false }
            : turno
        )
      );
      aoGravar?.();
    } catch (e) {
      setTurnos((t) =>
        t.map((turno, i) =>
          i === indice
            ? {
                ...turno,
                importandoPlanilha: false,
                erro: e instanceof Error ? e.message : "Falha ao importar os custos.",
              }
            : turno
        )
      );
    }
  }

  const sugestoes = contexto?.produto ? SUGESTOES_PRODUTO : SUGESTOES_LOJA;

  return (
    <div
      className={
        alturaCheia
          ? "flex h-full flex-col p-4"
          : "rounded-xl border border-white/10 bg-zinc-900/40 p-4"
      }
    >
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-violet-400" />
        <h3 className="text-sm font-medium text-zinc-200">{titulo}</h3>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Respondo com os seus números — e digo quando não sei.
      </p>

      {/* O QUE ESTE BOTÃO DEIXOU DE SER.
          Ele escolhia entre "barato e limitado" e "caro e capaz" — uma decisão
          do SISTEMA que a lojista não tem como tomar: ela não sabe de antemão
          qual pergunta precisa de fio.
          Agora o roteamento é automático (a rota barata repassa o que não
          entende), e o que sobra aqui é outra coisa: manter ou não o FIO entre
          as perguntas. Isso ela sabe responder — é sobre a conversa dela, não
          sobre a nossa arquitetura.
          Desligar continua limpando o fio: o histórico de um não serve ao
          outro. */}
      <button
        type="button"
        onClick={() => {
          setConversando((v) => !v);
          setFalas([]);
          setTokensDoFio(0);
          // Trocar de modo encerra o fio dos DOIS lados: o histórico do modelo
          // e a conversa ativa no banco. Religar não cria nada — quem cria é o
          // primeiro turno seguinte, e aí o servidor devolve o id novo.
          esquecerFio();
        }}
        disabled={ocupado}
        className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-zinc-500 transition hover:text-violet-300 disabled:opacity-50"
      >
        <MessagesSquare size={12} />
        {conversando
          ? `Conversa contínua ligada — guarda o fio entre as perguntas${
              tokensDoFio > 0 ? ` · ${tokensDoFio.toLocaleString("pt-BR")} tokens` : ""
            }. Desligar`
          : "Manter o fio entre as perguntas"}
      </button>

      {/* Em altura cheia o container existe SEMPRE, mesmo vazio: e ele que
          come o espaco e empurra a barra de digitar para o pe. Sem isso a
          barra fica colada no topo com o vazio embaixo, que e o oposto do
          que a mao espera num chat. */}
      {(alturaCheia || turnos.length > 0) && (
        <div
          className={`mt-4 space-y-4 overflow-y-auto pr-1 ${
            alturaCheia ? "min-h-0 flex-1" : "max-h-96"
          }`}
        >
          {turnos.map((t, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm font-medium text-zinc-300">
                <span className="text-zinc-500">Você: </span>
                {t.pergunta}
              </p>
              {t.erro ? (
                <p className="flex items-start gap-2 text-sm text-amber-300">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {t.erro}
                </p>
              ) : t.foto ? (
                /* A CONFERÊNCIA DA FOTO julga ANTES de subir: 127 anúncios
                   desta conta estão travados por capa pequena, e uma foto que
                   não é quadrada com 1200 de lado não destrava nada. */
                <ConferirFoto
                  arquivo={t.foto.arquivo}
                  medida={t.foto.medida}
                  produto={contexto?.produto ?? null}
                  ocupado={t.importandoPlanilha}
                  onCancelar={() =>
                    setTurnos((ts) =>
                      ts.map((turno, j) =>
                        j === i ? { ...turno, foto: undefined, texto: "Descartei a foto. Nada foi enviado." } : turno
                      )
                    )
                  }
                  onConfirmar={(comoCapa) => void confirmarFoto(i, comoCapa)}
                />
              ) : t.catalogo ? (
                /* O CATÁLOGO É O ÚNICO QUE CRIA — e a tela diz o verbo. Custo e
                   peso atualizam o que já existe; errar ali escreve um número
                   errado. Errar aqui escreve produtos duplicados, e desfazer é
                   trabalho manual, produto a produto. */
                <ConferirCatalogo
                  analise={t.catalogo}
                  ocupado={t.importandoPlanilha}
                  onCancelar={() =>
                    setTurnos((ts) =>
                      ts.map((turno, j) =>
                        j === i
                          ? { ...turno, catalogo: undefined, planilha: undefined, texto: "Descartei a planilha. Nada foi criado." }
                          : turno
                      )
                    )
                  }
                  onConfirmar={() => void confirmarCatalogo(i)}
                />
              ) : t.pdf ? (
                /* O COMPONENTE DA TELA DE IMPORTAR, não uma cópia dele. Ele
                   traz junto a medição do custo ANTES de gastar, a conferência
                   item a item com a página de origem declarada, e o descarte
                   do que ela não quer.

                   Fica FORA do ramo de `t.planilha` porque um turno de PDF não
                   tem planilha nenhuma — aninhá-lo ali deixaria o ramo
                   inalcançável, e a lojista veria o turno vazio. */
                <ImportarCatalogoPdf arquivoInicial={t.pdf} onImportado={aoGravar} />
              ) : t.planilha ? (
                /* A CONFERÊNCIA É A MESMA DA TELA DE IMPORTAR — o componente,
                   não uma cópia dele. Ele mostra o texto CRU do custo ao lado
                   do valor interpretado, que é onde a coluna trocada se
                   denuncia, e recusa importar quando os sinais são ruins. */
                t.especie === "peso" ? (
                  /* PESO NÃO PASSA PELA CONFERÊNCIA DE MAPEAMENTO, e isso é
                     desenho, não atalho. O domínio do peso RECUSA casar por
                     nome e RECUSA coluna sem unidade no cabeçalho — se a
                     planilha chegou até aqui, os cabeçalhos já são
                     inequívocos. Pedir para ela apontar colunas que o domínio
                     já identificou com certeza seria cerimônia, e cerimônia
                     ensina a clicar sem ler.

                     O que continua valendo é a outra metade da regra: largar o
                     arquivo NÃO é autorizar. Nada é gravado até o clique. */
                  <ConferirPeso
                    planilha={t.planilha}
                    ocupado={t.importandoPlanilha}
                    onCancelar={() =>
                      setTurnos((ts) =>
                        ts.map((turno, j) =>
                          j === i ? { ...turno, planilha: undefined, texto: "Descartei a planilha. Nada foi gravado." } : turno
                        )
                      )
                    }
                    onConfirmar={() => void confirmarPeso(i)}
                  />
                ) : (
                <ConferirPlanilha
                  planilha={t.planilha}
                  nomesDoCatalogo={produtos.map((p) => p.nome)}
                  ocupado={t.importandoPlanilha}
                  onCancelar={() =>
                    setTurnos((ts) =>
                      ts.map((turno, j) =>
                        j === i ? { ...turno, planilha: undefined, texto: "Descartei a planilha. Nada foi gravado." } : turno
                      )
                    )
                  }
                  onConfirmar={(mapa) => void confirmarPlanilha(i, mapa)}
                />
                )
              ) : t.custosImportados ? (
                <ResultadoDaPlanilha r={t.custosImportados} />
              ) : t.texto !== undefined ||
                t.proposta ||
                t.cadastro ||
                t.pendencias ||
                t.preparacao ||
                t.pricing ||
                t.propostaDePreco ? (
                <div className="space-y-2">
                  {t.texto && <Markdown texto={t.texto} />}
                  {t.pendencias && <PainelDePendencias p={t.pendencias} />}
                  {t.preparacao && <PainelDaPreparacao p={t.preparacao} />}
                  {t.pricing && <PainelDePreco p={t.pricing} />}
                  {t.propostaDePreco && (
                    <CartaoDePreco
                      p={t.propostaDePreco}
                      propostaId={t.propostaDePrecoId}
                      desfecho={desfechoNaTela(t, agora)}
                      ocupado={ocupado}
                      aoConfirmar={() => void confirmar(i)}
                      aoDescartar={() => descartar(i)}
                    />
                  )}
                  {t.propostaDePublicacao && (
                    <CartaoDePublicacao
                      p={t.propostaDePublicacao}
                      ocupado={!!t.publicando}
                      desfecho={desfechoNaTela(t, agora)}
                      aoConfirmar={() => void publicar(i)}
                      aoDescartar={() =>
                        setTurnos((ts) =>
                          ts.map((turno, j) =>
                            j === i
                              ? { ...turno, propostaDePublicacao: undefined, texto: "Descartei. Nada foi publicado." }
                              : turno
                          )
                        )
                      }
                    />
                  )}
                  {t.propostaDeTexto && (
                    <CartaoDeTexto
                      t={t.propostaDeTexto}
                      propostaId={t.propostaDeTextoId}
                      desfecho={desfechoNaTela(t, agora)}
                      ocupado={ocupado}
                      aoConfirmar={() => void confirmar(i)}
                      aoDescartar={() => descartar(i)}
                    />
                  )}
                  {t.propostaDeTitulo && (
                    <CartaoDeTitulo
                      t={t.propostaDeTitulo}
                      propostaId={t.propostaDeTituloId}
                      desfecho={desfechoNaTela(t, agora)}
                      ocupado={ocupado}
                      aoConfirmar={() => void confirmar(i)}
                      aoDescartar={() => descartar(i)}
                    />
                  )}
                  {t.procedencia && <CartaoDeProcedencia h={t.procedencia} />}
                  {t.cadastro && (
                    <CartaoDoCadastro
                      c={t.cadastro}
                      desfecho={desfechoNaTela(t, agora)}
                      ocupado={ocupado}
                      aoConfirmar={() => void confirmar(i)}
                      aoDescartar={() => descartar(i)}
                    />
                  )}
                  {t.propostaDeAnuncio && <CartaoDeAnuncio p={t.propostaDeAnuncio} />}
                  {t.escopo && t.propostaId && (
                    <CartaoDoLote
                      e={t.escopo}
                      desfecho={desfechoNaTela(t, agora)}
                      ocupado={ocupado}
                      aoConfirmar={() => void confirmar(i)}
                      aoDescartar={() => descartar(i)}
                    />
                  )}
                  {/* A EXIGÊNCIA DO ID VALE PARA QUEM CARREGA BOTÃO.
                      `pronta` é a única que grava, e ela só aparece com uma
                      autorização persistida atrás — é a primitiva de 29/07.
                      As outras (`recusada`, `sem_alvo`, `ambigua`,
                      `falta_dado`) são RECADO: dizem por que não dá, ou
                      perguntam qual produto. Não gravam nada, não têm botão, e
                      exigir id delas foi o que calou o chat por treze dias —
                      a lojista ditava "o custo do X é 28,40", o software
                      entendia (medido: intencao `preencher`, campo `custo`,
                      valor `28,40`) e a tela não mostrava NADA. */}
                  {t.proposta && (t.propostaId || t.proposta.tipo !== "pronta") && (
                    <CartaoDaProposta
                      p={t.proposta}
                      desfecho={desfechoNaTela(t, agora)}
                      ocupado={ocupado}
                      aoConfirmar={() => void confirmar(i)}
                      aoDescartar={() => descartar(i)}
                    />
                  )}
                  {t.ferramentas && t.ferramentas.length > 0 && (
                    <p className="text-[11px] text-zinc-600">
                      Consultei: {t.ferramentas.join(" · ")}
                    </p>
                  )}
                </div>
              ) : t.resposta ? (
                <Resposta r={t.resposta} interpretacao={t.interpretacao} />
              ) : ocupado && i === turnos.length - 1 ? (
                <p className="flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 size={14} className="animate-spin" /> Lendo os seus dados…
                </p>
              ) : (
                /* SEM RESPOSTA E SEM VOO NÃO É CARREGAMENTO.
                   O spinner aparecia em QUALQUER turno sem resposta, inclusive
                   nos restaurados do disco — e ficava girando para sempre,
                   afirmando um carregamento que não existia. Só o último turno,
                   e só enquanto a requisição está de pé, pode dizer que está
                   lendo. O resto diz a verdade: a resposta não voltou. */
                <p className="text-sm text-zinc-500">
                  A resposta desta pergunta não chegou. Pergunte de novo.
                </p>
              )}
            </div>
          ))}
          <div ref={fimDaLista} />
        </div>
      )}

      {turnos.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void perguntar(s)}
              disabled={ocupado}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400 transition hover:border-violet-400/40 hover:text-violet-300 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className={`flex items-center gap-2 ${alturaCheia ? "mt-3 shrink-0" : "mt-4"}`}
        onSubmit={(e) => {
          e.preventDefault();
          void perguntar(frase);
        }}
      >
        {/* A PLANILHA ENTRA PELO CHAT.
            Antes ela só entrava por Produtos → Importar. A tela continua lá e
            continua certa; isto é a mesma porta no lugar onde a lojista já
            está pedindo ajuda. */}
        <label
          className="flex shrink-0 cursor-pointer items-center rounded-lg border border-white/10 px-2.5 py-2 text-zinc-400 transition hover:border-violet-400/40 hover:text-violet-300"
          title="Enviar planilha de custos (CSV ou Excel)"
        >
          <Paperclip size={15} />
          <span className="sr-only">Enviar planilha de custos</span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,.pdf,application/pdf,image/*"
            className="hidden"
            disabled={ocupado}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = ""; // permite reenviar o mesmo arquivo
              if (arquivo) void receberPlanilha(arquivo);
            }}
          />
        </label>
        <input
          value={frase}
          onChange={(e) => setFrase(e.target.value)}
          placeholder={contexto?.produto ? "O que falta neste produto?" : "O que eu resolvo primeiro?"}
          disabled={ocupado}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={ocupado || !frase.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          <span className="hidden sm:inline">Perguntar</span>
        </button>
      </form>
    </div>
  );
}

/**
 * O painel de preço — o detalhamento, os pisos e os cenários.
 *
 * NENHUM NÚMERO AQUI É CALCULADO. Todos vêm de `conversaDePreco`, que vem de
 * `modeloPreco`. A tela escreve; ela não faz conta. É a mesma regra que impede
 * o modelo de fazer — e ela vale para os dois pela mesma razão: no dia em que a
 * comissão mudar, só um lugar precisa mudar junto.
 */
function PainelDePreco({ p }: { p: PrecoNaTela }) {
  const e = estadoDoPainelDePreco(p);
  if (e.estado === "vazio") return null;

  if (e.estado === "conflito") {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-500/[0.04] p-3 text-sm text-amber-300">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        {e.motivo}
      </p>
    );
  }

  if (e.estado === "bloqueado") {
    return (
      <div className="space-y-1 rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="text-sm text-zinc-200">
          Não consigo calcular o preço de {e.nome} ainda.
        </p>
        <p className="text-xs text-zinc-500">Falta {e.falta.join(" e ")}.</p>
      </div>
    );
  }

  if (e.estado === "triagem") {
    return (
      <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="text-sm text-zinc-200">{e.frase}</p>
        {e.piores.length > 0 && (
          <ul className="space-y-0.5">
            {e.piores.map((i) => (
              <li key={i.produtoId} className="text-xs text-zinc-400">
                <span className="text-amber-300">{i.margem}</span> · {i.nome}
              </li>
            ))}
          </ul>
        )}
        {e.aviso && <p className="text-[11px] text-zinc-600">{e.aviso}</p>}
        {/* A triagem roda com a TABELA de comissão. Dizer isso é o serviço: um
            percentual de tabela apresentado como o da conta do lojista é a
            diferença entre uma conversa e uma promessa. */}
        {e.comissaoEstimada && (
          <p className="text-[11px] text-zinc-600">
            Comissão estimada pela tabela — o número exato sai produto a produto.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-zinc-100">{e.nome}</p>
        <span className="text-[11px] text-zinc-500">{e.saude}</span>
      </div>

      {e.hoje && <Breakdown linhas={e.hoje} />}

      <dl className="space-y-0.5 text-xs">
        {e.minimoSemPrejuizo && (
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-zinc-500">Menor preço sem prejuízo</dt>
            <dd className="text-zinc-200">{e.minimoSemPrejuizo}</dd>
          </div>
        )}
        {e.minimoNaMargem && (
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-zinc-500">Menor preço na sua margem</dt>
            <dd className="text-zinc-200">{e.minimoNaMargem}</dd>
          </div>
        )}
      </dl>

      {/* Os CENÁRIOS numa tabela: é assim que se compara. Três parágrafos com
          três preços obrigam a pessoa a montar a tabela de cabeça. */}
      {e.cenarios.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500">
              <th className="text-left font-normal">Preço</th>
              <th className="text-right font-normal">Sobra</th>
              <th className="text-right font-normal">Margem</th>
            </tr>
          </thead>
          <tbody>
            {e.cenarios.map((c) => (
              <tr key={c.preco} className={c.ok ? "text-zinc-300" : "text-zinc-600"}>
                <td>{c.preco}</td>
                <td className="text-right">{c.lucro}</td>
                <td className="text-right">{c.margem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {e.comissaoEstimada && (
        <p className="text-[11px] text-zinc-600">
          Comissão estimada pela tabela de Moda, não a da sua conta.
        </p>
      )}
    </div>
  );
}

/** O detalhamento em linhas. A soma tem que fechar de cima para baixo. */
function Breakdown({ linhas }: { linhas: readonly { rotulo: string; valor: string; negativa: boolean; resultado?: boolean }[] }) {
  return (
    <dl className="space-y-0.5 text-xs">
      {linhas.map((l) => (
        <div
          key={l.rotulo}
          className={`flex gap-2 ${l.resultado ? "border-t border-white/5 pt-1" : ""}`}
        >
          <dt className={`w-40 shrink-0 ${l.resultado ? "text-zinc-300" : "text-zinc-500"}`}>
            {l.rotulo}
          </dt>
          <dd
            className={
              l.resultado
                ? "font-medium text-emerald-300"
                : l.negativa
                  ? "text-zinc-400"
                  : "text-zinc-200"
            }
          >
            {l.negativa ? "− " : ""}
            {l.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A proposta de trocar o preço — DE → PARA, com o detalhamento.
 *
 * Os dois preços, sempre: um preço novo sozinho não deixa julgar o tamanho da
 * mudança, e é o tamanho que assusta ou tranquiliza.
 *
 * Preço abaixo do piso NÃO bloqueia — vender no prejuízo pode ser estratégia.
 * É aviso, pela mesma regra do `avisoDePreco` no cadastro manual: quem decide é
 * quem vende, mas ninguém decide o que não vê.
 */
function CartaoDePreco({
  p,
  propostaId,
  desfecho,
  ocupado,
  aoConfirmar,
  aoDescartar,
}: {
  p: PropostaDePrecoNaTela;
  propostaId?: string;
  desfecho?: { ok: boolean; mensagem: string };
  ocupado: boolean;
  aoConfirmar: () => void;
  aoDescartar: () => void;
}) {
  const e = estadoDoCartaoDePreco(p, propostaId, desfecho);

  if (e.estado === "concluido") {
    return (
      <p
        className={`flex items-start gap-2 text-sm ${e.ok ? "text-emerald-300" : "text-zinc-400"}`}
      >
        {e.ok ? (
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
        ) : (
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        )}
        {e.mensagem}
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-violet-400/25 bg-violet-500/[0.04] p-3">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">
          Trocar o preço · {p.comoVeio}
        </p>
        <p className="text-sm text-zinc-100">
          <span className="text-zinc-500 line-through">{e.de}</span>{" "}
          <ArrowRight size={12} className="inline text-zinc-600" />{" "}
          <span className="font-medium">{e.para}</span>
        </p>
      </div>

      <Breakdown linhas={e.linhas} />

      {e.alerta && (
        <p className="flex items-start gap-1.5 text-xs text-amber-300">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {e.alerta} Você pode aplicar assim mesmo se for proposital.
        </p>
      )}

      <p className="text-[11px] text-zinc-600">
        Muda o preço no seu catálogo do Zion. Não publica no Mercado Livre.
      </p>

      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          onClick={aoConfirmar}
          disabled={ocupado}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          {ocupado ? "Aplicando…" : e.rotuloBotao}
        </button>
        <button
          type="button"
          onClick={aoDescartar}
          disabled={ocupado}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200 disabled:opacity-40"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}

/**
 * O painel da preparação de anúncio — as etapas e o que trava cada uma.
 *
 * PREPARAR NÃO É PUBLICAR, e o painel diz isso: a etapa `publicacao` aparece
 * como estado, nunca como botão. Publicar é outro passo, com outra confirmação.
 *
 * As situações vêm do orquestrador (`preparacaoDoAnuncio`), que é domínio puro.
 * A tela não decide se uma etapa está pronta — ela desenha o que já foi
 * decidido, e é por isso que "por que esse não foi?" tem a mesma resposta toda
 * vez que alguém perguntar.
 */
function PainelDaPreparacao({ p }: { p: PreparacaoNaTela }) {
  const e = estadoDoPainelDePreparacao(p);
  if (e.estado === "vazio") return null;

  if (e.estado === "lote") {
    return (
      <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="text-sm text-zinc-200">{e.frase}</p>
        {e.aviso && <p className="text-[11px] text-amber-300">{e.aviso}</p>}
        {e.travados.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              O que está travando
            </p>
            <ul className="mt-1 space-y-0.5">
              {e.travados.map((t) => (
                <li key={t.motivo} className="text-xs text-zinc-400">
                  <span className="text-zinc-200">{t.quantos}</span> por {t.motivo}
                  <span className="text-zinc-600"> — {t.exemplos.join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">Preparação do anúncio</p>
        <p className="text-sm font-medium text-zinc-100">{e.frase}</p>
      </div>

      <ul className="space-y-1">
        {e.etapas.map((etapa) => {
          const tom = tomDaEtapa(etapa.situacao);
          return (
            <li key={etapa.etapa} className="flex items-start gap-2 text-xs">
              <span
                className={
                  tom === "boa"
                    ? "text-emerald-400"
                    : tom === "atencao"
                      ? "text-amber-400"
                      : "text-zinc-600"
                }
              >
                {tom === "boa" ? "✓" : tom === "atencao" ? "!" : "·"}
              </span>
              <div className="min-w-0">
                <span className="text-zinc-200">{etapa.rotulo}</span>
                {etapa.faltando.length > 0 && (
                  <span className="text-zinc-500"> — falta {etapa.faltando.join(", ")}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* NÃO há botão de preparar aqui. Quem monta o cartão com o custo em
          minutos e cota é `propor_anuncio`, e é ele que traz o botão — este
          painel responde "em que pé está", não "faça agora". */}
      {e.jaTemAnuncio && (
        <p className="text-[11px] text-zinc-600">
          Já existe um anúncio gerado para este produto.
        </p>
      )}
    </div>
  );
}

/**
 * O título atual e o proposto, lado a lado.
 *
 * OS DOIS, sempre. Mostrar só o novo esconderia o que se está perdendo, e
 * trocar título é a coisa mais fácil de piorar sem ver. As contagens aparecem
 * porque o limite de 60 caracteres do Mercado Livre é a razão de o agente de
 * título existir.
 */
/**
 * O cartão do TEXTO do anúncio.
 *
 * OS DOIS LADOS, SEMPRE. O que existe hoje e o que se propõe, um sobre o outro,
 * porque é comparando que ela decide — e porque uma proposta mostrada sozinha
 * parece melhor do que é.
 *
 * O verbo do botão muda com o campo: descrição TROCA, palavras-chave
 * ACRESCENTAM. Um "Aplicar" genérico faria ela achar que as palavras atuais
 * seriam removidas, e recusar uma melhoria que não tira nada.
 */
/**
 * O cartão de PUBLICAR — o mais forte dos seis, e por um motivo só.
 *
 * As outras cinco confirmações mudam o catálogo DELA: um custo errado, um
 * título ruim, uma foto trocada — tudo visível só para ela, e reversível
 * editando de novo.
 *
 * Esta muda o que o COMPRADOR vê. Um anúncio no ar com preço errado vende com
 * preço errado, e desfazer é encerrar o anúncio e perder o histórico dele.
 *
 * Por isso o cartão mostra os quatro números que decidem — título, preço,
 * estoque, fotos — em vez de "tudo certo, publicar?". Ela não confirma uma
 * intenção; confirma um conteúdo.
 */
function CartaoDePublicacao({
  p,
  ocupado,
  desfecho,
  aoConfirmar,
  aoDescartar,
}: {
  p: {
    nome: string;
    titulo: string;
    preco: number | null;
    estoque: number | null;
    fotos: number;
    categoria: string;
  };
  ocupado: boolean;
  desfecho?: { ok: boolean; mensagem: string };
  aoConfirmar: () => void;
  aoDescartar: () => void;
}) {
  if (desfecho) {
    return (
      <p className={`mt-2 text-sm ${desfecho.ok ? "text-emerald-300" : "text-rose-300"}`}>
        {desfecho.mensagem}
      </p>
    );
  }
  return (
    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-3">
      <p className="text-xs uppercase tracking-wide text-amber-300/80">
        publicar no Mercado Livre — {p.nome}
      </p>

      <p className="mt-2 text-sm text-white/85">{p.titulo}</p>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Preço</dt>
          <dd className="text-white/80">
            {p.preco === null ? "—" : `R$ ${p.preco.toFixed(2).replace(".", ",")}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Estoque</dt>
          <dd className="text-white/80">{p.estoque ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Fotos</dt>
          {/* ZERO FOTO EM ÂMBAR: o anúncio sobe, e sobe sem imagem. */}
          <dd className={p.fotos === 0 ? "text-amber-300" : "text-white/80"}>{p.fotos}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Categoria</dt>
          <dd className="truncate text-white/60">{p.categoria || "o ML escolhe"}</dd>
        </div>
      </dl>

      {/* A CONSEQUÊNCIA, dita antes do clique e sem eufemismo. */}
      <p className="mt-3 text-xs text-amber-300">
        Isto coloca o anúncio no ar. O comprador passa a ver exatamente o que está acima, e desfazer
        significa encerrar o anúncio.
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={aoConfirmar}
          disabled={ocupado}
          className="rounded-md bg-amber-500/15 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
        >
          {ocupado ? "Publicando…" : "Publicar no Mercado Livre"}
        </button>
        <button
          type="button"
          onClick={aoDescartar}
          disabled={ocupado}
          className="rounded-md px-3 py-1.5 text-sm text-white/60 hover:text-white disabled:opacity-50"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

function CartaoDeTexto({
  t,
  propostaId,
  desfecho,
  ocupado,
  aoConfirmar,
  aoDescartar,
}: {
  t: TextoNaTela;
  propostaId?: string;
  desfecho?: { ok: boolean; mensagem: string };
  ocupado: boolean;
  aoConfirmar: () => void;
  aoDescartar: () => void;
}) {
  const e = estadoDoCartaoDeTexto(t, propostaId, desfecho);
  if (e.estado === "concluido") {
    return (
      <p className={`mt-2 text-sm ${e.ok ? "text-emerald-300" : "text-rose-300"}`}>{e.mensagem}</p>
    );
  }
  const rotulo = t.campo === "descricao" ? "descrição" : "palavras-chave";
  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <p className="text-xs uppercase tracking-wide text-white/40">
        {rotulo} — {t.nome}
      </p>

      <div className="mt-2 space-y-2">
        <div>
          <p className="text-xs text-white/40">Hoje</p>
          <p className="whitespace-pre-wrap text-sm text-white/50">
            {t.atual || <span className="italic">vazio</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/40">
            {t.campo === "descricao" ? "Proposta" : "A acrescentar"}
          </p>
          <p className="whitespace-pre-wrap text-sm text-white/85">{t.proposto}</p>
        </div>
      </div>

      {t.justificativa && <p className="mt-2 text-xs text-white/50">{t.justificativa}</p>}
      {/* O EFEITO ANTES DO CLIQUE: substituir e acrescentar não são a mesma
          coisa, e o cartão não pode deixar isso implícito. */}
      <p className="mt-2 text-xs text-amber-300/80">{e.efeito}</p>

      {propostaId ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={aoConfirmar}
            disabled={ocupado}
            className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15 disabled:opacity-50"
          >
            {e.rotuloBotao}
          </button>
          <button
            type="button"
            onClick={aoDescartar}
            disabled={ocupado}
            className="rounded-md px-3 py-1.5 text-sm text-white/60 hover:text-white disabled:opacity-50"
          >
            Descartar
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-white/40">
          Não consegui registrar esta proposta agora, então não há botão. Peça de novo em instantes.
        </p>
      )}
    </div>
  );
}

function CartaoDeTitulo({
  t,
  propostaId,
  desfecho,
  ocupado,
  aoConfirmar,
  aoDescartar,
}: {
  t: TituloNaTela;
  propostaId?: string;
  desfecho?: { ok: boolean; mensagem: string };
  ocupado: boolean;
  aoConfirmar: () => void;
  aoDescartar: () => void;
}) {
  const e = estadoDoCartaoDeTitulo(t, propostaId, desfecho);

  if (e.estado === "concluido") {
    return (
      <p
        className={`flex items-start gap-2 text-sm ${e.ok ? "text-emerald-300" : "text-zinc-400"}`}
      >
        {e.ok ? (
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
        ) : (
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        )}
        {e.mensagem}
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-violet-400/25 bg-violet-500/[0.04] p-3">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">Trocar o título</p>
      <dl className="space-y-1.5 text-sm">
        <div>
          <dt className="text-[11px] text-zinc-500">Hoje ({e.caracteresAtual} caracteres)</dt>
          <dd className="text-zinc-400 line-through decoration-zinc-700">
            {t.tituloAtual || "(sem título)"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-zinc-500">
            Proposto ({e.caracteresProposto} caracteres)
          </dt>
          <dd className="font-medium text-zinc-100">{t.tituloProposto}</dd>
        </div>
      </dl>
      {t.justificativa && <p className="text-xs text-zinc-500">{t.justificativa}</p>}
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          onClick={aoConfirmar}
          disabled={ocupado}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          {ocupado ? "Trocando…" : e.rotuloBotao}
        </button>
        <button
          type="button"
          onClick={aoDescartar}
          disabled={ocupado}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200 disabled:opacity-40"
        >
          Ficar com o atual
        </button>
      </div>
    </div>
  );
}

/**
 * O painel de pendências — centenas de linhas técnicas viram poucas decisões.
 *
 * TODO NÚMERO AQUI VEM DO PLANO, que é domínio puro e provado. A tela não soma
 * nada e o modelo não escreveu nenhum deles: é por esse número que o lojista
 * decide o dia dele.
 *
 * A ORDEM da leitura é deliberada: primeiro o tamanho do problema, depois o
 * quanto dele NÃO é problema dele, e só então o que sobra. Começar pelo que ele
 * precisa fazer transformaria um alívio em cobrança.
 */
function PainelDePendencias({ p }: { p: PendenciasNaTela }) {
  const e = estadoDoPainel(p);

  if (e.estado === "nada_a_fazer") {
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-300">
        <CheckCircle2 size={14} className="shrink-0" />
        {e.frase}
      </p>
    );
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-sm text-zinc-200">{e.frase}</p>
      {e.aviso && <p className="text-[11px] text-amber-300">{e.aviso}</p>}

      {e.decisoes.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            Preciso de {e.decisoes.length}{" "}
            {e.decisoes.length > 1 ? "decisões suas" : "decisão sua"}
          </p>
          <ol className="mt-1 space-y-1.5">
            {e.decisoes.map((d) => (
              <li key={d.id} className="flex items-start gap-2">
                <span className="mt-0.5 text-xs text-violet-400">{d.ordem}.</span>
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200">{d.pergunta}</p>
                  <p className="text-[11px] text-zinc-500">
                    {/* A diferença que muda a pergunta: um valor para todos, ou
                        um por alvo. Confundir os dois é como um EAN acabaria
                        gravado em trinta variantes. */}
                    {comoPedir(d)}
                    {d.bloqueia.length > 0 && (
                      <span className="text-amber-400/70"> · trava {d.bloqueia.join(", ")}</span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {p.plano.preparaveis.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            Consigo preparar sem te perguntar
          </p>
          <ul className="mt-1 space-y-0.5">
            {p.plano.preparaveis.slice(0, 4).map((x) => (
              <li key={x.produtoId} className="text-xs text-zinc-400">
                · {x.resumo}
              </li>
            ))}
            {p.plano.preparaveis.length > 4 && (
              <li className="text-xs text-zinc-600">
                e mais {p.plano.preparaveis.length - 4}
              </li>
            )}
          </ul>
        </div>
      )}

      {/* CONFLITO tem destaque próprio: não é "faltando", é "em dúvida". Um
          custo de trinta milhões não pode sumir numa contagem de pendências. */}
      {p.plano.conflitos.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-400/25 bg-amber-500/[0.04] p-2">
          <p className="flex items-start gap-1.5 text-xs font-medium text-amber-300">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            {p.plano.conflitos.length} em conflito — preciso da sua revisão
          </p>
          <ul className="space-y-0.5">
            {p.plano.conflitos.slice(0, 4).map((c) => (
              <li key={`${c.alvo.id}-${c.campo}`} className="text-[11px] text-zinc-400">
                · {c.explicacao}
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.plano.bloqueadas.length > 0 && (
        <ul className="space-y-0.5">
          {p.plano.bloqueadas.map((b) => (
            <li key={b.tipo} className="text-[11px] text-zinc-500">
              {b.quantos} de {b.tipo}: {b.motivo}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * De onde veio um valor — e o que dizer quando ninguém registrou.
 *
 * "Origem não registrada" aparece como FRASE, nunca como célula vazia. Uma
 * célula vazia se lê como "ninguém preencheu ainda"; a verdade é outra — o valor
 * existe, e a origem dele nunca foi registrada.
 */
function CartaoDeProcedencia({ h }: { h: HistoricoDeCampo }) {
  const selo = selosDaProcedencia(h.procedencia.origem);
  return (
    <div className="space-y-1.5 rounded-lg border border-white/10 bg-black/20 p-3">
      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-zinc-500">{h.campo}</dt>
          <dd className="font-medium text-zinc-100">{h.valorAtual ?? "não informado"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-zinc-500">Origem</dt>
          <dd className={selo.alerta ? "text-amber-300" : "text-zinc-200"}>
            {escreverProcedencia(h.procedencia)}
            {h.procedencia.momento && (
              <span className="text-zinc-500"> · {h.procedencia.momento.slice(0, 10)}</span>
            )}
          </dd>
        </div>
      </dl>

      {h.anteriores.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Valor anterior</p>
          <ul className="mt-0.5 space-y-0.5">
            {h.anteriores.map((a) => (
              <li key={a.valor} className="text-xs text-zinc-400">
                {a.valor}{" "}
                <span className="text-zinc-600">· {escreverProcedencia(a.procedencia)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {h.anteriorAoRegistro && (
        <p className="text-[11px] text-zinc-600">
          Este valor é anterior ao registro de procedência. Daqui para frente, toda alteração fica
          rastreável.
        </p>
      )}
    </div>
  );
}

/**
 * O cadastro em conversa — o que já se sabe, a grade, e o que ainda falta.
 *
 * TUDO AQUI VEM DO SERVIDOR. O status, a contagem de variantes, a lista do que
 * falta e a existência do botão saem do Draft persistido e da Proposal — nunca
 * do texto que o modelo escreveu. Um cartão que acreditasse na frase do modelo
 * ofereceria "Criar produto" para um cadastro que o servidor recusaria.
 *
 * Os estados vêm de `estadoDoCartaoDeCadastro`, que é domínio provado: tela e
 * teste calculando o mesmo em dois lugares divergem no primeiro ajuste.
 */
function CartaoDoCadastro({
  c,
  desfecho,
  ocupado,
  aoConfirmar,
  aoDescartar,
}: {
  c: CadastroNaTela;
  desfecho?: DesfechoDoCadastro & { cegoParaAIL?: boolean };
  ocupado: boolean;
  aoConfirmar: () => void;
  aoDescartar: () => void;
}) {
  const e = estadoDoCartaoDeCadastro(c, desfecho);

  if (e.estado === "concluido") {
    return (
      <div className="space-y-1.5">
        <p
          className={`flex items-start gap-2 text-sm ${e.ok ? "text-emerald-300" : "text-amber-300"}`}
        >
          {e.ok ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          )}
          {e.mensagem}
        </p>
        {e.produtoId && (
          <Link
            href={`/cliente/anunciar?produto=${encodeURIComponent(e.produtoId)}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300"
          >
            Abrir o produto <ArrowRight size={12} />
          </Link>
        )}
      </div>
    );
  }

  if (e.estado === "cancelado") {
    return <p className="text-sm text-zinc-400">{e.mensagem}</p>;
  }

  if (e.estado === "escolha") {
    return (
      <div className="space-y-1.5 rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="text-sm text-zinc-200">Você tem mais de um cadastro em andamento:</p>
        <ol className="space-y-1">
          {e.opcoes.map((o) => (
            <li key={o.id} className="text-xs text-zinc-400">
              {o.ordem}. {o.rotulo}
            </li>
          ))}
        </ol>
        <p className="text-[11px] text-zinc-600">
          Diga qual — eu não escolho por você.
        </p>
      </div>
    );
  }

  const linhasDaGrade = escreverGrade(c.variantes);

  return (
    <div className="space-y-2.5 rounded-lg border border-violet-400/25 bg-violet-500/[0.04] p-3">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">
          Cadastro em andamento
        </p>
        <p className="text-sm font-medium text-zinc-100">{e.titulo}</p>
      </div>

      {c.jaSei.length > 0 && (
        <dl className="space-y-0.5 text-xs">
          {c.jaSei.map((f) => (
            <div key={f.campo} className="flex gap-2">
              <dt className="w-32 shrink-0 text-zinc-500">{f.campo}</dt>
              <dd className="text-zinc-200">
                {f.valor}
                {/* A PROCEDÊNCIA aparece quando não foi o lojista que disse. O
                    que ele informou não precisa de selo; o que veio de outro
                    lugar precisa, e esconder isso transformaria a confirmação
                    em carimbo. */}
                {f.procedencia !== "informado" && (
                  <span className="text-amber-400/70"> ·{f.procedencia}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {c.variantes.total > 0 && (
        <div className="text-xs">
          <p className="text-zinc-500">
            Variantes: <span className="text-zinc-200">{c.variantes.total}</span>
            {c.variantes.semSku > 0 && (
              <span className="text-amber-300"> · {c.variantes.semSku} sem SKU</span>
            )}
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {linhasDaGrade.map((linha) => (
              <li key={linha} className="text-zinc-400">
                {linha}
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.conflitos.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-400/25 bg-amber-500/[0.04] p-2">
          {c.conflitos.map((k) => (
            <p key={k.campo} className="flex items-start gap-1.5 text-xs text-amber-300">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              Você me disse dois valores de {k.campo}: {k.valorAtual} e {k.valorNovo}. Qual vale?
            </p>
          ))}
        </div>
      )}

      {/* POSSÍVEL duplicidade — nunca identidade. Casamento exato não fecha
          nada nesta base: 117 SKUs e 112 EANs se repetem. O cartão mostra e
          pergunta; ele não funde e não bloqueia. */}
      {c.candidatos && c.candidatos.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-400/25 bg-amber-500/[0.04] p-2">
          <p className="flex items-start gap-1.5 text-xs text-amber-300">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            {c.candidatosMensagem ??
              "Encontrei produtos que podem corresponder a este cadastro."}
          </p>
          <ul className="space-y-0.5">
            {c.candidatos.map((k, indice) => (
              <li key={k.produtoId} className="text-[11px] text-zinc-400">
                {indice + 1}.{" "}
                <Link
                  href={`/cliente/anunciar?produto=${encodeURIComponent(k.produtoId)}`}
                  className="text-violet-400 hover:text-violet-300"
                >
                  {[k.marca, k.nome].filter(Boolean).join(" ")}
                </Link>
                {k.referencia && <span className="text-zinc-600"> · ref {k.referencia}</span>}
                {k.sku && <span className="text-zinc-600"> · SKU {k.sku}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {e.estado === "coletando" && e.falta.length > 0 && (
        <div className="text-xs">
          <p className="text-zinc-500">Ainda preciso de:</p>
          <ul className="mt-0.5 space-y-0.5">
            {e.falta.map((f) => (
              <li key={f.o_que} className="flex items-start gap-1.5">
                <span className={f.bloqueia ? "text-amber-400" : "text-zinc-600"}>·</span>
                <span>
                  <span className={f.bloqueia ? "text-zinc-200" : "text-zinc-400"}>{f.o_que}</span>
                  <span className="text-zinc-600"> — {f.porque}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(e.estado === "pronto" || e.estado === "proposta") && e.resumo && (
        <p className="rounded-lg border border-white/5 bg-black/20 p-2 text-sm text-zinc-200">
          {e.resumo}
        </p>
      )}

      {/* O BOTÃO SÓ EXISTE NO ESTADO `proposta` — quer dizer: com uma Proposal
          persistida, do tenant certo, sobre um cadastro que `validarRascunho`
          aprovou. Nos outros estados não há o que confirmar, e um botão ali
          seria oferecer uma ação que o servidor vai recusar. */}
      {e.estado === "proposta" && (
        <div className="flex gap-2 pt-0.5">
          <button
            type="button"
            onClick={aoConfirmar}
            disabled={ocupado}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-40"
          >
            {ocupado ? "Criando…" : e.rotuloBotao}
          </button>
          <button
            type="button"
            onClick={aoDescartar}
            disabled={ocupado}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200 disabled:opacity-40"
          >
            Agora não
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * A proposta de gerar anúncio — e o botão que leva para a esteira.
 *
 * O botão NAVEGA em vez de rodar aqui. A esteira leva de dois a três minutos,
 * tem barra de progresso, salva as entregas parciais e sabe se recuperar de uma
 * aba fechada. Rodá-la dentro de um painel de chat seria uma segunda cópia
 * dessa máquina — pior, e sem nada disso.
 *
 * Quando falta dado, NÃO existe botão. A pessoa lê o que falta e resolve; um
 * botão ali gastaria três minutos para devolver um anúncio com pendência.
 */
function CartaoDeAnuncio({ p }: { p: PropostaDeAnuncio }) {
  if (p.tipo === "sem_alvo") {
    return <p className="text-sm text-zinc-300">{p.mensagem}</p>;
  }

  if (p.tipo === "falta_dado") {
    return (
      <div className="space-y-1.5 rounded-lg border border-amber-400/20 bg-amber-500/[0.04] p-3">
        <p className="flex items-start gap-2 text-sm text-zinc-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
          {p.mensagem}
        </p>
        <Link
          href={`/cliente/anunciar?produto=${encodeURIComponent(p.produtoId)}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300"
        >
          Abrir o produto <ArrowRight size={12} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-violet-400/25 bg-violet-500/[0.04] p-3">
      <p className="text-sm text-zinc-200">{p.resumo}</p>
      {/* Os atributos com a ORIGEM de cada um: o que veio do cadastro e o que
          foi lido do nome. Apresentar dedução como dado seria o começo do
          mesmo problema que a esteira ja teve. */}
      <ul className="flex flex-wrap gap-1.5">
        {p.atributos.map((a) => (
          <li
            key={a.id}
            className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-zinc-400"
            title={a.origem === "nome" ? "lido do nome do produto" : "do cadastro"}
          >
            {a.nome}: <span className="text-zinc-300">{a.valor}</span>
            {a.origem === "nome" && <span className="text-amber-400/70"> ·lido do nome</span>}
          </li>
        ))}
      </ul>
      <Link
        href={`/cliente/anunciar?produto=${encodeURIComponent(p.produtoId)}&gerar=1`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500"
      >
        <Sparkles size={13} /> {p.refazendo ? "Refazer o anúncio" : "Gerar o anúncio"}
      </Link>
    </div>
  );
}

/**
 * A proposta na tela — e o botão que a torna real.
 *
 * Tudo que será gravado está escrito aqui antes de existir botão: qual produto,
 * qual valor, quantas variações. O `resumo` não é decorativo — é o contrato que
 * a pessoa está aceitando, e é o mesmo objeto que vai para `executarProposta`.
 *
 * Quando a unidade foi DEDUZIDA (a frase disse "300" e não "300 g"), isso
 * aparece em destaque. É o único ponto onde o sistema completou o que o cliente
 * não disse, e esconder isso transformaria a confirmação em carimbo.
 */
/**
 * O cartão de um LOTE — o que a pessoa lê antes de mexer em dezenas de linhas.
 *
 * Todas as contagens vêm do SERVIDOR. O cartão não pergunta ao modelo quantos
 * serão alterados: é justamente a quantidade que está sendo aprovada, e um
 * número escrito pelo modelo é um número que ele pode ter errado.
 *
 * A unidade é KG porque é o que o domínio guarda (`peso: number // kg`, usado
 * no frete). A conversa aceita "420 g" e a Proposal carrega gramas, mas o que
 * aparece aqui é o que vai para o banco — e não existe "peso embalado" nem
 * "peso líquido" no modelo, então o rótulo é só "Peso".
 *
 * Três estados, e nenhum deles deixa o botão ativo por engano:
 *   pendente  → mostra o escopo e oferece aplicar
 *   concluído → vira registro, sem botão
 *   obsoleto  → diz que nada foi alterado, sem botão
 */
/**
 * O que a operação comprovadamente causou.
 *
 * ESTE COMPONENTE NÃO CALCULA NADA. Ele recebe um `Consequencia` pronto do
 * servidor e escolhe palavras. Não consulta produto, não soma, não estima, e não
 * transforma `null` em zero — as decisões de o que vale mostrar são de
 * `ofertasQueValem` e `rotuloDoDesbloqueio`, no domínio, com teste.
 *
 * Quando o servidor contou e deu ZERO, não há oferta: `ofertasQueValem` filtra o
 * zero. O fato continua registrado na resposta; a tela só não promete uma tela
 * que estaria vazia.
 */
function Consequencias({ c }: { c: Consequencia }) {
  const ofertas = ofertasQueValem(c);
  if (ofertas.length === 0) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">Isso desbloqueou</p>
      <ul className="mt-1.5 space-y-1">
        {ofertas.map((d) => (
          <li key={d.modo} className="text-sm text-zinc-300">
            {rotuloDoDesbloqueio(d)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CartaoDoLote({
  e,
  desfecho,
  ocupado,
  aoConfirmar,
  aoDescartar,
}: {
  e: EscopoNaTela;
  desfecho?: {
    ok: boolean;
    mensagem: string;
    cegoParaAIL?: boolean;
    consequencia?: Consequencia | null;
  };
  ocupado: boolean;
  aoConfirmar: () => void;
  aoDescartar: () => void;
}) {
  // Já decidido: o cartão vira registro. Sem botão, não há como gravar duas
  // vezes — e "já foi feito" chega aqui como SUCESSO, porque foi.
  if (desfecho) {
    return (
      <div className="space-y-2">
        <p
          className={`flex items-start gap-2 text-sm ${desfecho.ok ? "text-emerald-300" : "text-zinc-400"}`}
        >
          {desfecho.ok ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          )}
          {desfecho.mensagem}
        </p>
        {desfecho.ok && desfecho.consequencia ? (
          <Consequencias c={desfecho.consequencia} />
        ) : null}
      </div>
    );
  }

  // As decisões vêm do domínio provado (`cartaoDoLote`), não daqui: tela e
  // teste calculando o mesmo em dois lugares divergem no primeiro ajuste.
  const c = estadoDoCartao(e);
  if (c.estado !== "pendente") return null;

  return (
    <div className="space-y-2.5 rounded-lg border border-violet-400/25 bg-violet-500/[0.04] p-3">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">
        Alterar {e.campo}
      </p>

      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 text-zinc-500">Novo valor</dt>
          <dd className="font-medium text-zinc-100">
            {c.valorEscrito}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 text-zinc-500">Afeta</dt>
          <dd className="text-zinc-200">
            {c.alvo}
            {e.campo === "peso" && e.produtosAfetados > 1 && (
              <span className="text-zinc-500"> · {e.produtosAfetados} produtos</span>
            )}
          </dd>
        </div>
        {e.naoAlterados > 0 && (
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-zinc-500">Já têm {e.campo}</dt>
            <dd className="text-amber-300">
              {e.naoAlterados} — não {e.naoAlterados > 1 ? "serão alterados" : "será alterado"}
            </dd>
          </div>
        )}
      </dl>

      {e.amostra.length > 0 && (
        // AMOSTRA, não a lista: com centenas de alvos isto viraria uma parede.
        // Os ids vivem na Proposal, no servidor.
        <p className="text-xs text-zinc-500">
          {e.amostra.slice(0, 3).join(" · ")}
          {e.produtosAfetados > 3 && ` e mais ${e.produtosAfetados - 3}`}
        </p>
      )}

      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          onClick={aoConfirmar}
          disabled={ocupado}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          {ocupado ? "Aplicando…" : c.rotuloBotao}
        </button>
        <button
          type="button"
          onClick={aoDescartar}
          disabled={ocupado}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200 disabled:opacity-40"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function CartaoDaProposta({
  p,
  desfecho,
  ocupado,
  aoConfirmar,
  aoDescartar,
}: {
  p: Proposta;
  desfecho?: { ok: boolean; mensagem: string; cegoParaAIL?: boolean };
  ocupado: boolean;
  aoConfirmar: () => void;
  aoDescartar: () => void;
}) {
  if (p.tipo !== "pronta") {
    return (
      <div className="space-y-1.5">
        <p className="text-sm text-zinc-200">{p.tipo === "ambigua" ? p.mensagem : p.mensagem}</p>
        {p.tipo === "ambigua" && (
          <ul className="space-y-1">
            {p.candidatos.map((c) => (
              <li key={c.id} className="text-xs text-zinc-400">
                · {c.nome}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Já decidido: o cartão vira registro. Sem botão, não há como gravar duas
  // vezes clicando rápido.
  if (desfecho) {
    return (
      <div className="space-y-1">
        <p
          className={`flex items-start gap-2 text-sm ${desfecho.ok ? "text-emerald-300" : "text-zinc-400"}`}
        >
          {desfecho.ok ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          )}
          {desfecho.mensagem}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-violet-400/25 bg-violet-500/[0.04] p-3">
      <p className="text-sm text-zinc-200">{p.resumo}</p>
      {p.unidadeDeduzida && (
        <p className="flex items-start gap-1.5 text-xs text-amber-300">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          Você não disse a unidade — entendi <strong>{p.valorEscrito}</strong>. Confira antes de
          gravar.
        </p>
      )}
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          onClick={aoConfirmar}
          disabled={ocupado}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          {ocupado ? "Gravando…" : "Gravar"}
        </button>
        <button
          type="button"
          onClick={aoDescartar}
          disabled={ocupado}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200 disabled:opacity-40"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Cada formato de resposta tem sua forma na tela.
 *
 * O `switch` é exaustivo de propósito: a união discriminada do domínio faz de
 * esquecer um caso um erro de compilação, e não uma tela em branco.
 */
function Resposta({ r, interpretacao }: { r: RespostaDaOperacao; interpretacao?: string }) {
  // A linha de auditoria some quando repetiria a resposta. Em "fora do alcance"
  // a frase É a interpretação do modelo, e "Entendi: <a mesma frase>" só ocupa
  // espaço dizendo duas vezes a mesma coisa.
  const entendi =
    interpretacao && interpretacao.trim() !== r.frase.trim() ? (
      <p className="text-[11px] text-zinc-600">Entendi: {interpretacao}</p>
    ) : null;

  switch (r.tipo) {
    case "numero":
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-200">{r.frase}</p>
          {r.href && r.cta && (
            <Link
              href={r.href}
              className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300"
            >
              {r.cta} <ArrowRight size={12} />
            </Link>
          )}
          {entendi}
        </div>
      );

    case "passo":
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-200">{r.frase}</p>
          <div className="flex items-start gap-2 rounded-lg border border-white/5 bg-black/20 p-3">
            {r.lacuna.bloqueiaTudo ? (
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" />
            ) : (
              <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-400" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200">{r.lacuna.titulo}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{r.lacuna.trava}</p>
              <Link
                href={r.lacuna.href}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300"
              >
                {r.lacuna.cta} <ArrowRight size={12} />
              </Link>
            </div>
          </div>
          {entendi}
        </div>
      );

    case "lista":
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-200">{r.frase}</p>
          <ul className="space-y-2">
            {r.itens.map((l) => (
              <li key={l.tipo} className="flex items-start gap-2">
                {l.bloqueiaTudo ? (
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" />
                ) : (
                  <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-300">{l.titulo}</p>
                  <Link
                    href={l.href}
                    className="text-xs font-medium text-violet-400 hover:text-violet-300"
                  >
                    {l.cta}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {entendi}
        </div>
      );

    case "produto":
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-200">{r.frase}</p>
          {r.itens.length > 0 && (
            <ul className="space-y-1.5">
              {r.itens.map((l) => (
                <li key={l.tipo} className="flex items-start gap-2">
                  <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-300">{l.rotulo}</p>
                    <p className="text-xs text-zinc-500">{l.impede}</p>
                    {l.href && (
                      <Link
                        href={l.href}
                        className="text-xs font-medium text-violet-400 hover:text-violet-300"
                      >
                        Resolver
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {entendi}
        </div>
      );

    case "nada_travado":
      return (
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-sm text-zinc-200">
            <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
            {r.frase}
          </p>
          {entendi}
        </div>
      );

    case "perguntar":
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-200">{r.frase}</p>
          {entendi}
        </div>
      );

    case "saudacao":
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-200">{r.frase}</p>
          <div className="rounded-lg border border-white/5 bg-black/20 p-3">
            {/* "Pode me perguntar" e não "O que eu consigo responder": a
                segunda é a moldura da recusa, e num cumprimento ela lê como se
                ele já tivesse desistido de entender. */}
            <p className="text-xs font-medium text-zinc-400">Pode me perguntar:</p>
            <ul className="mt-1.5 space-y-1">
              {r.posso.map((p) => (
                <li key={p} className="text-xs text-zinc-500">
                  · {p}
                </li>
              ))}
            </ul>
          </div>
          {entendi}
        </div>
      );

    case "nao_sei":
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-200">{r.frase}</p>
          <div className="rounded-lg border border-white/5 bg-black/20 p-3">
            <p className="text-xs font-medium text-zinc-400">O que eu consigo responder:</p>
            <ul className="mt-1.5 space-y-1">
              {r.posso.map((p) => (
                <li key={p} className="text-xs text-zinc-500">
                  · {p}
                </li>
              ))}
            </ul>
          </div>
          {entendi}
        </div>
      );
  }
}
