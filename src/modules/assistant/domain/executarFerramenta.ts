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
import type { PedidoCongelado } from "./propostaDePublicacao";
import type { VendasNoServidor } from "@/lib/services/vendasNoServidor";
import type { ComparacaoDeLojas } from "@/lib/services/comparacaoDeLojas";
import type { DiagnosticoNoServidor } from "@/lib/services/diagnosticoNoServidor";
import { retratoDosAnuncios } from "@/modules/publication/domain/anunciosNoAr";
import { filaDeCorrecao, type LinhaDaFila } from "@/modules/publication/domain/filaDeCorrecao";
import { podeCorrigirTitulo } from "@/modules/publication/domain/correcaoNoAnuncio";
import { limiteDoTituloNoCanal } from "@/modules/publication/domain/regrasDoCanal";
import { habilidades, lacunaPorAssunto, lacunas } from "@/modules/assistant/domain/habilidades";
import {
  motivoDeParar,
  podeContinuar,
  type Investigacao,
} from "@/modules/assistant/domain/investigacao";
import { fraseDaFamilia, retratoDaFamilia } from "@/modules/publication/domain/familiaNoMarketplace";
import type { LeituraDeFamilias } from "@/lib/marketplaces/mercadolivre";
import {
  gradesDosProdutos,
  LACUNA_DA_FAMILIA,
  referenciasRepetidas,
} from "@/modules/publication/domain/gradeNoMarketplace";
import { perfilEstaVazio, proibidasPresentes, type PerfilDeConteudo } from "./perfilDeConteudo";
import { normalizarTarefas, type TarefaProposta } from "./propostaDeTarefas";
import { lerSlot } from "./briefingDeImagem";
import type { PedidoDeImagem } from "./propostaDeImagem";
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
  avaliarDescricaoProposta,
  avaliarPalavrasChave,
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
   * AS VENDAS, em porto — a leitura vai ao Mercado Livre com a credencial do
   * servidor, e só quem pergunta de venda paga por ela. Ausente = a rota não
   * ofereceu (sem integração configurada), e a ferramenta diz isso.
   */
  vendas?: (dias: 7 | 14 | 30 | 60 | 90) => Promise<VendasNoServidor>;
  /** A comparação entre as lojas do alcance — só agência/equipe recebem o porto. */
  comparar?: () => Promise<ComparacaoDeLojas>;
  /** O diagnóstico de um anúncio no ML — visitas, vendas, saúde. */
  diagnostico?: (produtoId: string, precoMinimo: number | null) => Promise<DiagnosticoNoServidor>;
  /**
   * A INVESTIGAÇÃO em andamento nesta conversa — o trabalho que não coube num
   * turno. Quem fecha a rodada é a ROTA, no fim do turno: o achado é a própria
   * resposta que a lojista leu, e o modelo não deveria pagar um passo para
   * repeti-la.
   */
  investigacao?: {
    atual: Investigacao | null;
    abrir: (pergunta: string, proximoPasso: string) => Promise<Investigacao | null>;
    anotar: (proximoPasso: string) => void;
    concluir: () => void;
  };
  /**
   * O TÍTULO QUE ESTÁ NO AR — leitura viva no Mercado Livre.
   *
   * Existe porque o cartão precisa mostrar o que o COMPRADOR vê agora, e não o
   * título do catálogo do Zion: os dois divergirem é justamente o caso que a
   * correção conserta. `null` = produto sem anúncio publicado nesta loja.
   */
  tituloNoAr?: (produtoId: string) => Promise<{
    anuncioId: string;
    mlb: string;
    titulo: string;
    permalink: string | null;
  } | null>;
  /**
   * A FAMÍLIA DOS ANÚNCIOS NO ML — leitura viva, e a lacuna que ela fecha.
   *
   * Até 24/08/2026 o Copilot respondia "não sei se estão agrupados", e estava
   * certo: o vínculo de família chega na importação e não é guardado em lugar
   * nenhum do banco. Mas "não guardo" não é "não dá para saber" — o ML devolve
   * `family_name` e `user_product_id`, e 20 itens cabem numa chamada.
   *
   * Opcional: sem credencial no servidor o porto não é montado e a ferramenta
   * volta a dizer a lacuna, em vez de inventar veredito.
   */
  familiaNoAr?: (produtoId: string) => Promise<LeituraDeFamilias | null>;
  /**
   * O SINAL de pedido sem capacidade — gravado quando a conferência encontra
   * uma lacuna. Opcional: sem ele a resposta honesta continua saindo, só não
   * fica registrada.
   */
  registrarLacuna?: (assunto: string, pedido: string) => Promise<void>;
  /**
   * As linhas de anúncio da loja — o INSUMO das duas leituras de marketplace.
   *
   * Um porto só, e não dois, porque "quantos estão no ar" e "o que fazer com os
   * que não estão" leem exatamente as mesmas linhas. As contas são do domínio
   * (`retratoDosAnuncios`, `filaDeCorrecao`); o porto só traz o dado, medido
   * (050/051) e com a data — não o ML ao vivo, que não cabe no turno.
   */
  noAr?: () => Promise<LinhaDaFila[]>;
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
  /**
   * A CONFIGURAÇÃO do lojista: a margem mínima e os custos dele.
   *
   * Vive aqui e não num contexto próprio porque é entrada do MESMO cálculo:
   * Simples Nacional, comissão do gestor, custo do ERP, embalagem, etiqueta e
   * cupom entram em toda conta de preço que este módulo faz.
   *
   * Até 10/08/2026 nenhuma ferramenta os alcançava. Eles se acertavam em duas
   * telas — Configurações e Precificação — e quem não abrisse nenhuma das duas
   * recebia todo número do software calculado sobre valores que nunca conferiu.
   */
  configuracao: () => Promise<{
    margemMinima: number;
    custos: {
      embalagem: number;
      etiqueta: number;
      informativos: number;
      impostoPercentual: number;
      comissaoGestorPercentual: number;
      comissaoSistemaPercentual: number;
      cupomPercentual: number;
    };
  }>;
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
    /** O ajuste pedido ("deixa mais curto"). Ver `EntradaDoTitulo`. */
    instrucao?: string;
    /** O motivo da retentativa única (a recusa do juiz). */
    retentativaPor?: string;
  }) => Promise<{ titulo: string; justificativa: string } | null>;
  /** O anúncio cujo título se quer melhorar. `null` = não existe anúncio. */
  anuncioParaTitulo?: (produtoId: string) => Promise<{
    anuncioId: string;
    nome: string;
    tituloAtual: string;
    /** O canal do anúncio — decide o limite do título. Omitido = ML. */
    marketplace?: string;
  } | null>;

  /**
   * O TEXTO do anúncio — descrição e palavras-chave de hoje.
   *
   * Um porto só para os dois, e não dois portos: eles vêm da mesma linha de
   * `anuncios_gerados`, e separá-los faria duas leituras do mesmo registro
   * para responder uma pergunta.
   */
  textoDoAnuncio?: (produtoId: string) => Promise<{
    anuncioId: string;
    nome: string;
    descricaoAtual: string;
    palavrasAtuais: readonly string[];
  } | null>;
  gerarDescricao?: (entrada: {
    nome: string;
    marca: string;
    modelo: string;
    atual: string;
    /** O ajuste pedido ("deixa mais curta"). Ver `EntradaDoTexto`. */
    instrucao?: string;
  }) => Promise<{ descricao: string; justificativa: string } | null>;
  /**
   * O que subiria se ela publicasse AGORA — o ensaio, sem tocar no ML.
   *
   * `null` quando não há anúncio preparado. O payload é o mesmo que a
   * publicação real montaria (`montarPreviewML`), porque mostrar um resumo
   * feito à parte seria mostrar uma coisa e publicar outra.
   */
  /** O perfil de conteúdo da loja — para o juiz recusar palavra proibida. */
  perfil?: () => Promise<PerfilDeConteudo>;
  ensaioDaPublicacao?: (produtoId: string) => Promise<{
    anuncioId: string;
    nome: string;
    titulo: string;
    preco: number | null;
    estoque: number | null;
    fotos: number;
    categoria: string;
    /** Já publicado? Então não há o que publicar. */
    jaPublicado: boolean;
    mlItemId: string | null;
    /**
     * O PEDIDO INTEIRO, como foi ensaiado — é o que a Proposal congela e a
     * confirmação publica. Sem ele não há proposta, só resposta.
     */
    congelado?: PedidoCongelado;
  } | null>;
  /**
   * A tabela de medidas do produto, com a PROCEDÊNCIA dela.
   *
   * `null` quando o produto não existe. `fonte` diz de onde veio — override da
   * lojista, tabela da marca, ou o padrão BR — porque as três têm autoridade
   * diferente e ela precisa saber qual está lendo.
   */
  medidasDoProduto?: (produtoId: string) => Promise<{
    nome: string;
    marca: string;
    tabela: string;
    comoMedir: string;
    confiavel: boolean;
    oficial: boolean;
    fonte: "override" | "marca" | "padrao" | "vazio";
  } | null>;
  gerarPalavras?: (entrada: {
    nome: string;
    marca: string;
    modelo: string;
    atuais: readonly string[];
  }) => Promise<{ palavras: string[]; justificativa: string } | null>;
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
  /**
   * Uma ação REVERSÍVEL a executar — pedido, não execução.
   *
   * `executarFerramenta` continua PURO: ele não fala com o Mercado Livre, não
   * tem token e não toca em rede. Quem executa é a rota, com o tenant da
   * sessão — a mesma divisão que já vale para persistir conversa e proposta.
   *
   * Manter a pureza aqui não é elegância: é o que permite testar a decisão do
   * modelo sem subir nada, e é o que impede que um turno estranho alcance o
   * marketplace por um caminho que ninguém revisou.
   */
  acao?: { tipo: "reativar"; mlb: string };
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
  /**
   * A proposta de TEXTO — descrição ou palavras-chave.
   *
   * Um tipo para os dois, com `campo` discriminando, e não dois tipos: eles
   * gravam na MESMA linha de `anuncios_gerados` e percorrem o mesmo caminho de
   * confirmação. Duplicar o tipo duplicaria também a persistência e a rota que
   * aplica — e é ali que a divergência apareceria.
   */
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
    /** O pedido congelado — vai para a Proposal, não para a tela. */
    congelado?: PedidoCongelado;
  };
  /** A lista de tarefas a criar — a tela mostra; a Proposal congela. */
  propostaDeTarefas?: { tarefas: TarefaProposta[]; cortadas: number };
  /** O pedido de imagem — a tela mostra o que vai gerar; a Proposal congela. */
  propostaDeImagem?: PedidoDeImagem;
  propostaDeTexto?: {
    campo: "descricao" | "palavras_chave";
    anuncioId: string;
    produtoId: string;
    nome: string;
    /** O que está lá hoje. Lista, quando o campo é palavras-chave. */
    atual: string;
    /** O que se propõe. Para palavras-chave, os termos NOVOS, já limpos. */
    proposto: string;
    justificativa: string;
    autoridade: "nao_se_aplica";
  };
  propostaDeTitulo?: {
    /** Muda o anúncio NO AR, não o catálogo. A tela precisa avisar. */
    noMarketplace?: boolean;
    mlb?: string;
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
    case "reativar_anuncio": {
      const mlb = texto(args, "mlb").trim().toUpperCase().replace(/-/g, "");
      // Sem MLB não há ação. Devolver erro é melhor que reativar "o anúncio
      // que der" — e o modelo lê a saída e pergunta de novo.
      if (!/^MLB\d+$/.test(mlb)) {
        return {
          saida: {
            erro: "Preciso do código MLB do anúncio para reativar.",
            comoResponder: "Peça o MLB, ou liste os pausados e pergunte qual.",
          },
        };
      }
      return {
        saida: {
          pedido: `reativar ${mlb}`,
          comoResponder:
            "A reativação foi PEDIDA, não confirmada. Diga que pediu e que o resultado aparece a seguir — não afirme que o anúncio já está no ar.",
        },
        acao: { tipo: "reativar", mlb },
      };
    }

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

    case "meus_custos": {
      if (!ctx.preco?.configuracao) {
        return { saida: { erro: "Não consigo ler seus custos por aqui agora." } };
      }
      const cfg = await ctx.preco.configuracao();
      const k = cfg.custos;

      // OS DOIS TIPOS SEPARADOS, e a separação não é estética.
      //
      // Percentual e valor fixo pesam de formas opostas: 12% de imposto dobra
      // em reais quando o preço dobra; R$ 0,50 de embalagem é o mesmo em toda
      // venda e pesa MUITO mais num chinelo de R$ 50 do que num tênis de
      // R$ 300. Somar os dois num número só esconderia justamente a diferença
      // que decide onde a margem aperta.
      const emPercentual = [
        { nome: "imposto", valor: k.impostoPercentual },
        { nome: "comissão do gestor", valor: k.comissaoGestorPercentual },
        { nome: "comissão do sistema", valor: k.comissaoSistemaPercentual },
        { nome: "cupom", valor: k.cupomPercentual },
      ].filter((x) => x.valor > 0);
      const emReais = [
        { nome: "embalagem", valor: k.embalagem },
        { nome: "etiqueta", valor: k.etiqueta },
        { nome: "informativos", valor: k.informativos },
      ].filter((x) => x.valor > 0);

      const somaPercentual = emPercentual.reduce((t, x) => t + x.valor, 0);
      const somaReais = emReais.reduce((t, x) => t + x.valor, 0);

      return {
        saida: {
          margemMinima: cfg.margemMinima,
          emPercentual,
          emReais,
          somaPercentual,
          somaReais,
          // ZERADO É UM FATO, e diferente de "não informado".
          //
          // O domínio normaliza ausência para 0, então daqui não dá para
          // distinguir "ela não paga imposto" de "ninguém preencheu". Dizer
          // isso é o serviço; afirmar que ela não paga seria inventar.
          tudoZerado: somaPercentual === 0 && somaReais === 0,
          aviso:
            "Estes valores entram em TODA conta de preço. Onde estiverem zerados, o cálculo assume que ela não paga aquilo — e um custo esquecido faz a margem parecer melhor do que é. " +
            "Para trocar, ela ajusta em Configurações; o chat ainda não grava isto.",
        },
      };
    }

    case "procedencia":
      return consultarProcedencia(args, ctx);

    case "vendas_da_loja":
      return consultarVendas(args, ctx);

    case "comparar_lojas":
      return compararAsLojas(ctx);

    case "anuncios_ativos":
      return listarAnunciosNoAr(ctx);

    case "anuncios_a_corrigir":
      return listarFilaDeCorrecao(ctx);

    case "diagnostico_de_agrupamento":
      return diagnosticarGrade(args, ctx);

    case "o_que_eu_consigo":
      return conferirHabilidade(args, ctx);

    case "investigar":
      return conduzirInvestigacao(args, ctx);

    case "diagnostico_do_anuncio": {
      const produtoId = texto(args, "produtoId");
      if (!produtoId) return { saida: { montada: false, motivo: "Preciso saber de qual produto." } };
      if (!ctx.diagnostico) return { saida: { erro: "Não consigo ler o Mercado Livre por aqui agora." } };
      // O preço mínimo do Zion, quando o motor consegue calcular — para a
      // leitura dizer "vende no prejuízo" com base, não com palpite.
      let precoMinimo: number | null = null;
      try {
        const pr = ctx.preco ? await ctx.preco.doProduto(produtoId) : null;
        // O menor preço que ainda entrega a margem mínima — a mesma conta de
        // `pricing`. Sem custo/peso, `null`, e a leitura não fala de prejuízo.
        precoMinimo = pr ? situacaoDoPreco(pr.entradas).minimoNaMargem : null;
      } catch {
        precoMinimo = null;
      }
      const r = await ctx.diagnostico(produtoId, precoMinimo);
      if (!r.ok) return { saida: { erro: r.mensagem, motivo: r.motivo, comoResponder: "Diga o motivo como está. Não estime visitas nem vendas." } };
      return {
        saida: {
          mlb: r.mlb,
          titulo: r.titulo,
          permalink: r.permalink,
          ...r.diagnostico,
          comoResponder:
            "Comece pela LEITURA (o eixo), depois os FATOS exatamente como estão, depois as recomendações em ordem — e feche com o que você não sabe. Se o eixo for exposição, ofereça propor_titulo; se for conversão, ofereça pricing e propor_imagem/propor_descricao. Nunca proponha título para um problema de conversão.",
        },
      };
    }

    case "propor_imagem": {
      const produtoId = texto(args, "produtoId");
      const slot = lerSlot(args.slot);
      if (!produtoId) return { saida: { montada: false, motivo: "Preciso saber de qual produto." } };
      if (!slot) return { saida: { montada: false, motivo: "Preciso saber qual imagem: capa, infográfico, detalhe, medidas, humanizada ou benefícios." } };
      const item = await ctx.anuncio?.doProduto(produtoId);
      if (!item) return { saida: { montada: false, motivo: "Não achei esse produto." } };
      if (item.produto.quantidadeImagens === 0) {
        return { saida: { montada: false, motivo: "Esse produto ainda não tem foto. A IA melhora uma foto real — ela não inventa o produto. Peça para ele enviar a foto primeiro." } };
      }
      const paiVersaoId = texto(args, "paiVersaoId");
      const feedback = texto(args, "feedback").slice(0, 400);
      const pedido: PedidoDeImagem = {
        versao: 1,
        produtoId,
        produtoNome: item.produto.nome,
        slot,
        instrucao: texto(args, "instrucao").slice(0, 400),
        ...(paiVersaoId ? { paiId: paiVersaoId } : {}),
        ...(feedback ? { feedback } : {}),
        ...(texto(args, "beneficios") ? { beneficios: texto(args, "beneficios").slice(0, 600) } : {}),
      };
      return {
        propostaDeImagem: pedido,
        saida: {
          montada: true,
          slot,
          ...(paiVersaoId ? { ajusteDaVersao: paiVersaoId } : {}),
          comoResponder: "NADA foi gerado. Diga que o pedido está no cartão para ele confirmar, e que a imagem gerada fica como rascunho até ele aprovar. Não descreva a imagem que ainda não existe.",
        },
      };
    }

    case "propor_tarefas": {
      const { tarefas, cortadas } = normalizarTarefas(args.tarefas);
      if (tarefas.length === 0) {
        return { saida: { montada: false, motivo: "Preciso de pelo menos uma tarefa com título." } };
      }
      return {
        propostaDeTarefas: { tarefas, cortadas },
        saida: {
          montada: true,
          quantas: tarefas.length,
          ...(cortadas > 0 ? { aviso: `Só as 10 primeiras entraram; ${cortadas} ficaram de fora.` } : {}),
          comoResponder: "NADA foi criado. Diga que a lista está no cartão para ele confirmar. Não repita a lista no texto — o cartão já mostra.",
        },
      };
    }

    case "meu_perfil_de_conteudo": {
      const perfil = (await ctx.anuncio?.perfil?.()) ?? null;
      const observado = perfil?.observado ?? [];
      if (!perfil || (perfilEstaVazio(perfil) && observado.length === 0)) {
        return { saida: { vazio: true, comoResponder: "Diga que a loja ainda não preencheu como gosta de vender, e que isso se faz em Configurações › Como a sua loja vende. Não sugira um tom." } };
      }
      return {
        saida: {
          ...(perfilEstaVazio(perfil) ? { perfilEscrito: "vazio" } : perfil),
          observadoNasAprovacoes: observado,
          comoResponder: "Mostre o que está ESCRITO como escrito. O que está em observadoNasAprovacoes é tendência vista nas aprovações — diga isso com essa palavra, e não como regra da loja. Não complete nem reinterprete.",
        },
      };
    }

    case "preparar_resolucao":
      return prepararResolucao(args, ctx);

    case "preparacao_de_anuncio":
      return avaliarAnuncio(args, ctx);

    case "propor_titulo":
      return proporTitulo(args, ctx);

    case "propor_titulo_no_anuncio":
      return proporTituloNoAnuncio(args, ctx);

    case "tabela_de_medidas": {
      const a = ctx.anuncio;
      if (!a?.medidasDoProduto) {
        return { saida: { erro: "Não consigo ver a tabela de medidas por aqui agora." } };
      }
      const produtoId = texto(args, "produtoId");
      if (!produtoId) return { saida: { erro: "Preciso saber de qual produto." } };
      const m = await a.medidasDoProduto(produtoId);
      if (!m) return { saida: { erro: "Não achei esse produto." } };

      // A PROCEDÊNCIA VIAJA JUNTO, e é o ponto desta ferramenta.
      //
      // "35 = 22,5 cm" tem peso diferente se veio da tabela oficial da Modare
      // ou do padrão BR genérico. Devolver o número sem a fonte deixaria o
      // modelo afirmar as três com a mesma confiança — e tabela de medida
      // errada não é erro de texto: é devolução, que aparece no custo dela.
      return {
        saida: {
          produto: m.nome,
          marca: m.marca,
          tabela: m.tabela,
          comoMedir: m.comoMedir,
          fonte: m.fonte,
          confiavel: m.confiavel,
          comoResponder:
            m.fonte === "override"
              ? "Esta é a tabela que ELA cadastrou. Trate como definitiva."
              : m.fonte === "marca"
                ? `Esta é a tabela da marca ${m.marca}. É referência da fabricante, não medição do produto dela.`
                : m.fonte === "padrao"
                  ? "Isto é o padrão BR genérico, NÃO a tabela da marca. Diga isso: se a numeração da marca for diferente, a tabela está errada e vira devolução."
                  : "Não há tabela para este produto. Não invente medidas.",
        },
      };
    }

    case "propor_publicacao":
      return proporPublicacao(args, ctx);

    case "propor_descricao":
      return proporTexto(args, ctx, "descricao");

    case "propor_palavras_chave":
      return proporTexto(args, ctx, "palavras_chave");

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
/**
 * A proposta de DESCRIÇÃO ou de PALAVRAS-CHAVE.
 *
 * Uma função para os dois porque o caminho é o mesmo — ler o que existe, gerar,
 * deixar o DOMÍNIO julgar, montar a proposta — e o que muda é qual agente roda
 * e qual juiz decide. Duas cópias divergiriam no primeiro conserto.
 *
 * O que NÃO é comum, e por isso está explícito: palavras-chave ACRESCENTAM, e
 * descrição SUBSTITUI. Confundir os dois apagaria termos que já vendiam.
 */
/**
 * A proposta de PUBLICAR — a única ação do chat que o COMPRADOR vê.
 *
 * ===========================================================================
 * ELA ENSAIA, NÃO PUBLICA
 * ===========================================================================
 *
 * O que sai daqui é o payload que a publicação REAL montaria, lido do mesmo
 * `montarPreviewML`. Um resumo feito à parte mostraria uma coisa e publicaria
 * outra — e é justamente aqui que essa diferença chega ao comprador.
 *
 * ===========================================================================
 * QUEM RECUSA É O DOMÍNIO
 * ===========================================================================
 *
 * `pendenciasDoProduto` já sabe o que trava `publicar` — preço ausente, foto
 * ausente. A ferramenta não reimplementa o critério: pergunta, e devolve a
 * frase que o domínio escreveu.
 *
 * E as guardas do Mercado Livre (conexão, credencial, INFRAÇÃO) NÃO rodam
 * aqui: elas rodam na publicação real, em `/api/ml/publicar`, com o token vivo.
 * Antecipá-las seria uma segunda cópia — e a trava de infração é a última coisa
 * neste repositório que pode ter duas versões.
 */
async function proporPublicacao(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  const a = ctx.anuncio;
  if (!a?.ensaioDaPublicacao) {
    return { saida: { erro: "Não consigo publicar por aqui agora." } };
  }
  const produtoId = texto(args, "produtoId");
  if (!produtoId) return { saida: { montada: false, motivo: "Preciso saber de qual produto." } };

  const ensaio = await a.ensaioDaPublicacao(produtoId);
  if (!ensaio) {
    return {
      saida: {
        montada: false,
        motivo:
          "Esse produto ainda não tem anúncio preparado — não há o que publicar. Posso preparar o anúncio primeiro.",
      },
    };
  }
  if (ensaio.jaPublicado) {
    return {
      saida: {
        montada: false,
        motivo: `Esse anúncio já está no ar${ensaio.mlItemId ? ` (${ensaio.mlItemId})` : ""}. Publicar de novo criaria um anúncio duplicado.`,
      },
    };
  }

  // O CRITÉRIO É DO DOMÍNIO. Ver o cabeçalho.
  const item = await a.doProduto(produtoId);
  // ===================================================================
  // A TRADUÇÃO ENTRE OS DOIS TIPOS, ESCRITA À MÃO E DE PROPÓSITO
  // ===================================================================
  //
  // `ProdutoParaPreparar` conta imagens (`quantidadeImagens`);
  // `ProdutoParaAnalise` quer um booleano (`temFoto`). São perguntas
  // diferentes sobre o mesmo produto, e nenhum dos dois tipos está errado.
  //
  // A primeira versão daqui usava `as never` para calar o compilador. Ele
  // estava certo: `temFoto` chegava `undefined` — falsy —, então TODO produto
  // era "sem foto", e `propor_publicacao` recusava dizendo que faltava imagem
  // num produto com dez.
  //
  // Medido em produção em 11/08/2026, na Sapatilha Modare. Um cast que silencia
  // o compilador silencia justamente o aviso que existia para isto.
  const travas = item
    ? pendenciasDoProduto({
        id: produtoId,
        nome: item.produto.nome,
        marca: item.produto.marca,
        modelo: item.produto.modelo,
        custo: item.produto.custo,
        precoVenda: item.produto.precoVenda,
        temFoto: item.produto.quantidadeImagens > 0,
        ...(item.produto.vendedorPagaFrete === false ? { vendedorPagaFrete: false } : {}),
        // VARIANTES VAZIAS, e isto é uma afirmação verificável, não preguiça:
        // das sete pendências, só `preco` e `foto` bloqueiam publicar, e as
        // duas são de PRODUTO. As de variante (`peso_variante`, `sku_variante`,
        // `ean_variante`) têm lista de bloqueio vazia de propósito.
        //
        // `VarianteDaBase` não tem `id` nem `pesoGramas`, então traduzir exigiria
        // inventar os dois — e inventar id é como se troca dado de lugar.
        //
        // A sentinela `soPrecoEFotoBloqueiamPublicar` quebra se isso mudar, para
        // o atalho não sobreviver à premissa.
        variantes: [],
      }).filter((p) => p.bloqueia.includes("publicar"))
    : [];
  if (travas.length > 0) {
    return {
      saida: {
        montada: false,
        motivo: `Ainda não dá para publicar: ${travas.map((t) => t.impede).join(" ")}`,
        travas: travas.map((t) => t.tipo),
      },
    };
  }

  return {
    propostaDePublicacao: {
      anuncioId: ensaio.anuncioId,
      produtoId,
      nome: ensaio.nome,
      titulo: ensaio.titulo,
      preco: ensaio.preco,
      estoque: ensaio.estoque,
      fotos: ensaio.fotos,
      categoria: ensaio.categoria,
      ...(ensaio.congelado ? { congelado: ensaio.congelado } : {}),
    },
    saida: {
      montada: true,
      // O TEXTO NÃO REPETE O CARTÃO. E a frase abaixo existe porque eu já
      // afirmei o passo seguinte no lugar do resultado três vezes em 03/08.
      aviso:
        "PUBLICAR NÃO ACONTECEU. O cartão espera o clique dela. Não diga que o anúncio está no ar — diga que a proposta está pronta para ela confirmar.",
    },
  };
}

async function proporTexto(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas,
  campo: "descricao" | "palavras_chave"
): Promise<ResultadoDaFerramenta> {
  const a = ctx.anuncio;
  if (!a?.textoDoAnuncio || !a.gerarDescricao || !a.gerarPalavras) {
    return { saida: { erro: "Não consigo mexer no texto do anúncio nesta tela." } };
  }
  const produtoId = texto(args, "produtoId");
  if (!produtoId) return { saida: { montada: false, motivo: "Preciso saber de qual produto." } };

  const alvo = await a.textoDoAnuncio(produtoId);
  if (!alvo) {
    return {
      saida: {
        montada: false,
        motivo:
          "Esse produto ainda não tem anúncio gerado — não há texto para melhorar. Posso preparar o anúncio primeiro.",
      },
    };
  }

  const item = await a.doProduto(produtoId);
  const base = {
    nome: item?.produto.nome ?? alvo.nome,
    marca: item?.produto.marca ?? "",
    modelo: item?.produto.modelo ?? "",
  };

  if (campo === "descricao") {
    const instrucao = texto(args, "instrucao").slice(0, 300) || undefined;
    const gerado = await a.gerarDescricao({ ...base, atual: alvo.descricaoAtual, ...(instrucao ? { instrucao } : {}) });
    const veredicto = avaliarDescricaoProposta(gerado?.descricao ?? "", alvo.descricaoAtual);
    if (!veredicto.ok) return { saida: { montada: false, motivo: veredicto.motivo } };
    const proibidas = proibidasPresentes(veredicto.descricao, (await a.perfil?.()) ?? null);
    if (proibidas.length > 0) {
      return {
        saida: {
          montada: false,
          motivo: `A descrição proposta usa palavra que a loja proibiu no perfil de conteúdo: ${proibidas.join(", ")}. Peça de novo dizendo para evitar.`,
        },
      };
    }
    return {
      propostaDeTexto: {
        campo,
        anuncioId: alvo.anuncioId,
        produtoId,
        nome: alvo.nome,
        atual: alvo.descricaoAtual,
        proposto: veredicto.descricao,
        justificativa: gerado?.justificativa ?? "",
        autoridade: "nao_se_aplica",
      },
      saida: {
        montada: true,
        campo,
        caracteresAtuais: alvo.descricaoAtual.length,
        caracteresPropostos: veredicto.descricao.length,
        // O TEXTO NÃO VAI NA SAÍDA do modelo, e isso é deliberado: ele já
        // escreveu a descrição uma vez, e devolvê-la aqui só faria ele
        // reescrevê-la na resposta — com variação. Quem mostra os dois lados é
        // o cartão, com o texto que a proposta guardou.
        aviso: "A lojista lê a atual e a proposta no cartão e decide. Não repita o texto na resposta.",
      },
    };
  }

  const gerado = await a.gerarPalavras({ ...base, atuais: alvo.palavrasAtuais });
  const veredicto = avaliarPalavrasChave(gerado?.palavras ?? [], alvo.palavrasAtuais);
  if (!veredicto.ok) return { saida: { montada: false, motivo: veredicto.motivo } };
  return {
    propostaDeTexto: {
      campo,
      anuncioId: alvo.anuncioId,
      produtoId,
      nome: alvo.nome,
      atual: alvo.palavrasAtuais.join(", "),
      proposto: veredicto.palavras.join(", "),
      justificativa: gerado?.justificativa ?? "",
      autoridade: "nao_se_aplica",
    },
    saida: {
      montada: true,
      campo,
      quantasJaTem: alvo.palavrasAtuais.length,
      quantasNovas: veredicto.palavras.length,
      // ACRESCENTA, não substitui. Se o modelo disser "vou trocar suas
      // palavras-chave", ela entende errado o que o botão faz.
      aviso: "Estas ACRESCENTAM às que já existem. Nenhuma palavra atual é removida.",
    },
  };
}

/**
 * "Corrige o título do anúncio" — a troca no item QUE ESTÁ NO AR.
 *
 * Irmã de `proporTitulo`, e deliberadamente separada: aquela muda o catálogo
 * do Zion e ninguém de fora vê; esta muda o que o comprador lê agora. O cartão
 * carrega `noMarketplace` para a tela poder dizer isso — um botão idêntico
 * para consequências diferentes seria a armadilha.
 *
 * O "atual" vem do Mercado Livre, não do Zion: os dois divergirem é o caso.
 */
async function proporTituloNoAnuncio(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  const produtoId = texto(args, "produtoId");
  if (!produtoId) return { saida: { montada: false, motivo: "Preciso saber de qual produto." } };
  if (!ctx.tituloNoAr) {
    return {
      saida: {
        erro: "Não consigo ler o anúncio no Mercado Livre por aqui agora.",
        comoResponder: "Diga que não conseguiu alcançar o Mercado Livre e que por isso não vai propor troca nenhuma.",
      },
    };
  }

  let noAr: Awaited<ReturnType<NonNullable<ContextoDasFerramentas["tituloNoAr"]>>>;
  try {
    noAr = await ctx.tituloNoAr(produtoId);
  } catch {
    return {
      saida: {
        erro: "Não consegui ler o título que está no ar.",
        comoResponder: "Diga que não conseguiu ler o anúncio no Mercado Livre agora. Não proponha troca sem saber o que está lá.",
      },
    };
  }
  if (!noAr) {
    return {
      saida: {
        montada: false,
        motivo: "Este produto não tem anúncio publicado no Mercado Livre — não há título no ar para corrigir.",
        comoResponder: "Diga isso como está. Se ele quiser melhorar o título do CADASTRO, existe propor_titulo.",
      },
    };
  }

  // O título pedido, ou o que a Zion já tem — o caso "o Zion está certo e o ML
  // está velho". Sem nenhum dos dois, não há o que propor.
  let pedido = texto(args, "titulo");
  if (!pedido && ctx.anuncio?.anuncioParaTitulo) {
    // O título que a Zion já tem para este produto — o caso "o cadastro está
    // certo e o Mercado Livre está velho".
    pedido = (await ctx.anuncio.anuncioParaTitulo(produtoId))?.tituloAtual ?? "";
  }
  const pode = podeCorrigirTitulo(noAr.titulo, pedido, limiteDoTituloNoCanal("Mercado Livre"));
  if (!pode.pode) {
    return {
      saida: {
        montada: false,
        motivo: pode.explicacao,
        tituloNoAr: noAr.titulo,
        comoResponder:
          pode.motivo === "igual"
            ? "Diga que o anúncio já está com esse título e que não há o que trocar."
            : "Diga o motivo como está. Se for tamanho, ofereça gerar um título dentro do limite com propor_titulo.",
      },
    };
  }

  return {
    propostaDeTitulo: {
      noMarketplace: true,
      mlb: noAr.mlb,
      anuncioId: noAr.anuncioId,
      produtoId,
      nome: noAr.titulo,
      tituloAtual: noAr.titulo,
      tituloProposto: pedido,
      justificativa: "",
      autoridade: "nao_se_aplica",
    },
    saida: {
      montada: true,
      noMarketplace: true,
      mlb: noAr.mlb,
      tituloNoAr: noAr.titulo,
      tituloProposto: pedido,
      caracteres: pedido.length,
      comoResponder:
        "Deixe CLARO que isto muda o anúncio que está no ar, e não o cadastro: é o que o comprador vê. Mostre os dois títulos. NÃO diga que trocou — nada acontece até o clique, e depois do clique eu releio o anúncio para confirmar antes de afirmar qualquer coisa.",
    },
  };
}

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
  // O AJUSTE: "deixa mais curto" vai para o agente com a ordem de preservar o
  // resto. Sem isto, pedir de novo regerava do zero e a lojista perdia o que
  // já tinha aprovado a cada iteração.
  const instrucao = texto(args, "instrucao").slice(0, 300) || undefined;
  const entrada = {
    nome: item?.produto.nome ?? alvo.nome,
    marca: item?.produto.marca ?? "",
    modelo: item?.produto.modelo ?? "",
    tituloAtual: alvo.tituloAtual,
    ...(instrucao ? { instrucao } : {}),
  };
  let gerado = await a.gerarTitulo(entrada);
  // O DOMÍNIO decide se o título proposto pode virar proposta — vazio, igual ao
  // atual ou acima dos 60 caracteres do ML são recusas, não opinião do modelo.
  let veredicto = avaliarTituloProposto(gerado?.titulo ?? "", alvo.tituloAtual, alvo.marketplace ?? null);
  // UMA retentativa, só quando o juiz recusou por TAMANHO. A cota já foi
  // gasta; devolver "68 caracteres" para a lojista em vez de encurtar era
  // entregar o trabalho pela metade. Teto de uma: a segunda recusa é resposta.
  if (!veredicto.ok && /caracteres/i.test(veredicto.motivo) && gerado?.titulo) {
    gerado = await a.gerarTitulo({ ...entrada, retentativaPor: veredicto.motivo });
    veredicto = avaliarTituloProposto(gerado?.titulo ?? "", alvo.tituloAtual, alvo.marketplace ?? null);
  }
  if (!veredicto.ok) {
    return { saida: { montada: false, motivo: veredicto.motivo } };
  }
  const proibidasNoTitulo = proibidasPresentes(veredicto.titulo, (await a.perfil?.()) ?? null);
  if (proibidasNoTitulo.length > 0) {
    return {
      saida: {
        montada: false,
        motivo: `O título proposto usa palavra que a loja proibiu no perfil de conteúdo: ${proibidasNoTitulo.join(", ")}. Peça de novo dizendo para evitar.`,
      },
    };
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

/**
 * "Como estão minhas vendas?", "por que caíram?", "o que vende mais?".
 *
 * A leitura é DIFERENCIAL (esta janela contra a anterior) e vem com a lista do
 * que os dados não cobrem. O `comoResponder` existe porque "por quê" é a
 * pergunta em que o modelo mais inventa: ele recebe a variação por produto e a
 * instrução de separar o que os números mostram do que seria hipótese.
 */
async function consultarVendas(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  if (!ctx.vendas) {
    return { saida: { erro: "Não consigo ler as vendas por aqui agora — a integração com o Mercado Livre não está disponível neste servidor." } };
  }
  const bruto = Number(args.dias);
  const dias = ([7, 14, 30, 60, 90] as const).find((d) => d === bruto) ?? 30;
  const r = await ctx.vendas(dias);
  if (!r.ok) {
    return {
      saida: {
        erro: r.mensagem,
        motivo: r.motivo,
        comoResponder:
          r.motivo === "nao_conectado"
            ? "Diga que a loja não está conectada ao Mercado Livre e que, conectando em Conexão com o Mercado Livre, você passa a ler as vendas. Não estime venda nenhuma."
            : r.motivo === "reconectar"
              ? "Diga que o Mercado Livre recusou a credencial e que é preciso reconectar. Não estime venda nenhuma."
              : "Diga que não conseguiu ler as vendas agora e por quê. Não estime.",
      },
    };
  }
  const l = r.leitura;
  return {
    saida: {
      periodoDias: l.periodoDias,
      atual: l.atual,
      anterior: l.anterior,
      variacaoFaturamentoPct: l.variacaoFaturamento,
      variacaoPedidosPct: l.variacaoPedidos,
      quedas: l.quedas,
      altas: l.altas,
      sumiram: l.sumiram,
      pedidosLidos: r.pedidosLidos,
      ...(r.truncado ? { aviso: "A leitura parou no teto de pedidos; os números cobrem os mais recentes, não o período inteiro." } : {}),
      oQueNaoSei: l.oQueNaoSei,
      comoResponder: [
        "Separe em três blocos, nesta ordem: O QUE OS NÚMEROS MOSTRAM (só o que está acima, com os valores exatos e a comparação com o período anterior), O QUE ISSO SUGERE (hipóteses, ditas como hipóteses, ligadas a um produto ou número específico), O QUE EU NÃO SEI (repita a lista oQueNaoSei quando a pergunta for 'por quê').",
        "Se a pergunta for 'por que caíram', comece pelos produtos em 'quedas' e 'sumiram' — é neles que a queda está. Não atribua a queda a título, foto ou preço sem dado: isso é hipótese e precisa ser dita como hipótese.",
        "Quando 'anterior' for zero, não há comparação: diga isso em vez de calcular porcentagem.",
        "coberturaCusto abaixo de 100 significa que a margem está calculada sobre PARTE das unidades. Diga quantos por cento têm custo antes de falar de margem.",
        "Se quiser propor algo, proponha o próximo passo concreto (conferir estoque dos que sumiram, revisar preço dos que caíram) e ofereça as ferramentas que existem — pendencias, pricing, preparacao_de_anuncio.",
      ].join(" "),
    },
  };
}

/**
 * "Descobre o que está errado" — o trabalho que atravessa turnos.
 *
 * Esta ferramenta não consulta nada: ela ABRE (ou fecha) o rascunho onde os
 * achados ficam. Quem descobre são as outras, no mesmo turno e nos seguintes.
 */
async function conduzirInvestigacao(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  if (!ctx.investigacao) {
    return {
      saida: {
        erro: "Não consigo abrir uma investigação por aqui agora.",
        comoResponder: "Responda com o que der no turno de hoje, e diga o que ficou de fora. Não prometa continuar.",
      },
    };
  }
  const { atual } = ctx.investigacao;
  const concluida = args.concluida === true;
  const proximoPasso = texto(args, "proximoPasso");

  if (concluida) {
    if (!atual) {
      return { saida: { montada: false, motivo: "Não há investigação aberta para concluir." } };
    }
    ctx.investigacao.concluir();
    return {
      saida: {
        concluida: true,
        pergunta: atual.pergunta,
        rodadasGastas: atual.rodadas + 1,
        comoResponder:
          "Entregue a CONCLUSÃO da investigação: o que você descobriu, o que isso significa, e o que fazer. Diga também o que NÃO deu para apurar. Se houver ação possível, ofereça — mas nada é feito sem o clique.",
      },
    };
  }

  if (atual) {
    // Já existe: não abre outra. Duas investigações no mesmo fio seriam duas
    // memórias competindo, e o modelo não teria como escolher.
    if (proximoPasso) ctx.investigacao.anotar(proximoPasso);
    const parar = podeContinuar(atual) ? null : motivoDeParar(atual);
    return {
      saida: {
        jaAberta: true,
        pergunta: atual.pergunta,
        rodada: atual.rodadas + 1,
        achadosAteAqui: atual.achados.length,
        ...(parar ? { naoPodeContinuar: parar } : {}),
        comoResponder: parar
          ? "Diga que esta investigação chegou ao limite e entregue a conclusão com o que já apurou, dizendo o que ficou sem resposta."
          : "Continue de onde parou usando as ferramentas de leitura. Não repita as consultas que já constam dos achados.",
      },
    };
  }

  const pergunta = texto(args, "pergunta");
  if (!pergunta) {
    return { saida: { montada: false, motivo: "Preciso saber o que investigar." } };
  }
  const nova = await ctx.investigacao.abrir(pergunta, proximoPasso);
  if (!nova) {
    return {
      saida: {
        erro: "Não consegui abrir a investigação.",
        comoResponder: "Siga respondendo com o que couber neste turno e diga o que ficou de fora. Não prometa continuar depois.",
      },
    };
  }
  return {
    saida: {
      aberta: true,
      pergunta: nova.pergunta,
      rodada: 1,
      comoResponder:
        "NÃO anuncie que abriu uma investigação — isso é detalhe interno. Continue trabalhando: use as ferramentas de leitura para apurar, e responda com o que descobriu. O que ficar faltando volta no próximo turno.",
    },
  };
}

/**
 * "Você consegue fazer X?" — a conferência ANTES da promessa.
 *
 * É a peça que faltava para o Copilot dizer "isto eu não faço, e é por isto"
 * em vez de improvisar. E a checagem É o sinal: quando o assunto é uma lacuna,
 * o pedido fica registrado — é dele que sai a lista do que construir.
 */
async function conferirHabilidade(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  const assunto = texto(args, "assunto");
  const pedido = texto(args, "pedido");
  const lacuna = assunto ? lacunaPorAssunto(assunto) : null;

  if (assunto && !lacuna) {
    // Assunto que não existe no registro NÃO vira "não sei fazer": seria uma
    // recusa inventada, que é o defeito que este arquivo existe para impedir.
    return {
      saida: {
        assuntoDesconhecido: assunto,
        habilidades: habilidades().map((h) => ({ ferramenta: h.ferramenta, oQueFaz: h.oQueFaz, nivel: h.nivel })),
        comoResponder:
          "O assunto que você passou não está na lista de limitações conhecidas — então NÃO afirme que não consegue. Procure a habilidade correspondente na lista e use a ferramenta certa; se nenhuma servir, diga o que você tentou e pergunte o que a pessoa quer alcançar.",
      },
    };
  }

  if (lacuna) {
    // O sinal, gravado no momento honesto. Nunca derruba a resposta.
    if (ctx.registrarLacuna) {
      await ctx.registrarLacuna(lacuna.assunto, pedido).catch(() => {});
    }
    return {
      saida: {
        consigo: false,
        assunto: lacuna.assunto,
        codigo: lacuna.codigo,
        porQue: lacuna.porQue,
        oQueFaltaria: lacuna.oQueFaltaria,
        comoResponder:
          "Diga que NÃO consegue fazer isso, e diga o MOTIVO com as palavras de porQue — nunca 'não consigo' sozinho, nunca 'ainda não implementado'. Depois diga o que existe de caminho, usando oQueFaltaria: se houver uma saída pelas telas ou pelo próprio marketplace, aponte-a. Não prometa prazo e não diga que vai fazer depois. Se houver algo próximo que você CONSIGA fazer, ofereça — mas deixe claro que é outra coisa.",
      },
    };
  }

  return {
    saida: {
      habilidades: habilidades().map((h) => ({
        ferramenta: h.ferramenta,
        oQueFaz: h.oQueFaz,
        nivel: h.nivel,
        precisaDe: h.precisaDe,
      })),
      limitacoesConhecidas: lacunas().map((l) => ({ assunto: l.assunto, resumo: l.porQue })),
      comoResponder:
        "Responda com o que a pessoa consegue FAZER a partir daqui, agrupado por assunto (o que eu leio, o que eu proponho, o que eu executo), não com a lista crua de ferramentas. Não cite nomes técnicos de ferramenta. Se ela perguntou sobre algo específico que está em limitacoesConhecidas, chame esta ferramenta de novo passando o assunto.",
    },
  };
}

/**
 * "As variações não estão agrupadas" — a grade de cada produto no ML.
 *
 * A frase da lojista aponta para o lugar certo e nomeia a coisa errada: em
 * calçado, um anúncio por numeração É o formato do ML. O que dói é a grade
 * PARTIDA — 16 anúncios e 1 no ar. Esta saída mede isso, e declara o que não
 * sabe: sem o vínculo de família guardado, ninguém aqui pode afirmar que o ML
 * agrupou ou deixou de agrupar.
 */
async function diagnosticarGrade(
  args: Record<string, unknown>,
  ctx: ContextoDasFerramentas
): Promise<ResultadoDaFerramenta> {
  if (!ctx.noAr) {
    return { saida: { erro: "Não consigo ler os anúncios da loja por aqui agora." } };
  }
  const grades = gradesDosProdutos(await ctx.noAr());
  if (grades.length === 0) {
    return {
      saida: {
        montada: false,
        motivo: "Esta loja não tem anúncio publicado no Mercado Livre por aqui.",
        comoResponder: "Diga isso como está.",
      },
    };
  }
  // O catálogo já foi lido neste turno se alguém o pediu — é o mesmo porto
  // memoizado da análise. Sem ele, a conferência de referência apenas não sai.
  let referencias: ReturnType<typeof referenciasRepetidas> = [];
  if (ctx.analise) {
    try {
      const c = await ctx.analise.catalogo();
      referencias = referenciasRepetidas(
        c.produtos.map((p) => ({ id: p.id, nome: p.nome, modelo: p.modelo }))
      );
    } catch {
      // Falha ao ler o catálogo não derruba o diagnóstico da grade: some a
      // conferência de referência, e a saída não afirma que não há repetida.
      referencias = [];
    }
  }
  const quebradas = grades.filter((g) => g.situacao === "so_um_no_ar" || g.situacao === "partida" || g.situacao === "fora_do_ar");

  // ---- A FAMÍLIA, PERGUNTADA AO ML — só quando alguém aponta um produto.
  //
  // A leitura é por PRODUTO de propósito. Fazê-la para os dez piores seriam
  // dez idas ao ML numa pergunta só, e ninguém perguntou sobre os dez. Quando
  // a lojista diz "as variações da Papete não estão agrupadas", o modelo já
  // achou o produto no passo anterior e passa o id aqui.
  const alvo = texto(args, "produtoId").trim();
  let agrupamentoNoML: unknown;
  if (alvo && ctx.familiaNoAr) {
    const leitura = await ctx.familiaNoAr(alvo);
    if (leitura) {
      const r = retratoDaFamilia(leitura);
      agrupamentoNoML = {
        situacao: r.situacao,
        anunciosLidosNoML: r.lidos,
        anunciosSemResposta: r.naoLidos,
        familias: r.familias,
        semFamilia: r.semFamilia,
        // A FRASE VEM PRONTA. Deixar o modelo redigir a partir dos números
        // abriria espaço para "estão agrupados" sair de uma leitura parcial —
        // e é justamente essa a diferença que a lojista precisa ver.
        frase: fraseDaFamilia(r),
      };
    }
  }

  return {
    saida: {
      produtosComAnuncio: grades.length,
      produtosComGradeQuebrada: quebradas.length,
      anunciosForaDoAr: grades.reduce((t, g) => t + g.fora, 0),
      // A FRAÇÃO NÃO SAI DAQUI. `cobertura` é 0,0625; quem lê aquilo rotulado
      // como percentual entende 0,06%, cem vezes menos que os 6% reais — e foi
      // o que a tela mostrou em 24/08/2026. Só a porcentagem inteira atravessa.
      piores: quebradas.slice(0, 10).map(({ cobertura: _fracao, ...g }) => g),
      referenciasParaConferir: referencias.slice(0, 10),
      conferenciaDeReferenciaDisponivel: Boolean(ctx.analise),
      ...(agrupamentoNoML ? { agrupamentoNoML } : {}),
      // A LACUNA SÓ APARECE QUANDO AINDA É VERDADE. Mandá-la junto com a
      // leitura faria o modelo dizer as duas coisas — "estão agrupados" e "não
      // sei se estão agrupados" — na mesma resposta.
      ...(agrupamentoNoML ? {} : { oQueNaoSei: LACUNA_DA_FAMILIA }),
      comoResponder: [
        "EXPLIQUE O FORMATO ANTES DE APONTAR O DEFEITO: em categoria de calçado o Mercado Livre não aceita um anúncio com variações, então um anúncio por numeração é o certo. Muitos anúncios para um produto NÃO é o problema.",
        "O problema é a GRADE PARTIDA. Para cada produto em 'piores' diga: X anúncios, Y no ar, e o que está bloqueando o resto (campo motivos). 'so_um_no_ar' é o caso mais caro: quem procura outro número não encontra a loja.",
        "'coberturaPercentual' JÁ ESTÁ EM PORCENTAGEM INTEIRA: escreva \"6%\", nunca \"0,06\" nem \"0.0625\". Não converta nada — o número sai pronto.",
        "SOBRE AGRUPAMENTO: se veio 'agrupamentoNoML', a resposta É o campo 'frase' dele — copie o sentido, não recalcule a partir dos números. Se NÃO veio, repita 'oQueNaoSei' e diga que para conferir a família você precisa saber de qual produto se trata (ache com achar_produto e chame de novo com produtoId).",
        "Sobre 'referenciasParaConferir': diga 'confira se são o mesmo produto' e mostre os modelos lado a lado. NUNCA diga que são duplicados — dois materiais do mesmo modelo é cadastro legítimo, e quem decide é a lojista.",
        "Se 'conferenciaDeReferenciaDisponivel' for falso, não diga que não há referência repetida: diga que não conferiu.",
        "Para resolver, ofereça o caminho que existe: anuncios_a_corrigir mostra o motivo de cada um estar fora do ar, e diagnostico_do_anuncio olha um anúncio específico.",
      ].join(" "),
    },
  };
}

/**
 * "O que está parado?" — os anúncios fora do ar, por motivo do ML.
 *
 * O que esta saída carrega e nenhuma outra carregava: para cada motivo, o que o
 * Zion CONSEGUE fazer hoje. `capacidade_ausente` é uma resposta — prometer
 * conserto sobre um motivo que ninguém sabe ler seria a invenção que o A0
 * cometia.
 */
async function listarFilaDeCorrecao(ctx: ContextoDasFerramentas): Promise<ResultadoDaFerramenta> {
  if (!ctx.noAr) {
    return { saida: { erro: "Não consigo ler os anúncios da loja por aqui agora." } };
  }
  const f = filaDeCorrecao(await ctx.noAr());
  if (f.foraDoAr === 0) {
    return {
      saida: {
        montada: false,
        motivo: "Nenhum anúncio desta loja está fora do ar — ou o estado deles ainda não foi medido.",
        comoResponder:
          "Diga isso como está. Se quiser conferir o total, use anuncios_ativos, que separa os medidos dos não medidos.",
      },
    };
  }
  return {
    saida: {
      foraDoAr: f.foraDoAr,
      comMotivo: f.comMotivo,
      semMotivoDeclarado: f.semMotivo,
      lidoHaDias: f.lidoHaDias,
      grupos: f.grupos,
      comoResponder: [
        "Comece pelo MAIOR grupo — é onde está o trabalho. Para cada motivo diga: quantos, o que significa (o campo 'significa'), e o que fazer (o campo 'oQueFazer'), nesta ordem.",
        "O campo 'acao' diz o que EU consigo fazer. 'capacidade_ausente' significa que eu NÃO resolvo isso hoje: diga isso com as palavras de 'oQueFazer', sem prometer conserto e sem sugerir que a lojista espere por mim.",
        "'nunca_reativar' é infração: avise explicitamente para NÃO reativar, porque reincidência pune a conta.",
        "'reativar' é a única que eu executo: ofereça reativar os anúncios pausados pela própria loja, um a um, e diga que confiro posse e infração antes.",
        "SEMPRE diga há quantos dias esta leitura foi feita (campo lidoHaDias) — a fila é do que foi MEDIDO, não do Mercado Livre agora. Para atualizar, a lojista usa Importar do Mercado Livre na tela de Produtos.",
        "Cite os produtos onde o motivo se concentra (campo 'produtos'): a loja resolve por produto, não por anúncio solto.",
        "'semMotivoDeclarado' são anúncios fora do ar cujo motivo o ML não informou — não invente causa para eles.",
      ].join(" "),
    },
  };
}

/**
 * "Quais anúncios estão ativos?" — a loja inteira, por estado.
 *
 * A saída separa os TRÊS eixos que a 050 pagou caro para distinguir: no ar,
 * em outro estado, e SEM LEITURA. E carrega a idade da medição, porque um
 * `active` lido há três semanas não é uma afirmação sobre hoje.
 */
async function listarAnunciosNoAr(ctx: ContextoDasFerramentas): Promise<ResultadoDaFerramenta> {
  if (!ctx.noAr) {
    return { saida: { erro: "Não consigo ler os anúncios da loja por aqui agora." } };
  }
  const r = retratoDosAnuncios(await ctx.noAr());
  if (r.comMlb === 0) {
    return {
      saida: {
        montada: false,
        motivo: "Esta loja não tem nenhum anúncio publicado no Mercado Livre por aqui.",
        comoResponder: "Diga isso como está. Não confunda com 'produto sem anúncio preparado' — para isso existe estado_da_loja.",
      },
    };
  }
  return {
    saida: {
      anunciosComMlb: r.comMlb,
      ativos: r.totalAtivos,
      listaDeAtivos: r.ativos,
      listaRecortada: r.totalAtivos > r.ativos.length,
      outrosEstados: r.outros,
      semLeitura: r.semLeitura,
      desatualizados: r.desatualizados,
      leituraMaisAntigaEmDias: r.leituraMaisAntigaEmDias,
      comoResponder: [
        "Comece pelo número de ATIVOS e pelo total com anúncio no ML. Depois os outros estados, do maior para o menor, com a palavra do Mercado Livre e a tradução ao lado (paused = pausado, under_review = em revisão, closed = encerrado, inactive = inativo).",
        "SEMPRE diga há quantos dias o estado foi lido quando 'desatualizados' for maior que zero — esta leitura é do que foi MEDIDO, não do Mercado Livre agora. Para atualizar, a lojista usa Importar do Mercado Livre na tela de Produtos.",
        "'semLeitura' NÃO é 'inativo': são anúncios cujo estado nunca foi medido. Diga 'não sei o estado de N' — nunca os some aos ativos nem aos pausados.",
        "Quando um estado tiver 'motivos', cite-os: eles dizem POR QUE o anúncio não está no ar (out_of_stock = sem estoque, forbidden = infração).",
        "Não liste os ativos um a um se forem muitos: dê o número e ofereça olhar um produto específico com diagnostico_do_anuncio.",
      ].join(" "),
    },
  };
}

/** "Compara minhas lojas" — uma linha por loja, a mesma régua. Só agência/equipe. */
async function compararAsLojas(ctx: ContextoDasFerramentas): Promise<ResultadoDaFerramenta> {
  if (!ctx.comparar) {
    return { saida: { erro: "Esta conta opera uma loja só — não há o que comparar." } };
  }
  const r = await ctx.comparar();
  if (!r.ok) return { saida: { erro: r.mensagem, motivo: r.motivo } };
  return {
    saida: {
      lojas: r.lojas.map((l) => ({
        nome: l.nome,
        produtos: l.estado.produtos,
        semCusto: l.estado.produtos - l.estado.comCusto,
        semPeso: l.estado.produtos - l.estado.comPeso,
        semFoto: l.estado.produtos - l.estado.comFoto,
        semAnuncio: l.estado.produtos - l.estado.comAnuncio,
        aguardandoAprovacao: l.estado.aguardandoAprovacao,
        prontosParaPrecificar: l.estado.prontosParaPrecificar,
        conectadaAoMercadoLivre: l.estado.conectadoAoMarketplace,
        // `undefined` = não lido. Não vira zero.
        ...(l.estado.infracoes !== undefined ? { infracoes: l.estado.infracoes } : {}),
      })),
      totalNoAlcance: r.totalNoAlcance,
      ...(r.truncado ? { aviso: `Mostrei ${r.lojas.length} de ${r.totalNoAlcance} lojas (em ordem de nome).` } : {}),
      comoResponder:
        "Use uma TABELA, uma loja por linha, com as colunas que a pergunta pede. Os números são exatos — não some, não tire média. Aponte a loja mais atrasada pelo que está nas colunas (mais 'sem') e diga o que fazer primeiro nela. Loja sem 'infracoes' é loja cuja infração ainda não foi lida — não diga que não tem.",
    },
  };
}
