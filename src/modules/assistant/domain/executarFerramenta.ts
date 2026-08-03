// A execução de uma ferramenta pedida pelo modelo.
//
// Puro: recebe o pedido e o estado, devolve o resultado. Nenhuma rede, nenhum
// banco, nenhum React — e é isso que permite provar aqui, sem provedor, que
// `contar("custo")` numa loja de 73 com 30 custos devolve 43 e não "cerca de
// 40".
//
// Nada aqui é novo. Toda ferramenta é um empacotamento de domínio que já
// existe e já foi provado:
//
//   contar, proximo_passo, estado_da_loja, o_que_impede -> perguntaDaOperacao
//   o_que_falta_no_produto                              -> lacunasDoProduto
//   achar_produto, propor_gravacao                      -> propostaDeCorrecao
//
// O modelo NUNCA vê o estado. Ele vê o que estas funções devolvem — e é essa
// distância que impede o número inventado.

import { responder, type ContextoDaPergunta } from "./perguntaDaOperacao";
import type { AutoridadeDoValor } from "./propostaPersistida";
import {
  candidatos,
  lerNumero,
  montarProposta,
  paraGramas,
  type ProdutoAlvo,
  type Proposta,
} from "./propostaDeCorrecao";
import { lacunasDoProduto } from "../../catalog/domain/lacunasDoProduto";
import { situacaoDePeso } from "../../catalog/domain/familiaDeProduto";
import {
  classificar,
  paraOModelo,
  tentativasPara,
  type CampoDeBusca,
  type LinhaEncontrada,
  type Tentativa,
} from "./buscaDeCatalogo";
import {
  candidatosDoCatalogo,
  montarEscopo,
  type CampoDoLote,
  type EscopoDoLote,
} from "./escopoDoLote";
import {
  montarPropostaDeAnuncio,
  type ProdutoParaAnunciar,
  type PropostaDeAnuncio,
} from "./propostaDeAnuncio";
import {
  associarNaVariante,
  cancelar,
  comoResumo,
  definirGrade,
  draftEstaAberto,
  ehCampoDoCadastro,
  escolherParaRetomar,
  informar,
  numeroDe,
  prontidao,
  resolverConflito,
  resumoDaCriacao,
  rotuloDoDraft,
  type DraftDeCadastro,
} from "./draftDeCadastro";
import {
  avaliarDuplicidade,
  candidatoEnxuto,
  precondicoesDeCadastro,
  tentativasDoCadastro,
  unirAchados,
} from "./candidatosDoCadastro";
import {
  apresentar,
  resolverEscolha,
  type ConjuntoApresentado,
} from "./referenciasDaConversa";
import type { Precondicao } from "./propostaPersistida";
import {
  pendenciasDoCatalogo as calcularPendencias,
  pendenciasDoProduto,
  pesoConhecidoDoProduto,
  variantesSemPeso,
  type ProdutoParaAnalise,
} from "../../catalog/domain/pendenciasDoCatalogo";
import {
  explicarBloqueio,
  panorama,
  planejarResolucao,
  type FonteConectada,
  type PlanoDeResolucao,
} from "./resolucaoDePendencias";
import {
  explicarHistorico,
  type ConflitoDeProcedencia,
  type HistoricoDeCampo,
} from "../../catalog/domain/procedenciaDeCampo";
import {
  avaliar as avaliarPreco,
  decompor,
  escreverComissao,
  precoParaMargem,
  precoSemPrejuizo,
  resumoDaProposta,
  simular,
  situacaoDoPreco,
  triarCatalogo,
  type EntradasDoPreco,
  type ProdutoParaTriagem,
  type ProcedenciaDoCalculo,
} from "../../pricing/domain/conversaDePreco";
import { lerDinheiroEmCentavos, centavosParaReais } from "./fatosDoCadastro";
import {
  avaliarPreparacao,
  avaliarTituloProposto,
  dadosDoProduto,
  escreverEstado,
  oQueFalta as oQueFaltaNaPreparacao,
  selecionarParaPreparar,
  type AnuncioJaGerado,
  type Preparacao,
  type ProdutoParaPreparar,
} from "../../publication/domain/preparacaoDoAnuncio";

export interface ContextoDasFerramentas {
  pergunta: ContextoDaPergunta;
  produtos: readonly ProdutoAlvo[];
  produtoAberto?: { id: string; nome: string } | null;
  /**
   * Os produtos com os dados que a checagem de anúncio exige — marca, modelo,
   * cores, tamanhos.
   *
   * Separado de `produtos` porque `ProdutoAlvo` não carrega isso, e inflar
   * aquele tipo faria toda tela que usa o chat pagar por um dado que só uma
   * ferramenta consulta.
   */
  paraAnunciar?: readonly ProdutoParaAnunciar[];
  /**
   * O PORTO de busca no catálogo. Opcional de propósito.
   *
   * Com ele, `achar_produto` faz busca forte no banco — SKU, EAN e referência,
   * com tenant da sessão. SEM ele, cai no casamento em memória sobre os
   * produtos que a tela já carregou, que é o comportamento anterior.
   *
   * Isso não é fallback inseguro: o caminho em memória sempre foi limitado a
   * nome e marca, e continua sendo. O que ele não faz é fingir que achou por
   * identificador.
   */
  buscar?: (t: Tentativa) => Promise<LinhaEncontrada[]>;
  /**
   * O contexto do CADASTRO EM CONVERSA. Montado pela ROTA, nunca pelo corpo.
   *
   * A rota constrói `ContextoDasFerramentas` campo a campo, e este não está
   * entre os que ela lê da requisição. Se viesse do navegador, o Draft de outro
   * tenant e o conjunto de referências seriam escolhidos por quem manda o
   * corpo — que é a definição do problema que a Proposal existe para resolver.
   */
  cadastro?: ContextoDoCadastro;
  /**
   * A ANÁLISE do catálogo — pendências, conflitos, procedência.
   *
   * Portos e não dados: carregar 500 produtos e as variantes deles a cada turno
   * pagaria o preço da análise em toda pergunta, inclusive nas que não a usam.
   * Assim quem paga é quem chama.
   *
   * Montado pela ROTA, como o do cadastro, e pelo mesmo motivo: um catálogo que
   * o navegador mandasse seria um catálogo que ele escolheu.
   */
  analise?: ContextoDaAnalise;
  /**
   * A PREPARAÇÃO DE ANÚNCIO — portos, montados pela rota.
   *
   * O que antes vinha em `paraAnunciar` (do navegador, no corpo) agora vem
   * daqui, do banco, com o tenant da sessão. `paraAnunciar` continua existindo
   * como fallback para as telas que ainda o mandam.
   */
  anuncio?: ContextoDoAnuncio;
  /**
   * O PRICING — portos, montados pela rota.
   *
   * A conta é do domínio (`conversaDePreco` + `modeloPreco`); estes portos só
   * trazem o que ela precisa do banco, com o tenant da sessão. O modelo não vê
   * custo nem taxas: ele vê o resultado.
   */
  preco?: ContextoDoPreco;
}

export interface ContextoDoPreco {
  /** As entradas do cálculo de um produto. `null` = de outro tenant ou inexistente. */
  doProduto: (
    produtoId: string
  ) => Promise<{ produtoId: string; nome: string; entradas: EntradasDoPreco } | null>;
  /** O catálogo para a triagem de margem. Roda com a TABELA — ver o serviço. */
  catalogo: () => Promise<{
    produtos: readonly ProdutoParaTriagem[];
    margemMinima: number;
    procedencia: ProcedenciaDoCalculo;
    totalNoCatalogo: number;
  }>;
}

export interface ContextoDoAnuncio {
  /** Um produto, com o anúncio que já existir para ele. */
  doProduto: (
    produtoId: string
  ) => Promise<{ produto: ProdutoParaPreparar; anuncio: AnuncioJaGerado | null } | null>;
  /** O catálogo, para o lote. Quem seleciona é o backend, nunca o modelo. */
  catalogo: () => Promise<{
    itens: readonly { produto: ProdutoParaPreparar; anuncio: AnuncioJaGerado | null }[];
    totalNoCatalogo: number;
    truncado: boolean;
  }>;
  /** A margem do lojista, para o pricing saber contra o que calcular. */
  margem: () => Promise<number>;
  /**
   * Roda o agente de TÍTULO — o mesmo A3 do catálogo de agentes.
   *
   * Porto e não implementação: a chamada de IA vive na borda, e o domínio
   * continua puro. Ausente = a ferramenta recusa em vez de fingir.
   */
  gerarTitulo?: (entrada: {
    nome: string;
    marca: string;
    modelo: string;
    tituloAtual: string;
  }) => Promise<{ titulo: string; justificativa: string } | null>;
  /** O anúncio cujo título se quer melhorar. `null` = não existe anúncio. */
  anuncioParaTitulo?: (produtoId: string) => Promise<{
    anuncioId: string;
    nome: string;
    tituloAtual: string;
  } | null>;
}

