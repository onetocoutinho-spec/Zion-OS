// Centenas de pendências técnicas viram poucas decisões humanas.
//
// O PROBLEMA QUE ISTO RESOLVE
//
// Uma base de 73 produtos e 684 variantes produz centenas de pendências reais.
// Mostrá-las como lista é honesto e inútil: ninguém responde 184 perguntas. E
// resolvê-las sozinho é o oposto do que este sistema faz — dinheiro,
// identificador e peso não se adivinham.
//
// A saída é classificar por QUEM CONSEGUE RESPONDER:
//
//   PREPARÁVEL         o valor já existe no próprio produto -> Proposal pronta
//   RESOLVÍVEL POR FONTE  uma fonte conectada DECLARA saber -> consultar
//   PRECISA DO HUMANO  só o lojista sabe -> pergunta, agrupada quando dá
//   CONFLITO           dois valores registrados, ou um valor inválido
//   BLOQUEADA          nem eu nem ele resolvemos aqui (foto se envia noutra tela)
//
// A CLASSIFICAÇÃO É CÓDIGO. O Gemini organiza a comunicação; ele não decide o
// que é resolvível — decidir isso a partir de uma frase seria deixar o modelo
// escolher quando o sistema pode agir sozinho.
//
// ---------------------------------------------------------------------------
// "PREPARÁVEL" NÃO É "SEM CONFIRMAÇÃO".
//
// Preparável quer dizer: consigo montar a correção SEM PERGUNTAR O VALOR. A
// gravação continua exigindo o clique, a Proposal, a revalidação e a reserva
// atômica. `Efeito` continua com três valores e nenhum deles escreve.
//
// ---------------------------------------------------------------------------
// AGRUPAR SÓ ONDE O DOMÍNIO PROVA QUE A RESPOSTA É COMPARTILHÁVEL.
//
// Um peso serve para as variantes do MESMO produto: é a mesma caixa, e o
// domínio já trata peso por `produto_id` no lote. Um EAN NUNCA serve para duas
// variantes — ele identifica uma. Entre produtos diferentes, o único
// agrupamento oferecido é por marca+modelo das COLUNAS, e mesmo ele é uma
// PROPOSTA de escopo que o lojista confirma, nunca uma suposição aplicada.
//
// Nome parecido não agrupa nada. `familiaDeProduto.chaveDaFamilia` lê a família
// do texto do nome — serve para uma tela de trabalho, não para uma decisão que
// grava peso em dezenas de linhas.

import type { Capacidade } from "./perguntaDaOperacao";
import {
  chaveExataDeFamilia,
  pesoConhecidoDoProduto,
  pesosDivergentes,
  variantesSemPeso,
  type AlvoDaPendencia,
  type PendenciaDoCatalogo,
  type ProdutoParaAnalise,
  type TipoDePendencia,
} from "../../catalog/domain/pendenciasDoCatalogo";
import type { ConflitoDeProcedencia } from "../../catalog/domain/procedenciaDeCampo";
import type { Capacidade as CapacidadeDeFonte } from "../../../infrastructure/connectors/shared/capacidades";

// ---------------------------------------------------------------------------
// fontes externas — sem acoplamento a ERP nenhum
// ---------------------------------------------------------------------------

/**
 * Uma fonte de catálogo conectada, pelo que ela DECLARA saber fazer.
 *
 * O domínio nunca pergunta "é o Magazord?". Ele pergunta "alguma fonte declara
 * `ler_custo`?". As capacidades são as do SDK de conectores, que já existe e já
 * é o mecanismo pelo qual um conector parcial não recebe operação que não
 * suporta.
 *
 * Medido hoje: o conector Magazord declara `conectar`, `testar_conexao`,
 * `renovar_credencial` e `sincronizar`. NÃO declara `ler_custo` nem
 * `ler_estoque`. Por isso o Copilot não diz "vou buscar o custo no seu ERP" —
 * ele não pode, e prometer seria pior que não oferecer.
 */
export interface FonteConectada {
  nome: string;
  capacidades: ReadonlySet<CapacidadeDeFonte>;
}

