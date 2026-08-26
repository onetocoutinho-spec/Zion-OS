// "Anuncia o chinelo zaxy" — do pedido até a proposta.
//
// A esteira roda NO NAVEGADOR e leva de dois a três minutos encadeando agentes.
// Uma ferramenta de servidor não tem como executá-la, e isso é uma sorte: o
// desenho que sobra é o certo.
//
//     a ferramenta PROPÕE · o lojista confirma · o navegador roda a esteira
//
// A mesma forma do `propor_gravacao`, pelo mesmo motivo. Gerar um anúncio gasta
// quota, leva minutos e produz texto que vai para o Mercado Livre — não é coisa
// que se dispara porque o modelo achou que era hora.
//
// O TRABALHO REAL DESTE MÓDULO é dizer NÃO antes de propor. Mandar a esteira
// rodar num produto sem foto, sem custo ou sem os atributos que o ML exige
// queima três minutos e devolve um anúncio que não publica. Aqui isso vira uma
// frase curta com o que falta — e é a diferença entre um assistente e um botão
// caro.
//
// Medido no PR #84: dos 73 produtos desta base, 47 já satisfaziam os seis
// atributos obrigatórios do ML. A conta não é hipotética.

import type { EstadoDoProduto } from "../../catalog/domain/lacunasDoProduto";
import {
  OBRIGATORIOS_CALCADO,
  resolverObrigatorios,
  type AtributoResolvido,
  type DadosDoProduto,
} from "../../publication/domain/atributosDoMarketplace";
import {
  calcularBloqueiosParaGerar,
  type SelecaoParaPreparar,
} from "../../publication/domain/preparacaoDoAnuncio";

export interface ProdutoParaAnunciar {
  id: string;
  nome: string;
  estado: EstadoDoProduto;
  /** O que o ML exige, resolvido do cadastro e do nome. */
  dados: DadosDoProduto;
  /** Já existe anúncio gerado para ele? Refazer é legítimo, mas se diz. */
  jaTemAnuncio: boolean;
}

export type PropostaDeAnuncio =
  | {
      tipo: "pronto";
      produtoId: string;
      nome: string;
      /** O que a pessoa lê antes de gastar três minutos e uma otimização. */
      resumo: string;
      /** true quando vai sobrescrever um anúncio que já existe. */
      refazendo: boolean;
      /** Os atributos que o ML exige, já resolvidos — para o cartão mostrar. */
      atributos: readonly AtributoResolvido[];
    }
  | {
      tipo: "falta_dado";
      produtoId: string;
      nome: string;
      /** O que impede, em português de lojista. */
      faltando: readonly string[];
      mensagem: string;
    }
  | { tipo: "sem_alvo"; mensagem: string }
  | {
      tipo: "lote";
      /**
       * OS IDS CONCRETOS que o clique enfileira — nunca um critério.
       *
       * A mesma regra do lote de peso (ver o bloco "LOTE" na rota da conversa):
       * um critério é uma promessa sobre o futuro, uma lista é um fato sobre o
       * presente. Se o clique reexecutasse "todos os que estiverem prontos", o
       * escopo poderia crescer entre a leitura e o clique — o lojista aprovaria
       * 12 e a fila receberia 19.
       */
      alvos: readonly { produtoId: string; nome: string }[];
      /** Quantos produtos foram avaliados para chegar nestes. */
      analisados: number;
      /** Já tinham anúncio: refazer é outra intenção e não entra em "prepare". */
      jaPreparados: number;
      /** Os que não entram, agrupados pelo primeiro bloqueio, do mais comum. */
      travados: readonly { motivo: string; quantos: number; exemplos: readonly string[] }[];
      /**
       * Quantos ficaram de fora porque a cota do mês não alcança.
       *
       * Zero quando a cota cobriu todo mundo. Nunca é silencioso: um lote que
       * corta 30 dos 47 e não diz é a mesma mentira que "preparei 50" quando
       * foram 47 — só que descoberta um mês depois, na fatura.
       */
      foraPelaCota: number;
      /**
       * A cota não pôde ser lida — e por isso NADA foi cortado.
       *
       * A mesma política de `estadoDaCota`: falha de leitura é fail-open, com a
       * frase dita. Cortar por um número que não se leu seria inventar um
       * limite; esconder que não se leu seria prometer que cabe.
       */
      cotaDesconhecida: boolean;
      /** Verdadeiro quando a leitura não cobriu o catálogo inteiro. */
      truncado: boolean;
      totalNoCatalogo: number;
      /** O contrato que a pessoa lê antes de clicar. */
      resumo: string;
    };

/**
 * O que falta para este produto virar anúncio.
 *
 * Duas fontes, e as duas importam: o cadastro (custo, peso, foto) e o que o
 * MERCADO LIVRE exige (marca, modelo, gênero, cor, tamanho, tipo de calçado).
 *
 * A segunda lista veio de medir a API, não de imaginar: a IA vinha exigindo
 * "antiderrapante", "vegano" e "reciclado", que o ML não pede em lugar nenhum.
 */