/** Os portos da análise de pendências. Tudo com o tenant já preso pela rota. */
export interface ContextoDaAnalise {
  catalogo: () => Promise<{
    produtos: readonly ProdutoParaAnalise[];
    totalNoCatalogo: number;
    truncado: boolean;
  }>;
  produto: (produtoId: string) => Promise<ProdutoParaAnalise | null>;
  fontes: () => Promise<readonly FonteConectada[]>;
  /** Os conflitos conhecidos para estes produtos. Vazio é resposta legítima. */
  conflitos: (
    produtos: readonly ProdutoParaAnalise[]
  ) => Promise<readonly ConflitoDeProcedencia[]>;
  procedencia: (
    alvo: { tipo: "produto" | "variante"; id: string },
    campo: string
  ) => Promise<HistoricoDeCampo>;
}

/** Tudo que a ferramenta de cadastro precisa e não pode inventar sozinha. */
export interface ContextoDoCadastro {
  /** O relógio vem de fora: o domínio é puro e não lê `Date.now()`. */
  agoraISO: string;
  /** O Draft aberto DESTA conversa, já conferido contra o tenant da sessão. */
  draft: DraftDeCadastro | null;
  /** Todos os cadastros abertos do lojista. Serve à retomada. */
  abertos: readonly DraftDeCadastro[];
  /** O conjunto que a ÚLTIMA fala do assistente mostrou. Resolve "o segundo". */
  referencias: ConjuntoApresentado | null;
  /** Cria um Draft vazio — id e relógio são da borda. */
  novo: () => DraftDeCadastro;
  /** O porto de busca por candidatos, com tenant. Sem ele, não se busca. */
  buscarCandidatos?: (
    tentativas: readonly Tentativa[]
  ) => Promise<{ casamento: Tentativa["casamento"]; linhas: LinhaEncontrada[] }[]>;
}

/**
 * O que a ferramenta de cadastro devolve para a ROTA persistir.
 *
 * A ferramenta NÃO grava. Ela devolve o Draft novo, e a rota o salva com o
 * tenant da sessão — do mesmo jeito que já salva conversa e proposta. É isso
 * que mantém `executarFerramenta` puro e testável sem banco.
 */
export interface EfeitoNoCadastro {
  draft: DraftDeCadastro;
  /** Uma lista foi apresentada: vai para `copilot_mensagens.metadata`. */
  apresentou?: ConjuntoApresentado;
  /** Possíveis duplicatas encontradas agora. Nunca fundidas, nunca escolhidas. */
  candidatos?: readonly ReturnType<typeof candidatoEnxuto>[];
  candidatosMensagem?: string;
  /** Pedido de Proposal de criação. A rota persiste e devolve o id. */
  proporCriacao?: {
    resumo: string;
    /** Em REAIS — a unidade canônica da coluna `valor` para dinheiro. */
    valor: number;
    precondicoes: readonly Precondicao[];
    /**
     * Sempre `nao_se_aplica`. Uma proposta de cadastro autoriza materializar um
     * DRAFT INTEIRO — nome, SKU, preço e grade —, e o `valor` da Proposal é só o
     * preço. A autoridade relevante aqui é IDENTIDADE: cria linha nova a partir
     * da descrição da pessoa, sem fonte anterior de onde derivar, e um SKU
     * errado é visível e reversível em vez de sobrescrever em silêncio um fato
     * de produto existente. Ver INC-008 §G.6.
     */
    autoridade: AutoridadeDoValor;
  };
  /** O cadastro foi cancelado nesta chamada. */
  cancelou?: boolean;
}

/**
 * O resultado de uma ferramenta.
 *
 * `proposta` vem separada do `saida` porque ela não é só texto para o modelo
 * ler — é o objeto que a tela vai mostrar e que, se alguém confirmar, vai para
 * `executarProposta`. Misturá-la no resultado genérico faria a rota ter que
 * adivinhar qual chamada produziu um cartão.
 */
export interface ResultadoDaFerramenta {
  saida: unknown;
  proposta?: Proposta;
  /**
   * O escopo de um LOTE, quando a proposta atinge mais de um alvo.
   *
   * Separado da `proposta` individual porque o que a rota persiste e o que a
   * tela desenha sao diferentes: aqui os `alvos` sao muitos, e o cartao precisa
   * mostrar quem fica de fora e por que.
   */
  escopo?: EscopoDoLote & {
    campo: CampoDoLote;
    valor: number;
    /**
     * O `valor` foi DERIVADO do próprio produto, não ditado pelo lojista.
     *
     * Só `preparar_resolucao` marca isto: lá o número sai de
     * `pesoConhecidoDoProduto` — o peso único entre as variantes já pesadas. Em
     * `propor_gravacao` o lojista diz o número, e não há derivação a envelhecer.
     *
     * A rota usa isto para congelar TAMBÉM a referência como precondição. Sem
     * essa distinção, invalidar por mudança nas irmãs recusaria propostas em
     * que o valor nunca dependeu delas. Ver INC-002.
     */
    derivadoDoPesoConhecido?: true;
    /**
     * De onde o Zion sabe que veio `valor`. OBRIGATÓRIA de propósito: um site
     * novo que monte escopo não compila sem responder. Ver INC-008.
     */
    autoridade: AutoridadeDoValor;
  };
  /**
   * Uma proposta de GERAR ANÚNCIO — separada da de gravação porque a tela faz
   * coisas diferentes com cada uma: uma grava um campo, a outra dispara a
   * esteira. Um campo só, com união, faria o cartão adivinhar qual botão pôr.
   */
  propostaDeAnuncio?: PropostaDeAnuncio;
  /**
   * O efeito no CADASTRO EM CONVERSA — o Draft novo, para a rota persistir.
   *
   * Separado de tudo o mais porque o que a rota faz com ele é outro verbo:
   * `proposta` vira cartão, `escopo` vira cartão de lote, e este vira uma linha
   * em `copilot_cadastros` mais, quando for o caso, uma Proposal.
   */
  cadastro?: EfeitoNoCadastro;
  /**
   * O plano de resolução — para a TELA desenhar o painel estruturado.
   *
   * Separado do `saida` porque o modelo recebe o resumo e a tela recebe os
   * grupos inteiros. Mandar as centenas de alvos ao modelo estouraria o
   * contexto sem ajudar ninguém a decidir.
   */
  pendencias?: {
    plano: PlanoDeResolucao;
    totalNoCatalogo: number;
    truncado: boolean;
  };
  /** O histórico de um campo — a resposta de "de onde veio isso?". */
  procedencia?: HistoricoDeCampo;
  /** O estado da preparação — de um produto ou da loja. Vai para a tela. */
  preparacao?: {
    /** Preenchido no drill-down de um produto. */
    produto?: Preparacao;
    /** Preenchido no panorama/lote. */
    selecao?: ReturnType<typeof selecionarParaPreparar>;
  };
  /**
   * A proposta de melhorar o título — atual e proposto, lado a lado.
   *
   * A rota persiste como Proposal; sem id não há botão. O objeto aqui só
   * desenha o cartão.
   */
  propostaDeTitulo?: {
    anuncioId: string;
    produtoId: string;
    nome: string;
    tituloAtual: string;
    tituloProposto: string;
    justificativa: string;
    /**
     * Sempre `nao_se_aplica`. A autoridade relevante de um título é CONTEÚDO,
     * não proveniência de valor: um título é para ser composto, e "quem disse
     * este título?" não descreve nada. O `valor` da Proposal de título é só o
     * tamanho em caracteres. Ver INC-008 §G.5.
     */
    autoridade: AutoridadeDoValor;
  };
  /** O pricing — situação de um produto com cenários, ou a triagem do catálogo. */
  pricing?: {
    produto?: {
      produtoId: string;
      nome: string;
      situacao: ReturnType<typeof situacaoDoPreco>;
      cenarios: ReturnType<typeof simular>;
    };
    triagem?: ReturnType<typeof triarCatalogo>;
  };
  /**
   * A proposta de trocar o preço — com a decomposição que a justifica.
   *
   * A rota persiste como Proposal; sem id não há botão. O objeto aqui só
   * desenha o cartão.
   */
  propostaDePreco?: {
    produtoId: string;
    nome: string;
    preco: number;
    decomposicao: NonNullable<ReturnType<typeof decompor>>;
    resumo: string;
    precoAtual: number;
    comoVeio: string;
    margemMinima: number;
    /**
     * `calculado` quando o domínio computou o preço a partir da margem pedida,
     * sobre custo e taxas do banco. `sem_autoridade` quando o número chegou em
     * `texto(args, "preco")`. Os dois ramos já se distinguem no código — o que
     * faltava era isso SOBREVIVER até a Proposal. Ver INC-008.
     */
    autoridade: AutoridadeDoValor;
  };
}

/** Um pedido do modelo, ainda não validado. */
export interface PedidoDeFerramenta {
  nome: string;
  args: Record<string, unknown>;
}

/**
 * Os ids alvo — aceita `produtoId` (fluxo individual, que continua igual) ou
 * `produtoIds` (lote). Normalizar aqui e o que evita duas implementacoes.
 */