/** Que capacidade de fonte cada pendência precisaria para dispensar o humano. */
const FONTE_QUE_RESOLVERIA: Partial<Record<TipoDePendencia, CapacidadeDeFonte>> = {
  custo: "ler_custo",
};

function fonteQueSabe(
  tipo: TipoDePendencia,
  fontes: readonly FonteConectada[]
): FonteConectada | null {
  const precisa = FONTE_QUE_RESOLVERIA[tipo];
  if (!precisa) return null;
  return fontes.find((f) => f.capacidades.has(precisa)) ?? null;
}

// ---------------------------------------------------------------------------
// classificação
// ---------------------------------------------------------------------------

export type Classificacao =
  /** O valor já existe no próprio produto. Monta Proposal sem perguntar nada. */
  | "preparavel"
  /** Uma fonte conectada declara saber. Consultar antes de perguntar. */
  | "resolvivel_por_fonte"
  /** Só o lojista sabe. Vira pergunta — agrupada quando o domínio prova que dá. */
  | "precisa_do_humano"
  /** Dois valores registrados, ou um valor que a validação recusa. */
  | "conflito"
  /** Não se resolve aqui. Foto se envia noutra tela; dizer isso é o serviço. */
  | "bloqueada";

export interface PendenciaClassificada {
  pendencia: PendenciaDoCatalogo;
  classificacao: Classificacao;
  /** Por que caiu nessa classe. Vai para a tela e para o log. */
  motivo: string;
  /** Só em `preparavel`: o valor que já se conhece, na unidade canônica. */
  valorConhecido?: number;
  /** Só em `resolvivel_por_fonte`: quem declarou saber. */
  fonte?: string;
}

/**
 * As pendências que NÃO se resolvem em conversa.
 *
 * Foto exige upload de arquivo. Dizer "preciso de fotos" num chat e não ter
 * onde recebê-las transformaria a resposta numa parede — melhor apontar a tela.
 */
const NAO_SE_RESOLVE_NA_CONVERSA: readonly TipoDePendencia[] = ["foto"];

export interface ContextoDaClassificacao {
  produtos: readonly ProdutoParaAnalise[];
  fontes: readonly FonteConectada[];
  /** Conflitos já detectados — de procedência ou de validação. */
  conflitos: readonly ConflitoDeProcedencia[];
}

/**
 * Classifica cada pendência. Determinístico, sem modelo nenhum no caminho.
 *
 * A ORDEM das checagens é a política:
 *
 *   1. conflito     — um valor em disputa não é "faltando", é "em dúvida"
 *   2. bloqueada    — não adianta classificar como humano o que não se pergunta aqui
 *   3. preparável   — o barato: o próprio produto já sabe
 *   4. fonte        — o que uma integração declara saber
 *   5. humano       — o resto, e é ele que vira decisão agrupada
 *
 * Trocar 1 por 3 prepararia uma Proposal com um dos dois valores em disputa —
 * exatamente a escolha automática que esta vertical existe para não fazer.
 */