export function oQueFaltaParaAnunciar(p: ProdutoParaAnunciar): string[] {
  // A REGRA MORA NO ORQUESTRADOR, uma vez só.
  //
  // Este módulo era o dono dela; virou uma PROJEÇÃO de
  // `preparacaoDoAnuncio.calcularBloqueiosParaGerar`. Não é reescrita: é a mesma
  // lista, com o mesmo corte (cadastro sem o preço, mais os obrigatórios do ML
  // ausentes), agora compartilhada com quem avalia as etapas.
  //
  // Duas cópias dela existiriam para divergir no dia em que uma mudasse — e a
  // divergência apareceria como o Copilot propondo geração para um produto que
  // o painel de preparação diz estar travado.
  return calcularBloqueiosParaGerar(p.estado, p.id, resolverObrigatorios(p.dados, OBRIGATORIOS_CALCADO));
}

/**
 * O que o construtor de UM produto pode devolver — `lote` não está aqui.
 *
 * O tipo diz a invariante em vez de deixá-la implícita: quem consome o caminho
 * de um produto só continua com um `switch` exaustivo de três casos, e o dia em
 * que a união ganhar um quarto variante o compilador aponta o lugar certo (foi
 * assim que `lote` apareceu como erro no ternário deste arquivo, e não como
 * `undefined` na tela).
 */
export type PropostaDeAnuncioDeUm = Exclude<PropostaDeAnuncio, { tipo: "lote" }>;

/** O que o construtor do LOTE pode devolver: o lote, ou o motivo de não haver. */
export type PropostaDeAnuncioDeVarios = Extract<
  PropostaDeAnuncio,
  { tipo: "lote" } | { tipo: "sem_alvo" }
>;

/**
 * A proposta — ou o motivo de não haver uma.
 *
 * Nunca propõe com dado faltando. Um anúncio gerado sem gênero volta com
 * pendência e a pessoa gastou três minutos para descobrir isso.
 */
export function montarPropostaDeAnuncio(p: ProdutoParaAnunciar | null): PropostaDeAnuncioDeUm {
  if (!p) {
    return {
      tipo: "sem_alvo",
      mensagem: "Não sei de qual produto você está falando. Diga o nome, ou abra o produto.",
    };
  }

  const faltando = oQueFaltaParaAnunciar(p);
  if (faltando.length > 0) {
    return {
      tipo: "falta_dado",
      produtoId: p.id,
      nome: p.nome,
      faltando,
      mensagem:
        faltando.length === 1
          ? `Falta ${faltando[0].toLowerCase()} em ${p.nome}. Sem isso o anúncio sai com pendência.`
          : `Faltam ${faltando.length} coisas em ${p.nome}: ${faltando.join(", ")}. Sem elas o anúncio sai com pendência.`,
    };
  }

  return {
    tipo: "pronto",
    produtoId: p.id,
    nome: p.nome,
    refazendo: p.jaTemAnuncio,
    atributos: resolverObrigatorios(p.dados, OBRIGATORIOS_CALCADO),
    // O custo aparece na frase porque é o que a pessoa deve pesar antes de
    // confirmar: minutos de espera e uma otimização da cota mensal.
    resumo: p.jaTemAnuncio
      ? `Refazer o anúncio de ${p.nome}. O texto atual será substituído — leva alguns minutos e consome uma otimização.`
      : `Gerar o anúncio de ${p.nome}: título, descrição e ficha técnica. Leva alguns minutos e consome uma otimização.`,
  };
}

// ---------------------------------------------------------------------------
// O LOTE — "prepare todos que estiverem prontos"
// ---------------------------------------------------------------------------
//
// A frase existia no prompt desde sempre e NÃO TINHA EXECUÇÃO: `propor_anuncio`
// levava um `produtoId` e mais nada. Medido em `copilot_mensagens` em
// 25/08/2026 — 93 turnos, zero chamadas de `propor_anuncio`.
//
// QUEM SELECIONA É O BACKEND. Este construtor não recebe ids do modelo: recebe
// a `SelecaoParaPreparar` que `selecionarParaPreparar` já produz a partir do
// catálogo lido com o tenant da sessão. É a MESMA seleção que
// `preparacao_de_anuncio` relata — de propósito. Se o relatório diz "12 podem
// virar anúncio", o lote prepara exatamente aqueles 12; duas seleções
// diferentes divergiriam no dia em que uma mudasse, e a lojista veria "12
// prontos" virar 9 na fila sem explicação.
//
// O caminho de execução também é outro, e por necessidade: um produto vai pela
// esteira do NAVEGADOR (`/cliente/anunciar?gerar=1`), que leva minutos; 47 não
// cabem numa aba aberta. O lote vai para `fila_otimizacao_produto`, que o
// worker do servidor consome — a mesma fila do "Otimizar tudo" da tela de
// otimização, já construída e em uso.