function ids(args: Record<string, unknown>): string[] {
  const lista = args.produtoIds;
  if (Array.isArray(lista)) {
    return lista.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  const um = args.produtoId;
  return typeof um === "string" && um.trim() ? [um] : [];
}

function texto(args: Record<string, unknown>, chave: string): string {
  const v = args[chave];
  return typeof v === "string" ? v : "";
}

/**
 * Executa — ou recusa, dizendo por quê.
 *
 * Recusa em vez de lançar: o erro volta ao modelo como resultado da ferramenta,
 * e ele corrige no passo seguinte. Uma exceção mataria a conversa inteira por
 * um argumento errado que o próprio modelo consegue consertar.
 */
export async function executarFerramenta(
  pedido: PedidoDeFerramenta,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  const { nome, args } = pedido;

  switch (nome) {
    case "contar": {
      const r = responder(
        {
          entendeu: true,
          perguntar: "",
          intencao: "contagem",
          assunto: texto(args, "assunto"),
          capacidade: "",
          interpretacao: "",
          campo: "",
          valor: "",
          unidade: "",
          termosDoAlvo: [],
        },
        ctx.pergunta
      );
      // O modelo recebe o número, o SIGNIFICADO dele e a frase pronta.
      //
      // A frase carrega a distinção entre ausência total e parcial do peso
      // (INC-001), que o número sozinho apagaria. E o significado carrega o
      // SENTIDO: `quantos` conta o que FALTA em peso/custo/foto/anúncio e o que
      // ESTÁ em aprovação/publicação/precificação.
      //
      // Sem o rótulo, medido em 03/08/2026 na conta real: o modelo recebeu
      // `{ quantos: 0, total: 80 }` do assunto "anuncio" e escreveu "0 dos seus
      // 80 produtos têm anúncio gerado" — o oposto da verdade, com a frase
      // certa disponível ao lado. Campo sem rótulo é convite à inversão.
      return {
        saida:
          r.tipo === "numero"
            ? {
                quantos: r.quantos,
                significado: r.significado,
                total: r.total,
                frase: r.frase,
                comoResponder: "Use a `frase` como está. Os números só fazem sentido junto do `significado` — nunca inverta o sentido dele.",
                onde: r.href ?? null,
              }
            : { erro: "Não sei contar isso.", frase: r.frase },
      };
    }

    case "proximo_passo":
    case "estado_da_loja": {
      const r = responder(
        {
          entendeu: true,
          perguntar: "",
          intencao: nome === "proximo_passo" ? "proximo_passo" : "estado_geral",
          assunto: "",
          capacidade: "",
          interpretacao: "",
          campo: "",
          valor: "",
          unidade: "",
          termosDoAlvo: [],
        },
        ctx.pergunta
      );
      if (r.tipo === "passo") {
        return {
          saida: {
            titulo: r.lacuna.titulo,
            porque: r.lacuna.trava,
            onde: r.lacuna.href,
            bloqueiaTudo: r.lacuna.bloqueiaTudo,
          },
        };
      }
      if (r.tipo === "lista") {
        return {
          saida: {
            pontos: r.itens.map((l) => ({
              titulo: l.titulo,
              porque: l.trava,
              onde: l.href,
              bloqueiaTudo: l.bloqueiaTudo,
            })),
          },
        };
      }
      return { saida: { nadaTravado: true, frase: r.frase } };
    }

    case "o_que_impede": {
      const r = responder(
        {
          entendeu: true,
          perguntar: "",
          intencao: "por_que_travado",
          assunto: "",
          capacidade: texto(args, "capacidade"),
          interpretacao: "",
          campo: "",
          valor: "",
          unidade: "",
          termosDoAlvo: [],
        },
        ctx.pergunta
      );
      if (r.tipo === "passo") {
        return { saida: { impedimento: r.lacuna.titulo, porque: r.lacuna.trava, onde: r.lacuna.href } };
      }
      return { saida: { nadaImpede: r.tipo === "nada_travado", frase: r.frase } };
    }

    case "achar_produto": {
      const termo = texto(args, "termo") || texto(args, "termos");
      const campo = (texto(args, "tipo") || "auto") as CampoDeBusca;

      // ---- BUSCA FORTE: SKU, EAN e referência, no banco, com tenant ----
      if (ctx.buscar && termo.trim()) {
        // As tentativas vem do dominio, na ordem de FORCA DE BUSCA. A primeira
        // que trouxer linha decide o `casamento` — e um casamento exato com
        // varios resultados continua AMBIGUO, nunca resolvido.
        for (const tentativa of tentativasPara(termo, campo)) {
          const linhas = await ctx.buscar(tentativa);
          if (linhas.length > 0) {
            return { saida: paraOModelo(classificar(linhas, tentativa.casamento, termo)) };
          }
        }
        return { saida: paraOModelo(classificar([], "candidato_textual", termo)) };
      }

      // ---- Caminho em memoria: nome e marca, como sempre foi ----
      const termos = (texto(args, "termos") || termo).split(/\s+/).filter(Boolean);
      const achados = candidatos(termos, ctx.produtos);
      return {
        saida: {
          total: achados.length,
          achados: achados.slice(0, 8).map((p) => ({
            id: p.id,
            nome: p.nome,
            marca: p.marca,
            variacoes: p.quantidadeVariantes,
          })),
          ...(achados.length === 0 ? { aviso: "Nenhum produto bate com esses termos." } : {}),
          ...(achados.length > 1
            ? { aviso: "Mais de um produto bate. Pergunte ao lojista qual, sem escolher." }
            : {}),
        },
      };
    }

    case "o_que_falta_no_produto": {
      const p = ctx.produtos.find((x) => x.id === texto(args, "produtoId"));
      if (!p) return { saida: { erro: "produtoId desconhecido. Use achar_produto antes." } };

      // ---- POR QUE ESTA FERRAMENTA DEVOLVE `campos`, e não só `falta`.
      //
      // Ela devolvia UMA lista de lacunas. Um campo saudável simplesmente não
      // aparecia — e ausência da lista era a única representação de "está ok".
      //
      // Em produção isso virou uma frase falsa: perguntada sobre a Rasteira
      // Vizzano (36 de 39 variantes a 410 g), ela devolveu `falta: [custo,
      // preço]` e o agente escreveu "Não encontrei informações de peso para as
      // variações". Ele não contradisse a ferramenta: a ferramenta não disse
      // nada sobre peso, e silêncio foi lido como inexistência.
      //
      // `campos` diz o estado de CADA campo que esta cadeia consegue avaliar.
      // Ausência deixa de ser sinal.
      const peso = situacaoDePeso(p);

      // ---- PREÇO E FOTO NÃO CHEGAM AQUI.
      //
      // `ctx.produtos` é `ProdutoAlvo`: id, nome, marca, custo e o par
      // (quantidadeVariantes, variacoesSemPeso). Preço e foto não estão nele, e
      // buscá-los seria uma consulta nova.
      //
      // Antes se passava `precoVenda: 0` e `temFoto: true` — inventando
      // "sem preço" e "com foto" para todo produto. O primeiro fez esta
      // ferramenta afirmar "falta preço" para um produto de R$ 152,90 (e, de
      // quebra, manteve `completo` em `false` para SEMPRE); o segundo escondia
      // foto faltando. Agora eles não geram lacuna e são declarados
      // `nao_avaliado`: desconhecido não vira nem ausente nem presente.
      const NAO_AVALIADOS = ["preco", "foto"] as const;
      const falta = lacunasDoProduto(
        {
          custo: p.custo,
          // A pergunta do frete é "dá para calcular?", e para isso uma variante
          // pesada basta — por isso PARCIAL não gera lacuna aqui. Ver INC-001.
          // A completude fina está em `campos.peso.situacao`.
          pesoGramas: peso === "ausencia_total" ? 0 : 1,
          // Os dois valores que suprimem a lacuna do que não foi avaliado.
          precoVenda: 1,
          temFoto: true,
        },
        p.id
      );

      return {
        saida: {
          nome: p.nome,
          // Só fala dos campos AVALIADOS — e é por isso que `naoAvaliados`
          // viaja junto. Sem essa ressalva, `completo: true` seria lido como
          // "o produto está pronto", que é outra coisa.
          completo: falta.length === 0,
          campos: {
            // Os quatro nomes são os do domínio (`situacaoDePeso`), não uma
            // segunda taxonomia: completo · ausencia_parcial · ausencia_total ·
            // sem_grade. As contagens são as que o próprio ProdutoAlvo carrega.
            peso: {
              situacao: peso,
              variantes: p.quantidadeVariantes,
              variantesSemPeso: p.variacoesSemPeso,
            },
            custo: { situacao: p.custo > 0 ? "ok" : "ausente" },
            preco: { situacao: "nao_avaliado" },
            foto: { situacao: "nao_avaliado" },
          },
          naoAvaliados: NAO_AVALIADOS,
          aviso:
            "`campos` diz o estado de cada campo. `nao_avaliado` quer dizer que ESTA consulta não olhou o campo — não que ele esteja vazio: não afirme que falta. `falta` cobre apenas os campos avaliados, e `peso` com situação `ausencia_parcial` NÃO aparece nela porque o frete já sai.",
          falta: falta.map((l) => ({ o_que: l.rotulo, impede: l.impede, onde: l.href ?? null })),
        },
      };
    }

    case "propor_gravacao": {
      const alvos = ids(args);
      const campo = texto(args, "campo");

      // ---- LOTE ----
      if (alvos.length > 1) {
        // CUSTO NAO VAI EM LOTE. Variantes da mesma familia nao tem custo igual
        // so por serem da mesma familia, e o dominio nao tem como estabelecer
        // isso com evidencia. Capacidade menor e correta > capacidade maior e
        // errada: esta base ja recebeu R$ 30 milhoes de custo por generalizacao.
        if (campo === "custo") {
          return {
            saida: {
              montada: false,
              motivo:
                "Não aplico custo em lote. Produtos da mesma família não têm o mesmo custo só por serem parecidos, e eu não tenho como provar que têm. Me diga o custo de cada um, ou faça um por vez.",
            },
          };
        }
        if (campo !== "peso") {
          return { saida: { montada: false, motivo: "Só sei aplicar peso em lote." } };
        }

        const numero = lerNumero(texto(args, "valor"));
        if (numero === null || numero <= 0) {
          return { saida: { montada: false, motivo: `Não consegui ler "${texto(args, "valor")}" como um valor.` } };
        }
        const emGramas = paraGramas(numero, texto(args, "unidade"));
        if (!emGramas) {
          return { saida: { montada: false, motivo: "Não consegui ler isso como peso." } };
        }

        // Os candidatos vem do CATALOGO real, filtrados pelos ids. Id que o
        // modelo alucinou nao vira alvo.
        const candidatos = candidatosDoCatalogo(ctx.produtos, alvos);
        if (candidatos.length === 0) {
          return { saida: { montada: false, motivo: "Nenhum desses produtos existe no seu catálogo. Use achar_produto antes." } };
        }
        const escopo = montarEscopo("peso", candidatos, emGramas.gramas, (v) => `${v} g`);
        if (escopo.incluidos.length === 0) {
          return { saida: { montada: false, motivo: escopo.resumo } };
        }
        return {
          // `emGramas.gramas` saiu de `texto(args, "valor")`. O lojista
          // provavelmente ditou e o modelo repassou — mas nada nesta cadeia
          // prova isso, e `sem_autoridade` é o registro honesto disso. NÃO
          // impede a proposta nem a execução.
          escopo: { ...escopo, campo: "peso", valor: emGramas.gramas, autoridade: "sem_autoridade" },
          // O modelo recebe CONTAGEM e AMOSTRA — nunca a lista inteira. Com
          // 2.000 alvos, mandar os nomes estouraria o contexto e nao ajudaria
          // ninguem a decidir. Os ids ficam no servidor, na Proposal.
          saida: {
            montada: true,
            resumo: escopo.resumo,
            produtosAfetados: escopo.incluidos.length,
            variacoesAfetadas: escopo.unidadesAfetadas,
            naoAlterados: escopo.jaTemDado.length,
            amostra: escopo.incluidos.slice(0, 5).map((c) => c.nome),
            unidadeDeduzida: emGramas.deduzida,
          },
        };
      }

      // ---- INDIVIDUAL — o caminho de antes, intacto ----
      const proposta = montarProposta(
        {
          entendeu: true,
          perguntar: "",
          campo: texto(args, "campo"),
          valor: texto(args, "valor"),
          unidade: texto(args, "unidade"),
          // O ALVO vem do produtoId, não de termos: a esta altura o modelo já
          // chamou `achar_produto` e sabe qual é. Reabrir a busca por texto aqui
          // daria a ele uma segunda chance de acertar o produto errado.
          termosDoAlvo: [],
          interpretacao: "",
        },
        ctx.produtos,
        // `ids(args)[0]` e nao `produtoId`: uma lista de um elemento e um
        // caso legitimo, e ler so o campo antigo perdia o alvo em silencio.
        alvoPeloId(ids(args)[0] ?? "", ctx.produtos)
      );
      return {
        proposta,
        // O modelo recebe só o RESUMO, nunca o objeto. Ele descreve a proposta
        // ao lojista; quem a executa é o clique, com o objeto que a tela tem.
        saida:
          proposta.tipo === "pronta"
            ? { montada: true, resumo: proposta.resumo, unidadeDeduzida: proposta.unidadeDeduzida }
            : { montada: false, motivo: mensagemDaRecusa(proposta) },
      };
    }

    case "propor_anuncio": {
      const id = texto(args, "produtoId");
      // O SERVIDOR primeiro. `paraAnunciar` vinha do corpo da requisição — a
      // tela montava e mandava —, e quem manda o corpo escolhia o que a
      // proposta acreditava. Com o porto de anúncio, os dados vêm do banco com
      // o tenant da sessão; o caminho antigo fica como fallback para as telas
      // que ainda não passam o contexto novo.
      const doServidor = ctx.anuncio ? await ctx.anuncio.doProduto(id) : null;
      const p =
        (doServidor && paraAnunciarDoServidor(doServidor)) ??
        ctx.paraAnunciar?.find((x) => x.id === id);
      if (!p) {
        return {
          saida: {
            erro: "Não tenho os dados deste produto para conferir se ele está pronto. Use achar_produto antes.",
          },
        };
      }
      const proposta = montarPropostaDeAnuncio(p);
      return {
        propostaDeAnuncio: proposta,
        // O modelo recebe o VEREDITO e o que falta — nunca o objeto. Ele
        // explica ao lojista; quem dispara é o clique, com o objeto da tela.
        saida:
          proposta.tipo === "pronto"
            ? {
                pronto: true,
                resumo: proposta.resumo,
                refazendo: proposta.refazendo,
                atributos: proposta.atributos.map((a) => ({
                  nome: a.nome,
                  valor: a.valor,
                  origem: a.origem,
                })),
              }
            : proposta.tipo === "falta_dado"
              ? { pronto: false, faltando: proposta.faltando, motivo: proposta.mensagem }
              : { pronto: false, motivo: proposta.mensagem },
      };
    }

    case "gerenciar_cadastro":
      return gerenciarCadastro(args, ctx);

    case "pendencias":
      return analisarPendencias(args, ctx);

    case "procedencia":
      return consultarProcedencia(args, ctx);

    case "preparar_resolucao":
      return prepararResolucao(args, ctx);

    case "preparacao_de_anuncio":
      return avaliarAnuncio(args, ctx);

    case "propor_titulo":
      return proporTitulo(args, ctx);

    case "pricing":
      return consultarPricing(args, ctx);

    case "propor_preco":
      return proporPreco(args, ctx);

    default:
      return { saida: { erro: `Ferramenta desconhecida: ${nome}` } };
  }
}

/**
 * Lê um preço que o lojista escreveu — em pt-BR, sem adivinhar.
 *
 * Reusa `lerDinheiroEmCentavos`, o parser que já cobre as três armadilhas:
 * "47,80" não é 4780, "1.249,90" não é 1,24990, e "1.2" é AMBÍGUO e devolve
 * null. Dinheiro ambíguo não se adivinha — dez vezes de diferença.
 */
function lerPreco(bruto: string): number | null {
  const centavos = lerDinheiroEmCentavos(bruto);
  return centavos === null ? null : centavosParaReais(centavos);
}

/** Lê uma margem em % — "10", "12,5". Fora de 0..100 é recusa, não clamp. */
function lerMargem(bruto: string): number | null {
  const t = String(bruto ?? "").trim().replace("%", "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n >= 100) return null;
  return n;
}

/** A decomposição, na forma que o modelo lê — reais escritos, não centavos. */
function decomposicaoParaOModelo(d: NonNullable<ReturnType<typeof decompor>>) {
  return {
    preco: d.preco,
    custoDoProduto: d.custoProduto,
    comissaoML: d.comissaoML,
    taxaFixaML: d.taxaFixaML,
    frete: d.envio,
    impostosEComissoesInternas: d.percentuaisDoLojista,
    embalagemEEtiqueta: d.fixosDoLojista,
    lucro: d.lucro,
    margemPercentual: d.margem,
    saude: d.saude,
  };
}

/**
 * "Por quanto posso vender?", "está dando prejuízo?", "simula R$ 79,90".
 *
 * TODA CONTA VEM DO DOMÍNIO. Esta função não soma, não divide e não arredonda
 * dinheiro — ela traduz a intenção em chamadas ao motor e devolve estrutura.
 */
async function consultarPricing(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  const c = ctx.preco;
  if (!c) return { saida: { erro: "O cálculo de preço não está disponível nesta tela." } };

  const produtoId = texto(args, "produtoId");

  // ---- TRIAGEM DO CATÁLOGO ----
  if (!produtoId) {
    const { produtos, margemMinima, procedencia, totalNoCatalogo } = await c.catalogo();
    const t = triarCatalogo(produtos, margemMinima, procedencia, totalNoCatalogo);
    return {
      pricing: { triagem: t },
      saida: {
        analisados: t.analisados,
        prejuizo: t.prejuizo,
        abaixoDaMargem: t.abaixoDaMargem,
        saudaveis: t.saudaveis,
        semPreco: t.semPreco,
        bloqueados: t.bloqueados,
        conflitos: t.conflitos,
        margemMinima,
        // AMOSTRA, nunca o catálogo. Com 300 produtos a lista estouraria o
        // contexto e não ajudaria ninguém a decidir por onde começar.
        piores: t.itens
          .filter((i) => i.classe === "prejuizo" || i.classe === "abaixo_da_margem")
          .slice(0, 8)
          .map((i) => ({ produtoId: i.produtoId, nome: i.nome, margem: i.margem })),
        comissaoUsada: t.comissaoUsada,
        aviso:
          "A triagem usa a tabela de comissão, não a tarifa exata da conta. Diga isso: ela acha quem está em risco; o número exato sai produto a produto.",
        ...(t.truncado
          ? { truncado: `Analisei ${t.analisados} de ${t.totalNoCatalogo} produtos.` }
          : {}),
      },
    };
  }

  // ---- UM PRODUTO ----
  const alvo = await c.doProduto(produtoId);
  if (!alvo) {
    return { saida: { erro: "Não achei esse produto no seu catálogo. Use achar_produto antes." } };
  }
  const e = alvo.entradas;
  const situacao = situacaoDoPreco(e);

  // Cenários pedidos, quando houver.
  const brutos = lista(args, "precos");
  const cenarios = brutos.length > 0 ? simular(brutos.map(lerPreco).filter((n): n is number => n !== null), e) : [];
  const ilegiveis = brutos.filter((b) => lerPreco(b) === null);

  const margemAlvo = lerMargem(texto(args, "margemAlvo"));
  const alvoDeMargem = margemAlvo !== null ? precoParaMargem(margemAlvo, e) : null;

  return {
    pricing: { produto: { produtoId: alvo.produtoId, nome: alvo.nome, situacao, cenarios } },
    saida: {
      produtoId: alvo.produtoId,
      nome: alvo.nome,
      estado: situacao.estado,
      ...(situacao.estado !== "calculavel" ? { falta: situacao.bloqueios } : {}),
      precoDeHoje: situacao.hoje ? decomposicaoParaOModelo(situacao.hoje) : null,
      menorPrecoSemPrejuizo: situacao.minimoSemPrejuizo,
      menorPrecoNaMargem: situacao.minimoNaMargem,
      margemMinimaDoLojista: e.margemMinima,
      comissao: escreverComissao(e),
      // A PROCEDÊNCIA dos inputs. Não é confiança: é o que permite responder
      // "qual custo você usou?" sem inventar de onde ele veio.
      inputs: {
        custo: e.custo > 0 ? e.custo : null,
        comissao: e.procedencia.comissao,
        frete: e.procedencia.envio,
        custosDoLojista: e.procedencia.custosDoLojista,
        reputacao: e.procedencia.reputacao,
      },
      ...(cenarios.length > 0
        ? {
            simulacoes: cenarios.map((s) =>
              s.ok
                ? decomposicaoParaOModelo(s.decomposicao)
                : { preco: s.preco, erro: s.motivo }
            ),
          }
        : {}),
      ...(ilegiveis.length > 0
        ? {
            naoLidos: ilegiveis,
            avisoDeLeitura:
              "Não consegui ler esses valores como dinheiro sem adivinhar. Peça de novo com a vírgula: 89,90.",
          }
        : {}),
      ...(alvoDeMargem
        ? alvoDeMargem.ok
          ? {
              precoParaAMargemPedida: {
                margem: margemAlvo,
                ...decomposicaoParaOModelo(alvoDeMargem.decomposicao),
              },
            }
          : { margemPedidaImpossivel: alvoDeMargem.motivo }
        : {}),
      ...(margemAlvo === null && texto(args, "margemAlvo")
        ? { avisoDeMargem: "Não entendi a margem. Diga em % — por exemplo, 10." }
        : {}),
      aviso:
        "MARGEM aqui é margem LÍQUIDA sobre o preço de venda, depois de custo, comissão, frete, imposto e custos do lojista. Não é markup. Nunca refaça esta conta: repasse os números.",
    },
  };
}

/**
 * "Prepare R$ 89,90" ou "use 12% de margem".
 *
 * O preço vem do lojista OU do domínio (pela margem alvo) — nunca do modelo. E
 * a Proposal congela os inputs: custo, preço atual, peso cobrável e a
 * configuração de imposto/cupom. Se qualquer um mudar antes do clique, o preço
 * aprovado deixou de entregar a margem lida.
 */
async function proporPreco(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  const c = ctx.preco;
  if (!c) return { saida: { erro: "O cálculo de preço não está disponível nesta tela." } };

  const alvo = await c.doProduto(texto(args, "produtoId"));
  if (!alvo) {
    return { saida: { montada: false, motivo: "Não achei esse produto no seu catálogo." } };
  }
  const e = alvo.entradas;
  const a = avaliarPreco(e);
  if (a.estado !== "calculavel") {
    // Sem os inputs, uma proposta de preço seria um número bonito sobre nada.
    return {
      saida: {
        montada: false,
        estado: a.estado,
        motivo:
          a.estado === "conflito"
            ? a.bloqueios[0]
            : `Não consigo calcular o preço: falta ${a.bloqueios.join(" e ")}.`,
      },
    };
  }

  const brutoPreco = texto(args, "preco");
  const margemAlvo = lerMargem(texto(args, "margemAlvo"));

  let preco: number | null = null;
  let comoVeio = "";
  if (brutoPreco) {
    preco = lerPreco(brutoPreco);
    if (preco === null) {
      return {
        saida: {
          montada: false,
          motivo: `Não consigo ler "${brutoPreco}" como preço sem adivinhar. Escreva assim: 89,90.`,
        },
      };
    }
    // NÃO diz "o preço que você disse". Dizia — e era uma atribuição que este
    // código não tem como sustentar.
    //
    // `brutoPreco` é `texto(args, "preco")`: um argumento do MODELO. O lojista
    // provavelmente ditou o número e o modelo o repassou — mas "provavelmente"
    // não é o que a frase afirmava. Não existe, em lugar nenhum desta cadeia,
    // estrutura que ligue este número a uma fala da pessoa; havendo divergência,
    // o cartão atribuía a ela um número que ela não escolheu, na tela em que ela
    // decide. Ver INC-008.
    //
    // O que o sistema SABE, e é só isto: o número chegou pronto e não saiu de
    // uma conta dele. A outra frase, abaixo, pode ser afirmativa porque descreve
    // uma computação que realmente aconteceu.
    comoVeio = "um preço informado na conversa — o Zion não calculou este número";
  } else if (margemAlvo !== null) {
    const r = precoParaMargem(margemAlvo, e);
    if (!r.ok) return { saida: { montada: false, motivo: r.motivo } };
    preco = r.preco;
    comoVeio = `o menor preço que entrega ${margemAlvo}% de margem líquida`;
  } else {
    return {
      saida: { montada: false, motivo: "Preciso do preço ou da margem que você quer." },
    };
  }

  const d = decompor(preco, e);
  if (!d) return { saida: { montada: false, motivo: "Não consigo fechar a conta nesse preço." } };

  return {
    propostaDePreco: {
      produtoId: alvo.produtoId,
      nome: alvo.nome,
      preco,
      decomposicao: d,
      resumo: resumoDaProposta(alvo.nome, d),
      precoAtual: e.precoAtual,
      comoVeio,
      // Do RAMO, não do `comoVeio`. Ler a frase para descobrir a origem seria
      // reconstruir por aparência a informação que o código já tem na mão.
      autoridade: brutoPreco ? "sem_autoridade" : "calculado",
      // A margem ESCOLHIDA pelo lojista viaja junto: é contra ela que o cartão
      // decide se avisa. Sem ela, a tela usaria zero e nunca avisaria nada.
      margemMinima: e.margemMinima,
    },
    saida: {
      montada: true,
      comoVeio,
      ...decomposicaoParaOModelo(d),
      precoDeHoje: e.precoAtual > 0 ? e.precoAtual : null,
      // O AVISO importa: um preço abaixo do piso do lojista é decisão legítima
      // (queima de estoque, isca), mas ninguém decide o que não vê.
      ...(d.margem < e.margemMinima
        ? {
            abaixoDaMargemEscolhida: `Esse preço dá ${d.margem}% e você definiu ${e.margemMinima}% como mínimo.`,
          }
        : {}),
      aviso:
        "Nada foi gravado e NADA foi publicado no Mercado Livre. O lojista confirma clicando, e a troca acontece no catálogo do Zion.",
    },
  };
}

/**
 * "Quais produtos já podem virar anúncio?" e "o que falta nesse aqui?".
 *
 * Sem `produtoId`, o BACKEND seleciona: devolve contagens e os motivos
 * agrupados. Mandar 300 objetos de produto ao modelo estouraria o contexto e
 * ainda deixaria a escolha com quem não mede nada.
 *
 * PREPARAR NÃO É PUBLICAR. Nada nesta função coloca anúncio no ar; a etapa
 * `publicacao` é só um estado que ela informa.
 */
async function avaliarAnuncio(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  const a = ctx.anuncio;
  if (!a) return { saida: { erro: "A preparação de anúncio não está disponível nesta tela." } };
  const margemMinima = await a.margem();
  const produtoId = texto(args, "produtoId");

  // ---- UM PRODUTO ----
  if (produtoId) {
    const item = await a.doProduto(produtoId);
    if (!item) {
      return { saida: { erro: "Não achei esse produto no seu catálogo. Use achar_produto antes." } };
    }
    const p = avaliarPreparacao(item.produto, item.anuncio, { margemMinima });
    return {
      preparacao: { produto: p },
      saida: {
        produtoId: p.produtoId,
        nome: p.nome,
        estado: p.estado,
        frase: escreverEstado(p.estado),
        // As ETAPAS com o que trava cada uma — é isto que permite dizer "o
        // texto eu consigo, o preço não" em vez de tudo ou nada.
        etapas: p.etapas.map((e) => ({
          etapa: e.etapa,
          situacao: e.situacao,
          faltando: e.faltando,
          porque: e.porque,
        })),
        falta: oQueFaltaNaPreparacao(p),
        // A identidade com a ORIGEM de cada atributo: o que veio do cadastro e
        // o que foi LIDO do nome. Apresentar leitura como cadastro seria o
        // começo do mesmo problema que a esteira já teve.
        identidade: p.identidade.map((x) => ({ nome: x.nome, valor: x.valor, origem: x.origem })),
        jaTemAnuncio: p.jaTemAnuncio,
        proximaEtapa: p.proximaEtapa,
        aviso:
          "Preparar não é publicar. Nada vai ao ar por aqui — publicar é outro passo, com outra confirmação.",
      },
    };
  }

  // ---- O CATÁLOGO ----
  const { itens, totalNoCatalogo, truncado } = await a.catalogo();
  const preparacoes = itens.map((i) => avaliarPreparacao(i.produto, i.anuncio, { margemMinima }));
  const selecao = selecionarParaPreparar(preparacoes, totalNoCatalogo);

  return {
    preparacao: { selecao },
    saida: {
      analisados: selecao.analisados,
      podemVirarAnuncio: selecao.elegiveis.length,
      jaPreparados: selecao.jaPreparados,
      // Os motivos AGRUPADOS, do mais comum para o menos. Uma lista de 200 ids
      // não ajuda ninguém a decidir o que resolver primeiro.
      travados: selecao.naoElegiveis.map((n) => ({
        motivo: n.motivo,
        quantos: n.quantos,
        exemplos: n.exemplos,
      })),
      amostraDeElegiveis: selecao.elegiveis.slice(0, 8).map((p) => ({
        produtoId: p.produtoId,
        nome: p.nome,
      })),
      ...(truncado
        ? {
            aviso: `Analisei ${selecao.analisados} de ${totalNoCatalogo} produtos. Diga isso — não afirme que olhou o catálogo inteiro.`,
          }
        : {}),
      comoPreparar:
        "Para cada elegível, chame propor_anuncio com o produtoId. Isso monta o cartão; quem dispara a geração é o lojista, clicando.",
    },
  };
}

/**
 * "Melhore o título."
 *
 * Roda o agente de TÍTULO que já existe (A3 do catálogo de agentes) e devolve
 * ATUAL e PROPOSTO lado a lado. O modelo não escreve o título: ele chama o
 * agente e repassa. E nada é gravado — trocar o título de um anúncio é
 * alteração operacional, então passa por Proposal e clique.
 */
async function proporTitulo(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  const a = ctx.anuncio;
  if (!a?.anuncioParaTitulo || !a.gerarTitulo) {
    return { saida: { erro: "Não consigo mexer em título nesta tela." } };
  }
  const produtoId = texto(args, "produtoId");
  if (!produtoId) return { saida: { montada: false, motivo: "Preciso saber de qual produto." } };

  const alvo = await a.anuncioParaTitulo(produtoId);
  if (!alvo) {
    // Gerar o anúncio inteiro para melhorar um título seria outra intenção,
    // com outro custo. Dizer isso é melhor que fazer sem perguntar.
    return {
      saida: {
        montada: false,
        motivo:
          "Esse produto ainda não tem anúncio gerado — não há título para melhorar. Posso preparar o anúncio primeiro.",
      },
    };
  }

  const item = await a.doProduto(produtoId);
  const gerado = await a.gerarTitulo({
    nome: item?.produto.nome ?? alvo.nome,
    marca: item?.produto.marca ?? "",
    modelo: item?.produto.modelo ?? "",
    tituloAtual: alvo.tituloAtual,
  });
  // O DOMÍNIO decide se o título proposto pode virar proposta — vazio, igual ao
  // atual ou acima dos 60 caracteres do ML são recusas, não opinião do modelo.
  const veredicto = avaliarTituloProposto(gerado?.titulo ?? "", alvo.tituloAtual);
  if (!veredicto.ok) {
    return { saida: { montada: false, motivo: veredicto.motivo } };
  }

  return {
    propostaDeTitulo: {
      anuncioId: alvo.anuncioId,
      produtoId,
      nome: alvo.nome,
      tituloAtual: alvo.tituloAtual,
      tituloProposto: veredicto.titulo,
      justificativa: gerado?.justificativa ?? "",
      autoridade: "nao_se_aplica",
    },
    saida: {
      montada: true,
      tituloAtual: alvo.tituloAtual,
      tituloProposto: veredicto.titulo,
      caracteres: veredicto.titulo.length,
      justificativa: gerado?.justificativa ?? "",
      // Os DOIS lado a lado, sempre. Mostrar só o novo esconderia o que se
      // está perdendo, e trocar título é a coisa mais fácil de piorar sem ver.
      aviso:
        "Mostre o título ATUAL e o PROPOSTO. Nada foi gravado — o lojista confirma clicando.",
    },
  };
}

/**
 * "O que precisa de mim?" e "por que este produto está travado?".
 *
 * Sem `produtoId` devolve o PANORAMA já analisado — quantas pendências, quantas
 * eu preparo sozinho, quantas viram decisão sua. Com `produtoId`, desce até a
 * variante.
 *
 * O modelo recebe NÚMEROS PRONTOS e as decisões já agrupadas. Ele não soma nada:
 * é por esse número que o lojista decide o dia dele.
 */
async function analisarPendencias(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  const a = ctx.analise;
  if (!a) return { saida: { erro: "A análise do catálogo não está disponível nesta tela." } };

  const produtoId = texto(args, "produtoId");

  // ---- DRILL-DOWN: um produto ----
  if (produtoId) {
    const produto = await a.produto(produtoId);
    if (!produto) {
      return { saida: { erro: "Não achei esse produto no seu catálogo. Use achar_produto antes." } };
    }
    const pendencias = pendenciasDoProduto(produto);
    const explicacao = explicarBloqueio(produto, pendencias);
    if (!explicacao) {
      return {
        saida: {
          produtoId: produto.id,
          nome: produto.nome,
          variantes: produto.variantes.length,
          travado: false,
          frase: `${produto.nome} não tem pendência conhecida.`,
        },
      };
    }
    return {
      saida: {
        produtoId: explicacao.produtoId,
        nome: explicacao.nome,
        variantes: explicacao.variantes,
        travado: true,
        // O que trava, POR TIPO e com a contagem de alvos — é o que permite
        // dizer "4 das 6 variantes não têm peso" em vez de "falta peso".
        motivos: explicacao.motivos.map((m) => ({
          o_que: m.tipo,
          alvos: m.quantos,
          impede: m.impede,
          bloqueia: m.bloqueia,
        })),
        capacidadesTravadas: explicacao.travadas,
      },
    };
  }

  // ---- PANORAMA: a loja ----
  const { produtos, totalNoCatalogo, truncado } = await a.catalogo();
  const pendencias = calcularPendencias(produtos);
  const [fontes, conflitos] = await Promise.all([a.fontes(), a.conflitos(produtos)]);
  const plano = planejarResolucao(pendencias, { produtos, fontes, conflitos });
  const p = panorama(plano);

  return {
    // O plano inteiro vai para a TELA (cartão estruturado); o modelo recebe o
    // resumo. Mandar as centenas de alvos ao modelo estouraria contexto e não
    // ajudaria ninguém a decidir.
    pendencias: { plano, totalNoCatalogo, truncado },
    saida: {
      analisadas: p.analisadas,
      semNovoDado: p.semNovoDado,
      decisoes: p.decisoes,
      alvosDasDecisoes: p.alvosDasDecisoes,
      conflitos: p.conflitos,
      bloqueadas: p.bloqueadas,
      nadaAFazer: p.nadaAFazer,
      produtosAnalisados: produtos.length,
      ...(truncado
        ? {
            aviso: `Analisei ${produtos.length} de ${totalNoCatalogo} produtos. Diga isso ao lojista — não afirme que olhou o catálogo inteiro.`,
          }
        : {}),
      // As decisões JÁ AGRUPADAS e na ordem de impacto. É esta lista que vira
      // "preciso de 3 decisões suas".
      decisoesAgrupadas: plano.decisoes.slice(0, 6).map((d) => ({
        id: d.id,
        pergunta: d.pergunta,
        alvos: d.quantos,
        destrava: d.destrava,
        bloqueia: d.bloqueia,
        // Compartilhável = UMA resposta serve para todos. Não compartilhável =
        // uma pergunta, N respostas. A diferença muda o que se pede.
        umaRespostaServeParaTodos: d.escopo === "valor_compartilhado",
      })),
      preparaveis: plano.preparaveis.slice(0, 6).map((x) => ({
        alvo: x.produtoId,
        resumo: x.resumo,
        variantes: x.alvos.length,
      })),
      conflitosDetalhados: plano.conflitos.slice(0, 6).map((c) => ({
        campo: c.campo,
        alvo: c.alvo.rotulo,
        explicacao: c.explicacao,
      })),
      bloqueadasDetalhe: plano.bloqueadas,
      ...(plano.consultaveis.length === 0
        ? {
            fontes:
              "Nenhuma fonte conectada declara saber custo ou estoque. NÃO prometa buscar esses dados em ERP.",
          }
        : { fontes: plano.consultaveis }),
    },
  };
}

/**
 * "De onde veio esse custo?"
 *
 * Devolve o TEXTO montado pelo domínio. A diferença entre "origem não
 * registrada" e "veio da planilha" é a diferença entre honestidade e invenção,
 * e ela não pode depender de como o modelo resolveu escrever a frase.
 */
async function consultarProcedencia(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  const a = ctx.analise;
  if (!a) return { saida: { erro: "A consulta de procedência não está disponível nesta tela." } };

  const produtoId = texto(args, "produtoId");
  const varianteId = texto(args, "varianteId");
  const campo = texto(args, "campo");
  if (!produtoId || !campo) {
    return { saida: { erro: "Preciso do produto e do campo." } };
  }

  const produto = await a.produto(produtoId);
  if (!produto) {
    return { saida: { erro: "Não achei esse produto no seu catálogo." } };
  }
  const alvo = varianteId
    ? ({ tipo: "variante", id: varianteId } as const)
    : ({ tipo: "produto", id: produtoId } as const);

  const historico = await a.procedencia(alvo, campo);
  const rotulo = varianteId
    ? `${produto.nome} (variante)`
    : produto.nome;

  return {
    procedencia: historico,
    saida: {
      // A FRASE vem pronta. O modelo repassa; ele não decide se pode chutar.
      frase: explicarHistorico(historico, rotulo),
      campo: historico.campo,
      valorAtual: historico.valorAtual,
      origemRegistrada: !historico.anteriorAoRegistro,
      anteriores: historico.anteriores.length,
      ...(historico.anteriorAoRegistro
        ? {
            aviso:
              "A origem NÃO foi registrada. Diga exatamente isso. Não sugira de onde o valor 'provavelmente' veio.",
          }
        : {}),
    },
  };
}

/**
 * Monta a correção que não precisa perguntar valor a ninguém.
 *
 * REUSA O LOTE DE PESO inteiro: o mesmo `montarEscopo`, o mesmo cartão, a mesma
 * Proposal com escopo congelado, a mesma revalidação e a mesma reserva atômica.
 * Não existe segundo caminho de escrita — existe um alvo novo para o caminho
 * que já estava provado.
 */
async function prepararResolucao(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  const a = ctx.analise;
  if (!a) return { saida: { erro: "A análise do catálogo não está disponível nesta tela." } };

  const produtoId = texto(args, "alvo");
  const produto = produtoId ? await a.produto(produtoId) : null;
  if (!produto) {
    return { saida: { montada: false, motivo: "Não achei esse produto no seu catálogo." } };
  }

  const valor = pesoConhecidoDoProduto(produto);
  if (valor === null) {
    // Ou não há peso nenhum, ou as irmãs discordam. Nos dois casos, perguntar.
    return {
      saida: {
        montada: false,
        motivo:
          "Não consigo preparar sozinho: as variantes deste produto ou não têm peso, ou têm pesos diferentes entre si. Pergunte o peso ao lojista.",
      },
    };
  }
  const faltando = variantesSemPeso(produto);
  if (faltando.length === 0) {
    return { saida: { montada: false, motivo: "Todas as variantes deste produto já têm peso." } };
  }

  const escopo = montarEscopo(
    "peso",
    [
      {
        id: produto.id,
        nome: produto.nome,
        unidades: produto.variantes.length,
        unidadesSemDado: faltando.length,
        valorAtual: null,
      },
    ],
    valor,
    (v) => `${v} g`
  );

  return {
    // `derivadoDoPesoConhecido` porque `valor` acabou de sair de
    // `pesoConhecidoDoProduto`: ele SÓ existe enquanto as irmãs concordarem. Se
    // uma delas mudar entre a proposta e o clique, o número perde a origem que
    // o justificou — e a rota precisa saber disso para congelá-la. Ver INC-002.
    escopo: { ...escopo, campo: "peso", valor, derivadoDoPesoConhecido: true, autoridade: "derivado" },
    saida: {
      montada: true,
      resumo: escopo.resumo,
      variantesAfetadas: faltando.length,
      valorGramas: valor,
      deOnde: "das outras variantes deste mesmo produto, que já estão com esse peso",
      aviso:
        "Preparei sem te perguntar o valor — mas NADA foi gravado. O lojista confirma clicando.",
    },
  };
}

/**
 * O cadastro em conversa — todas as operações, num lugar só.
 *
 * O modelo escolhe a OPERAÇÃO; o domínio decide se ela é válida. Nenhuma
 * transição depende de o modelo ter dito que o cadastro está pronto: prontidão
 * é `validarRascunho` sobre a conversão, e nada mais.
 *
 * Toda saída aqui é TEXTO E CONTAGEM para o modelo ler — o Draft inteiro nunca
 * atravessa. Ele voltaria depois numa frase, com um valor a mais que ninguém
 * disse.
 */
async function gerenciarCadastro(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  const c = ctx.cadastro;
  if (!c) {
    return { saida: { erro: "O cadastro em conversa não está disponível nesta tela." } };
  }
  const operacao = texto(args, "operacao");

  // ---- retomar e escolher NÃO exigem Draft aberto: eles é que o encontram ----
  if (operacao === "retomar") {
    const r = escolherParaRetomar(c.abertos, texto(args, "dica"));
    if (r.desfecho === "nenhum") {
      return { saida: { retomado: false, motivo: "Você não tem nenhum cadastro em andamento." } };
    }
    if (r.desfecho === "unico") {
      return {
        cadastro: { draft: r.draft },
        saida: { retomado: true, cadastro: comoResumo(r.draft) },
      };
    }
    // VÁRIOS: mostra e pergunta. Escolher aqui gravaria os fatos do produto
    // certo no cadastro errado, e ninguém veria isso acontecer.
    const conjunto = apresentar(
      "cadastros",
      r.candidatos.map((k) => ({ tipo: "cadastro" as const, id: k.id, rotulo: k.rotulo }))
    );
    return {
      cadastro: { draft: c.draft ?? c.abertos[0], apresentou: conjunto },
      saida: {
        retomado: false,
        mensagem: r.mensagem,
        opcoes: conjunto.itens.map((i) => ({ ordem: i.ordem, rotulo: i.rotulo })),
        aviso: "PERGUNTE qual. Não escolha por ele.",
      },
    };
  }

  if (operacao === "escolher") {
    const escolhido = resolverEscolha(texto(args, "escolha"), c.referencias);
    if (!escolhido.ok) return { saida: { escolhido: false, motivo: escolhido.motivo } };
    if (escolhido.item.tipo === "cadastro") {
      const draft = c.abertos.find((d) => d.id === escolhido.item.id);
      if (!draft) {
        return { saida: { escolhido: false, motivo: "Esse cadastro não está mais em andamento." } };
      }
      return {
        cadastro: { draft },
        saida: { escolhido: true, cadastro: comoResumo(draft) },
      };
    }
    // Um PRODUTO escolhido no meio de uma possível duplicidade. O cadastro não
    // vira uma edição daquele produto: completar um produto existente a partir
    // de um Draft é outro caminho de escrita, e ele não existe. Dizer isso é
    // melhor que fingir que funcionou.
    return {
      saida: {
        escolhido: true,
        tipo: "produto",
        produtoId: escolhido.item.id,
        rotulo: escolhido.item.rotulo,
        aviso:
          "Eu não sei completar um produto que já existe a partir deste cadastro. Se for o mesmo produto, abra ele; se for outro, seguimos com o cadastro novo.",
      },
    };
  }

  if (operacao === "iniciar") {
    // Um cadastro aberto NESTA conversa é reusado. Duas chamadas de "iniciar"
    // no mesmo fio são o modelo se repetindo, não o lojista querendo dois
    // produtos — e dois Drafts abertos fariam a próxima frase virar uma pergunta
    // de desambiguação sem motivo.
    const draft = c.draft ?? c.novo();
    return {
      cadastro: { draft },
      saida: {
        cadastro: comoResumo(draft),
        aviso: "Nada foi criado. Peça o que ele já sabe sobre o produto.",
      },
    };
  }

  const draft = c.draft;
  if (!draft) {
    return {
      saida: { erro: 'Nenhum cadastro em andamento. Use a operação "iniciar" antes.' },
    };
  }

  switch (operacao) {
    case "resumo":
      return { saida: { cadastro: comoResumo(draft) } };

    case "cancelar": {
      const r = cancelar(draft, c.agoraISO);
      if (!r.ok) return { saida: { cancelado: false, motivo: r.motivo } };
      return {
        cadastro: { draft: r.draft, cancelou: true },
        saida: { cancelado: true, mensagem: "Cadastro cancelado. Nada foi criado." },
      };
    }

    case "informar": {
      const campo = texto(args, "campo");
      if (!ehCampoDoCadastro(campo)) {
        return { saida: { registrado: false, motivo: `Não sei guardar "${campo}".` } };
      }
      const r = informar(
        draft,
        campo,
        texto(args, "valor"),
        // SEMPRE `informado`: esta operação existe para o que o LOJISTA DISSE.
        // Um caminho que aceitasse `inferido` daqui seria a porta pela qual o
        // modelo gravaria um custo deduzido — e `aceitarFato` recusaria, mas a
        // porta não deve existir.
        "informado",
        c.agoraISO,
        texto(args, "unidade")
      );
      if (!r.ok) {
        return {
          // Mesmo recusando, o Draft pode ter mudado: um conflito aberto é
          // estado que precisa sobreviver ao turno para a pergunta fazer sentido.
          ...(r.draft ? { cadastro: { draft: r.draft } } : {}),
          saida: {
            registrado: false,
            motivo: r.motivo,
            ...(r.conflito ? { conflito: true } : {}),
          },
        };
      }
      return await comPossivelDuplicidade(r.draft, c, {
        registrado: true,
        campo,
        ...(r.unidadeDeduzida ? { unidadeDeduzida: true } : {}),
      });
    }

    case "variantes": {
      const r = definirGrade(
        draft,
        { cores: lista(args, "cores"), tamanhos: lista(args, "tamanhos") },
        c.agoraISO
      );
      if (!r.ok) return { saida: { montada: false, motivo: r.motivo } };
      return await comPossivelDuplicidade(r.draft, c, { montada: true, variantes: r.total });
    }

    case "identificador": {
      const campo = texto(args, "campo");
      if (campo !== "sku" && campo !== "ean") {
        return { saida: { associado: false, motivo: "Só associo SKU ou EAN a uma variante." } };
      }
      const r = associarNaVariante(
        draft,
        campo,
        texto(args, "valor"),
        { cor: texto(args, "cor") || undefined, tamanho: texto(args, "tamanho") || undefined },
        c.agoraISO
      );
      if (!r.ok) {
        return {
          saida: {
            associado: false,
            motivo: r.motivo,
            ...(r.candidatos ? { candidatos: r.candidatos } : {}),
            aviso: "PERGUNTE de qual variante é. Não escolha.",
          },
        };
      }
      return await comPossivelDuplicidade(r.draft, c, { associado: true, variante: r.variante });
    }

    case "resolver_conflito": {
      const campo = texto(args, "campo");
      if (!ehCampoDoCadastro(campo)) {
        return { saida: { resolvido: false, motivo: `Não sei guardar "${campo}".` } };
      }
      const escolha = texto(args, "conflito") === "novo" ? "novo" : "atual";
      const r = resolverConflito(draft, campo, escolha, c.agoraISO);
      if (!r.ok) return { saida: { resolvido: false, motivo: r.motivo } };
      return { cadastro: { draft: r.draft }, saida: { resolvido: true, cadastro: comoResumo(r.draft) } };
    }

    case "propor_criacao": {
      // ABERTO ANTES DE PRONTO. Um cadastro cancelado continua tendo nome, SKU
      // e preço — `prontidao` olha os campos e diria que está pronto. Sem esta
      // linha, "esquece esse cadastro" seguido de "pode criar" montaria uma
      // Proposal para um cadastro que o lojista abandonou.
      if (!draftEstaAberto(draft)) {
        return {
          saida: {
            proposta: false,
            motivo: `Esse cadastro está ${draft.status} — não dá para criar a partir dele.`,
          },
        };
      }
      const p = prontidao(draft);
      if (!p.pronto) {
        // NÃO monta uma Proposal que a revalidação recusaria depois do clique.
        // "Clique aqui para falhar" é pior que não oferecer o botão.
        return {
          saida: {
            proposta: false,
            motivo: "Esse cadastro ainda não está completo.",
            falta: comoResumo(draft).falta,
          },
        };
      }

      // A BUSCA DE AGORA, não a do começo da conversa. É este conjunto que a
      // Proposal congela — e é contra ele que a confirmação revalida.
      const { candidatos: achados, ids } = await procurarCandidatos(draft, c);
      const preco = numeroDe(draft, "precoVenda") ?? 0;
      const resumo = resumoDaCriacao(draft);

      return {
        cadastro: {
          draft,
          proporCriacao: {
            resumo,
            valor: centavosParaReais(preco),
            precondicoes: precondicoesDeCadastro(ids),
            autoridade: "nao_se_aplica",
          },
          ...(achados.length > 0
            ? {
                candidatos: achados,
                candidatosMensagem:
                  "Ainda existem produtos que podem corresponder a este cadastro. Confira antes de criar.",
              }
            : {}),
        },
        saida: {
          proposta: true,
          resumo,
          possiveisExistentes: achados.length,
          aviso:
            "Mostre o resumo e diga que o produto só será criado quando ele clicar. Não afirme que já foi criado.",
        },
      };
    }

    default:
      return { saida: { erro: `Operação desconhecida: ${operacao}` } };
  }
}

/**
 * Roda a busca de possíveis duplicatas — quando os fatos já a justificam.
 *
 * Sem porto de busca (tela que não passa o contexto de servidor) devolve vazio,
 * e o cadastro segue. Isso NÃO é inseguro: a revalidação da confirmação roda no
 * servidor de qualquer jeito, e é ela que impede a duplicata de verdade.
 */
async function procurarCandidatos(
  draft: DraftDeCadastro,
  c: ContextoDoCadastro
): Promise<{ candidatos: ReturnType<typeof candidatoEnxuto>[]; ids: string[]; mensagem: string }> {
  const tentativas = tentativasDoCadastro(draft);
  if (tentativas.length === 0 || !c.buscarCandidatos) {
    return { candidatos: [], ids: [], mensagem: "" };
  }
  const porTentativa = await c.buscarCandidatos(tentativas);
  const { linhas, casamento } = unirAchados(porTentativa);
  const termo = rotuloDoDraft(draft);
  const d = avaliarDuplicidade(linhas, casamento, termo);
  if (d.desfecho === "nenhum") return { candidatos: [], ids: [], mensagem: "" };
  return {
    candidatos: d.candidatos.map(candidatoEnxuto),
    ids: linhas.map((l) => l.produtoId),
    mensagem: d.mensagem,
  };
}

/**
 * Junta o resultado da operação com a busca por possíveis duplicatas.
 *
 * A busca acontece a cada fato novo porque é a chegada do fato que a torna
 * possível: sem referência nem SKU não há o que procurar, e o momento em que
 * eles chegam é o momento útil de avisar. Avisar só no fim faria o lojista
 * descrever seis variantes antes de descobrir que o produto já existia.
 */
async function comPossivelDuplicidade(
  draft: DraftDeCadastro,
  c: ContextoDoCadastro,
  saidaBase: Record<string, unknown>
): Promise<ResultadoDaFerramenta> {
  const { candidatos: achados, mensagem } = await procurarCandidatos(draft, c);
  const conjunto =
    achados.length > 0
      ? apresentar(
          "duplicidade",
          achados.map((a) => ({
            tipo: "produto" as const,
            id: a.produtoId,
            rotulo: [a.marca, a.nome, a.referencia].filter(Boolean).join(" "),
          }))
        )
      : undefined;

  return {
    cadastro: {
      draft,
      ...(conjunto ? { apresentou: conjunto } : {}),
      ...(achados.length > 0 ? { candidatos: achados, candidatosMensagem: mensagem } : {}),
    },
    saida: {
      ...saidaBase,
      cadastro: comoResumo(draft),
      ...(achados.length > 0
        ? {
            possiveisExistentes: {
              mensagem,
              // NUNCA fundir e NUNCA escolher: nesta base SKU, EAN e modelo se
              // repetem legitimamente, e casamento exato não é identidade.
              aviso:
                "Casamento exato NÃO é o mesmo produto. Mostre os candidatos e pergunte se é algum deles.",
              candidatos: achados,
            },
          }
        : {}),
    },
  };
}

/** Uma lista de strings vinda do modelo, limpa do que não é string. */
function lista(args: Record<string, unknown>, chave: string): string[] {
  const v = args[chave];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

/**
 * O produto do servidor, na forma que `montarPropostaDeAnuncio` espera.
 *
 * A conversão vive aqui e não no orquestrador porque é uma ponte entre dois
 * tipos que existem por razões diferentes — e `dadosDoProduto` já sabe extrair
 * cores e tamanhos da grade real.
 */
function paraAnunciarDoServidor(item: {
  produto: ProdutoParaPreparar;
  anuncio: AnuncioJaGerado | null;
}): ProdutoParaAnunciar {
  const { produto, anuncio } = item;
  return {
    id: produto.id,
    nome: produto.nome,
    estado: {
      custo: produto.custo,
      precoVenda: produto.precoVenda,
      pesoGramas: produto.pesoGramas,
      temFoto: produto.quantidadeImagens > 0,
      ...(produto.vendedorPagaFrete === false ? { vendedorPagaFrete: false } : {}),
    },
    dados: dadosDoProduto(produto),
    jaTemAnuncio: Boolean(anuncio),
  };
}

function alvoPeloId(
  id: string,
  produtos: readonly ProdutoAlvo[]
): { id: string; nome: string } | null {
  const p = produtos.find((x) => x.id === id);
  return p ? { id: p.id, nome: p.nome } : null;
}

function mensagemDaRecusa(p: Proposta): string {
  if (p.tipo === "pronta") return "";
  if (p.tipo === "ambigua") return p.mensagem;
  return p.mensagem;
}