export function classificarPendencias(
  pendencias: readonly PendenciaDoCatalogo[],
  ctx: ContextoDaClassificacao
): PendenciaClassificada[] {
  const porId = new Map(ctx.produtos.map((p) => [p.id, p]));
  const emConflito = new Set(
    ctx.conflitos.map((c) => `${c.alvo.id}|${campoDoConflito(c.campo)}`)
  );

  return pendencias.map((pendencia) => {
    const chaveConflito = `${pendencia.alvo.id}|${pendencia.tipo}`;
    const chaveNoProduto = `${pendencia.alvo.produtoId}|${pendencia.tipo}`;
    if (emConflito.has(chaveConflito) || emConflito.has(chaveNoProduto)) {
      return {
        pendencia,
        classificacao: "conflito",
        motivo: "Há mais de um valor registrado para este campo — preciso que você decida qual vale.",
      };
    }

    if (NAO_SE_RESOLVE_NA_CONVERSA.includes(pendencia.tipo)) {
      return {
        pendencia,
        classificacao: "bloqueada",
        motivo: "Isso se resolve na tela de imagens — eu não recebo arquivos por aqui.",
      };
    }

    // PREPARÁVEL: o próprio produto já conhece o valor. Hoje isto vale para o
    // peso de variantes que faltaram numa família já pesada — a mesma caixa,
    // medida pelo lojista, registrada nas irmãs.
    if (pendencia.tipo === "peso_variante") {
      const produto = porId.get(pendencia.alvo.produtoId);
      const conhecido = produto ? pesoConhecidoDoProduto(produto) : null;
      if (conhecido !== null) {
        return {
          pendencia,
          classificacao: "preparavel",
          motivo: `As outras variantes deste produto já estão com ${conhecido} g. Consigo preparar a aplicação sem te perguntar nada.`,
          valorConhecido: conhecido,
        };
      }
      // As irmãs pesadas DISCORDAM. O caminho de gravação desce o peso para
      // todas as variantes do produto — aplicar um dos dois valores
      // sobrescreveria o outro sem ninguém ter aprovado isso.
      const divergentes = produto ? pesosDivergentes(produto) : [];
      if (divergentes.length > 1) {
        return {
          pendencia,
          classificacao: "conflito",
          motivo: `As variantes deste produto têm pesos diferentes (${divergentes.join(" g, ")} g). Não sei qual vale para as que faltam.`,
        };
      }
    }

    const fonte = fonteQueSabe(pendencia.tipo, ctx.fontes);
    if (fonte) {
      return {
        pendencia,
        classificacao: "resolvivel_por_fonte",
        motivo: `${fonte.nome} declara saber esse dado. Posso consultar antes de te perguntar.`,
        fonte: fonte.nome,
      };
    }

    return {
      pendencia,
      classificacao: "precisa_do_humano",
      motivo: pendencia.impede,
    };
  });
}

/** O campo do conflito, traduzido para o tipo de pendência correspondente. */
function campoDoConflito(campo: string): string {
  const mapa: Record<string, TipoDePendencia> = {
    custo: "custo",
    precoVenda: "preco",
    preco: "preco",
    peso: "peso",
    pesoGramas: "peso",
    sku: "sku_variante",
    ean: "ean_variante",
  };
  return mapa[campo] ?? campo;
}

// ---------------------------------------------------------------------------
// agrupamento — o coração da vertical
// ---------------------------------------------------------------------------

export type EscopoDaDecisao =
  /**
   * UMA resposta serve para todos os alvos do grupo.
   *
   * Só quando o domínio prova: variantes do mesmo produto compartilham a caixa,
   * e o lote de peso já grava por `produto_id`. Entre produtos, o grupo é
   * OFERECIDO por marca+modelo exatos e confirmado pelo lojista — nunca aplicado
   * por suposição.
   */
  | "valor_compartilhado"
  /**
   * UMA pergunta, N respostas. O valor é específico de cada alvo.
   *
   * EAN e SKU identificam uma unidade; custo é de cada produto. Propagar
   * qualquer um deles grava o identificador de um no lugar do outro.
   */
  | "um_por_alvo";

export interface DecisaoHumana {
  /** Estável entre chamadas: tipo + chave do grupo. A tela referencia por ele. */
  id: string;
  tipo: TipoDePendencia;
  escopo: EscopoDaDecisao;
  /** A pergunta, pronta. Montada pelo domínio, não pelo modelo. */
  pergunta: string;
  alvos: readonly AlvoDaPendencia[];
  quantos: number;
  bloqueia: readonly Capacidade[];
  /**
   * Quantos alvos esta decisão destrava. Ordena a fila.
   *
   * Em `valor_compartilhado` é o grupo inteiro — uma resposta resolve todos. Em
   * `um_por_alvo` é 1: responder um EAN não adianta para os outros trinta.
   */
  destrava: number;
}

/** Onde o valor de cada tipo pode ser compartilhado — e só onde. */
const COMPARTILHAVEL: Partial<Record<TipoDePendencia, "produto" | "familia_exata">> = {
  // A caixa é do produto. As variantes dele saem na mesma embalagem, e o lote de
  // peso já grava por `produto_id`.
  peso: "familia_exata",
  peso_variante: "produto",
};

/**
 * As decisões humanas, agrupadas e priorizadas.
 *
 * A prioridade é por IMPACTO, não por volume: primeiro o que trava mais
 * capacidades, depois o que destrava mais alvos. Ordenar por quantidade mandaria
 * o lojista para 31 EANs — trinta e uma respostas que não destravam publicação
 * nenhuma — antes do peso que libera o preço da loja inteira.
 */