/** Quantos alvos o cartão lista pelo nome antes de virar contagem. */
const ALVOS_MOSTRADOS = 6;

/**
 * A proposta de preparar VÁRIOS — ou o motivo de não haver uma.
 *
 * `cotaRestante` corta a lista, e o corte é DITO. A tela de otimização já fazia
 * esse corte (`lista.slice(0, restante)`); aqui ele não pode ser silencioso,
 * porque quem lê o cartão não tem a barra de cota na frente.
 */
export function montarPropostaDeAnuncioEmLote(
  selecao: SelecaoParaPreparar,
  opcoes: { cotaRestante: number | null }
): PropostaDeAnuncioDeVarios {
  const { elegiveis, analisados, jaPreparados, naoElegiveis, truncado, totalNoCatalogo } = selecao;

  if (elegiveis.length === 0) {
    // O VAZIO PRECISA DIZER POR QUÊ. "Nenhum produto está pronto" sem o motivo
    // manda a pessoa procurar um defeito onde há só um cadastro incompleto.
    const travados = naoElegiveis.reduce((s, n) => s + n.quantos, 0);
    const partes: string[] = [];
    if (travados > 0) {
      const principal = naoElegiveis[0];
      partes.push(
        `${travados} ${travados === 1 ? "está travado" : "estão travados"} — o motivo mais comum é ${principal.motivo.toLowerCase()} (${principal.quantos})`
      );
    }
    if (jaPreparados > 0) {
      partes.push(`${jaPreparados} já ${jaPreparados === 1 ? "tem anúncio" : "têm anúncio"}`);
    }
    return {
      tipo: "sem_alvo",
      mensagem: partes.length
        ? `Nenhum produto está pronto para virar anúncio agora. De ${analisados} analisados, ${partes.join(" e ")}.`
        : `Não encontrei produtos para preparar. Analisei ${analisados}.`,
    };
  }

  // A COTA CORTA, e o corte entra no objeto para o cartão dizer. Um `slice`
  // mudo aqui seria a fatura explicando depois o que o cartão não explicou.
  //
  // `null` NÃO corta: ver `cotaDesconhecida`. Um corte por número não lido
  // esconderia produtos prontos atrás de um limite imaginário.
  const cotaDesconhecida = opcoes.cotaRestante === null;
  const cabe = cotaDesconhecida ? elegiveis.length : Math.max(0, opcoes.cotaRestante!);
  const alvos = elegiveis.slice(0, cabe).map((p) => ({ produtoId: p.produtoId, nome: p.nome }));
  const foraPelaCota = elegiveis.length - alvos.length;

  if (alvos.length === 0) {
    return {
      tipo: "sem_alvo",
      mensagem: `Tenho ${elegiveis.length} ${elegiveis.length === 1 ? "produto pronto" : "produtos prontos"} para virar anúncio, mas sua cota de otimizações deste mês acabou. Eles ficam para o próximo ciclo.`,
    };
  }

  const nomes = alvos.slice(0, ALVOS_MOSTRADOS).map((a) => a.nome);
  const listaDeNomes =
    alvos.length > ALVOS_MOSTRADOS
      ? `${nomes.join(", ")} e mais ${alvos.length - ALVOS_MOSTRADOS}`
      : nomes.join(", ");

  const ressalvas: string[] = [];
  if (foraPelaCota > 0) {
    ressalvas.push(
      `${foraPelaCota} ${foraPelaCota === 1 ? "fica de fora" : "ficam de fora"} porque sua cota do mês não alcança`
    );
  }
  if (jaPreparados > 0) {
    ressalvas.push(`${jaPreparados} já ${jaPreparados === 1 ? "tem anúncio" : "têm anúncio"} e não ${jaPreparados === 1 ? "entra" : "entram"}`);
  }
  const travados = naoElegiveis.reduce((s, n) => s + n.quantos, 0);
  if (travados > 0) {
    ressalvas.push(`${travados} ${travados === 1 ? "está travado" : "estão travados"} por falta de dado`);
  }

  return {
    tipo: "lote",
    alvos,
    analisados,
    jaPreparados,
    travados: naoElegiveis,
    foraPelaCota,
    cotaDesconhecida,
    truncado,
    totalNoCatalogo,
    resumo:
      `Preparar o anúncio de ${alvos.length} ${alvos.length === 1 ? "produto" : "produtos"}: ${listaDeNomes}.` +
      ` Roda no servidor e consome ${alvos.length} ${alvos.length === 1 ? "otimização" : "otimizações"} da sua cota — você pode fechar a aba.` +
      (ressalvas.length ? ` De ${analisados} analisados, ${ressalvas.join(", ")}.` : "") +
      (cotaDesconhecida
        ? " Não consegui ler sua cota do mês agora, então não cortei a lista — se faltar cota, os últimos falham e ficam para o próximo ciclo."
        : "") +
      (truncado
        ? ` Analisei ${analisados} de ${totalNoCatalogo} produtos do catálogo — pode haver mais prontos fora dessa leitura.`
        : ""),
  };
}