export function agruparDecisoes(
  classificadas: readonly PendenciaClassificada[],
  produtos: readonly ProdutoParaAnalise[]
): DecisaoHumana[] {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const grupos = new Map<string, { tipo: TipoDePendencia; alvos: AlvoDaPendencia[]; bloqueia: readonly Capacidade[] }>();

  for (const c of classificadas) {
    if (c.classificacao !== "precisa_do_humano") continue;
    const { pendencia } = c;
    const chave = chaveDoGrupo(pendencia, porId);
    const existente = grupos.get(chave);
    if (existente) existente.alvos.push(pendencia.alvo);
    else {
      grupos.set(chave, {
        tipo: pendencia.tipo,
        alvos: [pendencia.alvo],
        bloqueia: pendencia.bloqueia,
      });
    }
  }

  const decisoes: DecisaoHumana[] = [];
  for (const [id, g] of grupos) {
    const escopo: EscopoDaDecisao = COMPARTILHAVEL[g.tipo] ? "valor_compartilhado" : "um_por_alvo";
    decisoes.push({
      id,
      tipo: g.tipo,
      escopo,
      pergunta: perguntaDoGrupo(g.tipo, escopo, g.alvos),
      alvos: g.alvos,
      quantos: g.alvos.length,
      bloqueia: g.bloqueia,
      destrava: escopo === "valor_compartilhado" ? g.alvos.length : 1,
    });
  }

  return decisoes.sort(porImpacto);
}

/**
 * A chave do grupo.
 *
 * `familia_exata` usa marca+modelo das COLUNAS. Produto sem os dois não se
 * agrupa com ninguém: fica sozinho, com a própria chave. É o mesmo desenho de
 * `agruparPorFamilia`, mas sobre dado cadastrado em vez de texto do nome.
 */
function chaveDoGrupo(
  p: PendenciaDoCatalogo,
  porId: ReadonlyMap<string, ProdutoParaAnalise>
): string {
  const onde = COMPARTILHAVEL[p.tipo];
  if (onde === "produto") return `${p.tipo}|produto:${p.alvo.produtoId}`;
  if (onde === "familia_exata") {
    const produto = porId.get(p.alvo.produtoId);
    const chave = produto ? chaveExataDeFamilia(produto) : null;
    return chave ? `${p.tipo}|familia:${chave}` : `${p.tipo}|produto:${p.alvo.produtoId}`;
  }
  // Não compartilhável: um grupo por TIPO, que junta a PERGUNTA sem juntar a
  // resposta. "31 variantes sem EAN" é uma frase; continuam sendo 31 valores.
  return `${p.tipo}|todos`;
}

function perguntaDoGrupo(
  tipo: TipoDePendencia,
  escopo: EscopoDaDecisao,
  alvos: readonly AlvoDaPendencia[]
): string {
  const n = alvos.length;
  const um = n === 1;
  if (escopo === "valor_compartilhado") {
    const nome = alvos[0]?.rotulo ?? "";
    return um
      ? `Quanto pesa a caixa de ${nome}?`
      : `Quanto pesa a caixa? São ${n} ${n > 1 ? "unidades" : "unidade"} da mesma família, começando por ${nome}.`;
  }
  switch (tipo) {
    case "custo":
      return `Preciso do custo de ${n} produto${um ? "" : "s"}. Cada um tem o seu — não dá para aplicar um valor a todos.`;
    case "preco":
      return `Preciso do preço de venda de ${n} produto${um ? "" : "s"}.`;
    case "sku_variante":
      return `${n} variante${um ? "" : "s"} sem SKU. O SKU identifica uma unidade — preciso de um por variante.`;
    case "ean_variante":
      return `${n} variante${um ? "" : "s"} sem EAN. Não encontrei fonte confiável para preencher isso: preciso dos EANs.`;
    default:
      return `${n} pendência${um ? "" : "s"} de ${tipo}.`;
  }
}

/** Trava mais capacidades primeiro; empatou, destrava mais alvos primeiro. */
function porImpacto(a: DecisaoHumana, b: DecisaoHumana): number {
  if (b.bloqueia.length !== a.bloqueia.length) return b.bloqueia.length - a.bloqueia.length;
  if (b.destrava !== a.destrava) return b.destrava - a.destrava;
  return b.quantos - a.quantos;
}

// ---------------------------------------------------------------------------
// preparação — o que vira Proposal sem perguntar nada
// ---------------------------------------------------------------------------

export interface PreparacaoPronta {
  tipo: TipoDePendencia;
  /** O produto cujo peso conhecido preenche as variantes que faltam. */
  produtoId: string;
  rotulo: string;
  /** Gramas — a unidade canônica da Proposal de peso. */
  valor: number;
  /** As variantes que recebem. É esta lista que vira o escopo congelado. */
  alvos: readonly AlvoDaPendencia[];
  /** A frase que a pessoa lê antes de aprovar. */
  resumo: string;
}

/**
 * O que dá para preparar sem perguntar nada ao lojista.
 *
 * Uma preparação POR PRODUTO: o valor vem das variantes irmãs, então o escopo é
 * o produto. Juntar dois produtos numa preparação só usaria o peso de um no
 * outro — que é a generalização que o lote de peso já recusa fazer sozinho.
 */
export function prepararSemNovoDado(
  classificadas: readonly PendenciaClassificada[],
  produtos: readonly ProdutoParaAnalise[]
): PreparacaoPronta[] {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const porProduto = new Map<string, PendenciaClassificada[]>();

  for (const c of classificadas) {
    if (c.classificacao !== "preparavel") continue;
    const lista = porProduto.get(c.pendencia.alvo.produtoId) ?? [];
    lista.push(c);
    porProduto.set(c.pendencia.alvo.produtoId, lista);
  }

  const prontas: PreparacaoPronta[] = [];
  for (const [produtoId, itens] of porProduto) {
    const produto = porId.get(produtoId);
    if (!produto) continue;
    const valor = pesoConhecidoDoProduto(produto);
    if (valor === null) continue;
    // Os alvos vêm do CATÁLOGO relido, não da lista classificada: é o mesmo
    // desenho do lote, onde o escopo aprovado é uma lista de ids e não um
    // critério que pode crescer entre a leitura e o clique.
    const faltando = variantesSemPeso(produto);
    if (faltando.length === 0) continue;
    prontas.push({
      tipo: "peso_variante",
      produtoId,
      rotulo: produto.nome,
      valor,
      alvos: itens.map((i) => i.pendencia.alvo),
      resumo: `Aplicar ${valor} g às ${faltando.length} variante${faltando.length > 1 ? "s" : ""} de ${produto.nome} que estão sem peso. As outras já estão com esse peso.`,
    });
  }
  return prontas;
}

// ---------------------------------------------------------------------------
// o plano inteiro
// ---------------------------------------------------------------------------

export interface BloqueioAgrupado {
  tipo: TipoDePendencia;
  quantos: number;
  motivo: string;
}

export interface PlanoDeResolucao {
  analisadas: number;
  /** Prontas para virar Proposal, sem perguntar nada. */
  preparaveis: readonly PreparacaoPronta[];
  /** As perguntas, agrupadas e priorizadas. */
  decisoes: readonly DecisaoHumana[];
  conflitos: readonly ConflitoDeProcedencia[];
  bloqueadas: readonly BloqueioAgrupado[];
  /** Fontes que declararam saber algo — vazio hoje, e a frase diz por quê. */
  consultaveis: readonly { tipo: TipoDePendencia; fonte: string; quantos: number }[];
}

/**
 * "Resolva tudo que você conseguir."
 *
 * Devolve ESTRUTURA, não prosa: os números são do domínio, e o modelo só os
 * escreve. Um total que o Gemini calculasse seria um total que ele pode ter
 * errado — e o lojista decide o dia dele por esse número.
 */
export function planejarResolucao(
  pendencias: readonly PendenciaDoCatalogo[],
  ctx: ContextoDaClassificacao
): PlanoDeResolucao {
  const classificadas = classificarPendencias(pendencias, ctx);

  const bloqueadas = new Map<TipoDePendencia, BloqueioAgrupado>();
  const consultaveis = new Map<string, { tipo: TipoDePendencia; fonte: string; quantos: number }>();
  for (const c of classificadas) {
    if (c.classificacao === "bloqueada") {
      const atual = bloqueadas.get(c.pendencia.tipo);
      if (atual) atual.quantos += 1;
      else bloqueadas.set(c.pendencia.tipo, { tipo: c.pendencia.tipo, quantos: 1, motivo: c.motivo });
    }
    if (c.classificacao === "resolvivel_por_fonte" && c.fonte) {
      const chave = `${c.pendencia.tipo}|${c.fonte}`;
      const atual = consultaveis.get(chave);
      if (atual) atual.quantos += 1;
      else consultaveis.set(chave, { tipo: c.pendencia.tipo, fonte: c.fonte, quantos: 1 });
    }
  }

  return {
    analisadas: pendencias.length,
    preparaveis: prepararSemNovoDado(classificadas, ctx.produtos),
    decisoes: agruparDecisoes(classificadas, ctx.produtos),
    conflitos: ctx.conflitos,
    bloqueadas: [...bloqueadas.values()],
    consultaveis: [...consultaveis.values()],
  };
}

/**
 * O panorama que responde "o que precisa de mim?".
 *
 * Números do domínio. O Gemini recebe isto e escreve a frase; ele não soma nada.
 */
export interface PanoramaDePendencias {
  analisadas: number;
  semNovoDado: number;
  decisoes: number;
  alvosDasDecisoes: number;
  conflitos: number;
  bloqueadas: number;
  /** A decisão que destrava mais. `null` quando não há nenhuma. */
  primeira: DecisaoHumana | null;
  nadaAFazer: boolean;
}

export function panorama(plano: PlanoDeResolucao): PanoramaDePendencias {
  const semNovoDado = plano.preparaveis.reduce((soma, p) => soma + p.alvos.length, 0);
  const alvosDasDecisoes = plano.decisoes.reduce((soma, d) => soma + d.quantos, 0);
  const bloqueadas = plano.bloqueadas.reduce((soma, b) => soma + b.quantos, 0);
  return {
    analisadas: plano.analisadas,
    semNovoDado,
    decisoes: plano.decisoes.length,
    alvosDasDecisoes,
    conflitos: plano.conflitos.length,
    bloqueadas,
    primeira: plano.decisoes[0] ?? null,
    nadaAFazer: plano.analisadas === 0,
  };
}

/**
 * "Por que este produto está travado?"
 *
 * Drill-down do produto até a variante, com o dado que falta e a consequência.
 * Devolve `null` quando não há nada travado — e aí a resposta é essa, em vez de
 * inventar uma pendência para parecer útil.
 */
export interface ExplicacaoDeBloqueio {
  produtoId: string;
  nome: string;
  variantes: number;
  /** Uma linha por tipo de pendência, com quantos alvos e o que impede. */
  motivos: readonly { tipo: TipoDePendencia; quantos: number; impede: string; bloqueia: readonly Capacidade[] }[];
  /** As capacidades realmente travadas, sem repetir. */
  travadas: readonly Capacidade[];
}

export function explicarBloqueio(
  produto: ProdutoParaAnalise,
  pendencias: readonly PendenciaDoCatalogo[]
): ExplicacaoDeBloqueio | null {
  const doProduto = pendencias.filter((p) => p.alvo.produtoId === produto.id);
  if (doProduto.length === 0) return null;

  const porTipo = new Map<TipoDePendencia, { quantos: number; impede: string; bloqueia: readonly Capacidade[] }>();
  for (const p of doProduto) {
    const atual = porTipo.get(p.tipo);
    if (atual) atual.quantos += 1;
    else porTipo.set(p.tipo, { quantos: 1, impede: p.impede, bloqueia: p.bloqueia });
  }

  const travadas = new Set<Capacidade>();
  for (const p of doProduto) for (const c of p.bloqueia) travadas.add(c);

  return {
    produtoId: produto.id,
    nome: produto.nome,
    variantes: produto.variantes.length,
    motivos: [...porTipo.entries()].map(([tipo, v]) => ({ tipo, ...v })),
    travadas: [...travadas],
  };
}
