// Preço e margem em conversa — e a matemática continua onde sempre esteve.
//
// ESTE MÓDULO NÃO CALCULA NADA POR CONTA PRÓPRIA.
//
// Toda conta vem de `modeloPreco`, que é a autoridade e não foi tocada:
//
//   comissaoPercentual   API do ML quando há, tabela de Moda quando não
//   taxaFixaVenda        da API, zero quando não vem
//   envioDoModelo        tabela oficial: peso cobrável × faixa de preço × reputação
//   custoDaVenda         comissão + taxa fixa + envio + custos do lojista
//   lucroLiquido         preço − custo − custo da venda
//   margemLiquida        lucro / preço, em %
//   precoMinimo          a INVERSÃO: o menor preço que entrega a margem pedida
//
// O que existe aqui é COMPOSIÇÃO e ESTADO: decompor o preço em parcelas
// nomeadas, dizer quando a conta não fecha e por quê, simular cenários, e
// classificar um catálogo. É o que uma conversa precisa e o motor não devolvia
// junto.
//
// ---------------------------------------------------------------------------
// O GEMINI NÃO FAZ CONTA DE DINHEIRO.
//
// "Se eu vender por R$ 89,90, quanto sobra?" não vira `89.90 - custo - ...` num
// modelo de linguagem. Vira `simular([8990], entradas)`, e o modelo lê a
// estrutura de volta. A diferença aparece no dia em que a comissão muda: a
// conta muda com ela, e a frase do modelo continua certa porque ele não a fez.
//
// ---------------------------------------------------------------------------
// MARGEM, NESTE SISTEMA, É MARGEM LÍQUIDA SOBRE O PREÇO DE VENDA.
//
//     margem % = (preço − custo − comissão − taxa fixa − envio − custos do
//                 lojista) / preço × 100
//
// NÃO é markup (lucro sobre o custo). NÃO é margem bruta (sem as taxas). Os
// dois dariam números maiores e mais bonitos para o mesmo produto, e é
// exatamente por isso que a distinção precisa estar escrita: "10% de margem" e
// "10% de markup" pedem preços diferentes, e o lojista que confunde os dois
// vende no prejuízo achando que está ganhando.
//
// A conversão implícita entre os dois é PROIBIDA aqui — não existe função que
// a faça.

import {
  classificarMargem,
  comissaoPercentual,
  custoDaVenda,
  envioDoModelo,
  lucroLiquido,
  margemLiquida,
  precoMinimo,
  taxaFixaVenda,
  TAXAS_PADRAO,
  type ModeloTaxas,
  type SaudeMargem,
} from "./modeloPreco.ts";
import {
  custoPercentualEmReais,
  fixosDoLojista,
  percentuaisDoLojista,
  SEM_CUSTOS_DO_LOJISTA,
  type CustosDoLojista,
} from "./custosDoLojista.ts";
import { nomeDoTipoDeAnuncio, pesoCobravelGramas } from "./custosML.ts";

// ---------------------------------------------------------------------------
// de onde vem cada número
// ---------------------------------------------------------------------------

/**
 * A comissão do marketplace tem TRÊS estados, e confundi-los é o erro caro.
 *
 * `api` é o que o ML afirma para a categoria exata daquele produto naquele
 * preço. `tabela` é a nossa de Moda — serve para conversar e NÃO serve para
 * prometer. `indisponivel` é quando nem uma nem outra: aí não se inventa
 * percentual, o resultado é bloqueado.
 */
/**
 * De onde saiu o percentual de comissão do cálculo.
 *
 * `anuncio` entrou em 24/08/2026 e é o único que fala do ANÚNCIO em questão:
 * o `listing_type_id` que o próprio Mercado Livre informou para aquele MLB.
 * Antes dele, o tipo vinha de `canais_marketplace` — uma configuração da LOJA
 * INTEIRA com padrão "Premium" — enquanto o ML dizia anúncio por anúncio e a
 * importação descartava. Em Moda são 14% contra 19%: cinco pontos sobre o
 * número que decide preço, errados em silêncio numa loja com os dois tipos.
 *
 * `tabela` continua sendo a resposta honesta quando não se sabe o tipo, e é
 * por isso que os dois não podem ser o mesmo valor: o lojista precisa saber
 * quando o número é sobre o anúncio dele e quando é sobre a média.
 */
export type OrigemDaComissao = "api" | "anuncio" | "tabela" | "indisponivel";

/**
 * A procedência dos inputs do cálculo.
 *
 * Não é confiança — é rastro, do mesmo jeito que `procedenciaDeCampo`. "Veio da
 * API" não torna o número certo; torna-o verificável.
 */
export interface ProcedenciaDoCalculo {
  comissao: OrigemDaComissao;
  /** `medida` quando a embalagem existe; `ausente` quando não há peso. */
  envio: "tabela_oficial" | "nao_se_aplica" | "ausente";
  /** `informados` quando o lojista preencheu imposto/cupom/embalagem. */
  custosDoLojista: "informados" | "zerados";
  reputacao: "api" | "padrao";
}

// ---------------------------------------------------------------------------
// entrada
// ---------------------------------------------------------------------------

export interface EntradasDoPreco {
  /** Custo do produto em REAIS — a unidade que `modeloPreco` fala. */
  custo: number;
  /** O preço de hoje. 0 = ainda não tem. */
  precoAtual: number;
  /** O modelo montado pela borda: embalagem, reputação, custos, API. */
  taxas: ModeloTaxas;
  /** A margem que o lojista escolheu, em %. */
  margemMinima: number;
  procedencia: ProcedenciaDoCalculo;
  /**
   * Há conflito ou anomalia no custo?
   *
   * Vem de fora — de `anomaliasDoCatalogo` e da procedência. Um custo de
   * R$ 30.277.872 não pode produzir uma recomendação de preço com cara de
   * precisa, e "veio da planilha" não o torna válido.
   */
  custoEmConflito?: string | null;
}

// ---------------------------------------------------------------------------
// estado
// ---------------------------------------------------------------------------

export type EstadoDoPreco =
  /** Dá para calcular: todos os inputs obrigatórios existem. */
  | "calculavel"
  /** Falta input. `bloqueios` diz qual. */
  | "bloqueado"
  /** O custo está em disputa ou é absurdo. Não se recomenda preço sobre isso. */
  | "conflito";

export interface Avaliacao {
  estado: EstadoDoPreco;
  /** O que impede, em português de lojista. Vazio quando calculável. */
  bloqueios: readonly string[];
}

/**
 * Dá para calcular?
 *
 * A ORDEM é a política: conflito ANTES de bloqueio. Um custo em disputa não é
 * "falta custo" — é "o custo que eu tenho não serve", e responder "informe o
 * custo" mandaria o lojista preencher um campo que já está preenchido.
 */
export function avaliar(e: EntradasDoPreco): Avaliacao {
  if (e.custoEmConflito) {
    return { estado: "conflito", bloqueios: [e.custoEmConflito] };
  }
  const bloqueios: string[] = [];
  if (!(e.custo > 0)) bloqueios.push("o custo do produto");
  if (e.procedencia.comissao === "indisponivel") {
    bloqueios.push("a comissão do Mercado Livre");
  }
  // O envio é `null` só quando falta peso E o vendedor paga o frete. Quem
  // pergunta ao domínio é `envioDoModelo`, e é ele quem sabe quando o peso é
  // dispensável.
  if (envioDoModelo(e.precoAtual > 0 ? e.precoAtual : 100, e.taxas) === null) {
    bloqueios.push("o peso da embalagem");
  }
  return bloqueios.length === 0
    ? { estado: "calculavel", bloqueios: [] }
    : { estado: "bloqueado", bloqueios };
}

// ---------------------------------------------------------------------------
// decomposição — "por que ficou R$ X?"
// ---------------------------------------------------------------------------

/**
 * O preço aberto em parcelas nomeadas.
 *
 * Todas em REAIS, todas somando de volta ao preço. É o contrato que a
 * explicação depende: se as parcelas não fecham, a frase do modelo mente sem
 * que ninguém perceba.
 */
export interface Decomposicao {
  preco: number;
  custoProduto: number;
  comissaoML: number;
  taxaFixaML: number;
  envio: number;
  /** Imposto + gestor + sistema + cupom, em reais neste preço. */
  percentuaisDoLojista: number;
  /** Embalagem + etiqueta + informativos, por pedido. */
  fixosDoLojista: number;
  lucro: number;
  margem: number;
  saude: SaudeMargem;
}

/** Os custos do lojista deste modelo, já normalizados. */
function custosDo(taxas: ModeloTaxas): CustosDoLojista {
  return taxas.custosDoLojista ?? SEM_CUSTOS_DO_LOJISTA;
}

/**
 * O preço decomposto — ou `null` quando a conta não fecha.
 *
 * `null` e não um total parcial: um lucro calculado sem o envio parece um lucro
 * e é outra coisa. É a mesma regra de `custoDaVenda`, que devolve `total: null`
 * em vez de somar o que tem.
 */
export function decompor(preco: number, e: EntradasDoPreco): Decomposicao | null {
  if (!(preco > 0)) return null;
  const venda = custoDaVenda(preco, e.taxas);
  if (venda.total === null || venda.envio === null) return null;
  const lucro = lucroLiquido(e.custo, preco, e.taxas);
  const margem = margemLiquida(e.custo, preco, e.taxas);
  if (lucro === null || margem === null) return null;

  const c = custosDo(e.taxas);
  return {
    preco,
    custoProduto: e.custo,
    comissaoML: venda.comissao,
    taxaFixaML: venda.taxaFixa,
    envio: venda.envio,
    percentuaisDoLojista: custoPercentualEmReais(preco, c),
    fixosDoLojista: fixosDoLojista(c),
    lucro,
    margem,
    saude: classificarMargem(margem, e.margemMinima),
  };
}

/**
 * As parcelas fecham no preço?
 *
 * Existe como função para o TESTE poder chamá-la. Uma decomposição que não soma
 * de volta é uma explicação errada com aparência de certa, e é o tipo de erro
 * que só aparece quando o lojista faz a conta no papel.
 */
export function parcelasFecham(d: Decomposicao): boolean {
  const soma =
    d.custoProduto +
    d.comissaoML +
    d.taxaFixaML +
    d.envio +
    d.percentuaisDoLojista +
    d.fixosDoLojista +
    d.lucro;
  // Um centavo de folga: cada parcela é arredondada no centavo pelo motor, e
  // sete arredondamentos podem somar um centavo de diferença.
  return Math.abs(soma - d.preco) <= 0.01;
}

// ---------------------------------------------------------------------------
// simulação
// ---------------------------------------------------------------------------

export type Cenario =
  | { preco: number; ok: true; decomposicao: Decomposicao }
  | { preco: number; ok: false; motivo: string };

/**
 * "Simula R$ 79,90, R$ 84,90 e R$ 89,90."
 *
 * Um cenário por preço, cada um com a própria conta. NÃO se reaproveita a
 * comissão entre preços: a tarifa do ML é consultada COM o preço
 * (`/sites/MLB/listing_prices?price=…`) e o envio é uma matriz peso × FAIXA DE
 * PREÇO. Dois preços em faixas diferentes têm envios diferentes, e reusar o
 * primeiro produziria uma tabela plausível e errada.
 *
 * O que se reaproveita é o `ModeloTaxas` — a embalagem, a reputação e os custos
 * do lojista não mudam com o preço. Quando a comissão vier da API por preço, a
 * borda monta um `taxas` por cenário; a conta aqui não muda.
 */
export function simular(precos: readonly number[], e: EntradasDoPreco): Cenario[] {
  const a = avaliar(e);
  return precos.map((preco) => {
    if (!(preco > 0)) return { preco, ok: false as const, motivo: "Preço inválido." };
    if (a.estado !== "calculavel") {
      return { preco, ok: false as const, motivo: `Falta ${a.bloqueios.join(" e ")}.` };
    }
    const d = decompor(preco, e);
    return d
      ? { preco, ok: true as const, decomposicao: d }
      : { preco, ok: false as const, motivo: "Não consigo fechar a conta neste preço." };
  });
}

/** Simula com um `ModeloTaxas` próprio por cenário — quando a API entra. */
export function simularComTaxasPorPreco(
  precos: readonly { preco: number; taxas: ModeloTaxas }[],
  e: EntradasDoPreco
): Cenario[] {
  return precos.map(({ preco, taxas }) => {
    const cenarios = simular([preco], { ...e, taxas });
    return cenarios[0];
  });
}

// ---------------------------------------------------------------------------
// alvos de preço
// ---------------------------------------------------------------------------

export type Alvo =
  | { ok: true; preco: number; decomposicao: Decomposicao }
  | { ok: false; motivo: string };

/**
 * "Qual o menor preço com 10% de margem?"
 *
 * A INVERSÃO já existe em `precoMinimo` e é dele — ela resolve
 * `preco = (custo + fixos + envio_da_faixa) / (1 − percentuais − margem)` faixa
 * a faixa, porque o envio depende do preço que se quer descobrir. Reimplementar
 * isso aqui produziria uma segunda resposta para a mesma pergunta.
 */
export function precoParaMargem(margemDesejada: number, e: EntradasDoPreco): Alvo {
  const a = avaliar(e);
  if (a.estado !== "calculavel") {
    return { ok: false, motivo: `Falta ${a.bloqueios.join(" e ")}.` };
  }
  const r = precoMinimo(e.custo, margemDesejada, e.taxas);
  if (!r.ok) {
    return {
      ok: false,
      motivo:
        r.motivo === "sem_peso"
          ? r.pendencia
          : "Comissão e margem juntas passam de 100% — não existe preço que entregue essa margem.",
    };
  }
  const d = decompor(r.preco, e);
  return d ? { ok: true, preco: r.preco, decomposicao: d } : { ok: false, motivo: "Não consigo fechar a conta." };
}

/**
 * "Qual o menor preço sem perder dinheiro?"
 *
 * Margem ZERO: lucro líquido ≥ 0 depois de custo, comissão, envio, taxa fixa e
 * custos do lojista. Não é "o custo do produto" — é o custo de VENDER, que num
 * chinelo de R$ 30 chega a dobrar o número.
 */
export function precoSemPrejuizo(e: EntradasDoPreco): Alvo {
  return precoParaMargem(0, e);
}

// ---------------------------------------------------------------------------
// o preço de hoje
// ---------------------------------------------------------------------------

export interface SituacaoDoPreco {
  estado: EstadoDoPreco;
  bloqueios: readonly string[];
  /** A conta do preço de hoje. `null` quando não há preço ou não fecha. */
  hoje: Decomposicao | null;
  /** O piso da margem escolhida. `null` quando não dá para calcular. */
  minimoNaMargem: number | null;
  /** O piso sem prejuízo. `null` quando não dá para calcular. */
  minimoSemPrejuizo: number | null;
  procedencia: ProcedenciaDoCalculo;
}

/**
 * "Esse produto está dando prejuízo?"
 *
 * Devolve a situação inteira, e ela sabe dizer NÃO SEI. Responder "não" quando
 * falta o custo seria afirmar saúde a partir de ausência — a família de defeito
 * que já produziu R$ 1,77 de piso e lucro de uma sandália que não custou nada.
 */
export function situacaoDoPreco(e: EntradasDoPreco): SituacaoDoPreco {
  const a = avaliar(e);
  const naMargem = precoParaMargem(e.margemMinima, e);
  const semPrejuizo = precoSemPrejuizo(e);
  return {
    estado: a.estado,
    bloqueios: a.bloqueios,
    hoje: e.precoAtual > 0 && a.estado === "calculavel" ? decompor(e.precoAtual, e) : null,
    minimoNaMargem: naMargem.ok ? naMargem.preco : null,
    minimoSemPrejuizo: semPrejuizo.ok ? semPrejuizo.preco : null,
    procedencia: e.procedencia,
  };
}

// ---------------------------------------------------------------------------
// triagem em lote
// ---------------------------------------------------------------------------

export type ClasseDoPreco =
  | "prejuizo"
  | "abaixo_da_margem"
  | "saudavel"
  | "sem_preco"
  | "bloqueado"
  | "conflito";

export interface ItemDaTriagem {
  produtoId: string;
  nome: string;
  classe: ClasseDoPreco;
  /** Só quando calculável: a margem de hoje, em %. */
  margem?: number;
  /** Só quando bloqueado: o que falta. */
  falta?: readonly string[];
}

export interface Triagem {
  analisados: number;
  prejuizo: number;
  abaixoDaMargem: number;
  saudaveis: number;
  semPreco: number;
  bloqueados: number;
  conflitos: number;
  itens: readonly ItemDaTriagem[];
  /**
   * A comissão usada na triagem.
   *
   * SEMPRE `tabela` no lote, e isto é uma escolha declarada: a tarifa exata do
   * ML é consultada por PRODUTO e por PREÇO, e uma varredura de 300 produtos
   * seriam 300 chamadas com rotação de credencial em cada uma. A triagem local
   * acha quem está em risco; o número exato sai do produto, um a um.
   */
  comissaoUsada: OrigemDaComissao;
  truncado: boolean;
  totalNoCatalogo: number;
}

export interface ProdutoParaTriagem {
  id: string;
  nome: string;
  custo: number;
  precoVenda: number;
  taxas: ModeloTaxas;
  custoEmConflito?: string | null;
}

/**
 * "Quais produtos estão abaixo da margem?"
 *
 * Roda no BACKEND, sobre a tabela. Devolve contagens e itens enxutos — nunca o
 * catálogo inteiro para o modelo somar.
 */
export function triarCatalogo(
  produtos: readonly ProdutoParaTriagem[],
  margemMinima: number,
  procedenciaPadrao: ProcedenciaDoCalculo,
  totalNoCatalogo = produtos.length
): Triagem {
  const itens: ItemDaTriagem[] = produtos.map((p) => {
    const e: EntradasDoPreco = {
      custo: p.custo,
      precoAtual: p.precoVenda,
      taxas: p.taxas,
      margemMinima,
      procedencia: procedenciaPadrao,
      custoEmConflito: p.custoEmConflito ?? null,
    };
    const a = avaliar(e);
    if (a.estado === "conflito") {
      return { produtoId: p.id, nome: p.nome, classe: "conflito", falta: a.bloqueios };
    }
    if (a.estado === "bloqueado") {
      return { produtoId: p.id, nome: p.nome, classe: "bloqueado", falta: a.bloqueios };
    }
    if (!(p.precoVenda > 0)) {
      return { produtoId: p.id, nome: p.nome, classe: "sem_preco" };
    }
    const d = decompor(p.precoVenda, e);
    if (!d) return { produtoId: p.id, nome: p.nome, classe: "bloqueado", falta: ["a conta não fecha"] };
    const classe: ClasseDoPreco =
      d.margem < 0 ? "prejuizo" : d.margem < margemMinima ? "abaixo_da_margem" : "saudavel";
    return { produtoId: p.id, nome: p.nome, classe, margem: d.margem };
  });

  const contar = (c: ClasseDoPreco) => itens.filter((i) => i.classe === c).length;
  return {
    analisados: itens.length,
    prejuizo: contar("prejuizo"),
    abaixoDaMargem: contar("abaixo_da_margem"),
    saudaveis: contar("saudavel"),
    semPreco: contar("sem_preco"),
    bloqueados: contar("bloqueado"),
    conflitos: contar("conflito"),
    itens,
    comissaoUsada: procedenciaPadrao.comissao,
    truncado: totalNoCatalogo > itens.length,
    totalNoCatalogo,
  };
}

// ---------------------------------------------------------------------------
// precondições da Proposal
// ---------------------------------------------------------------------------

/** Os campos que, se mudarem, invalidam um preço calculado. */
export const CAMPO_CUSTO = "custoDoProduto";
export const CAMPO_PRECO_ATUAL = "precoAtual";
export const CAMPO_PESO_COBRAVEL = "pesoCobravelGramas";
export const CAMPO_CONFIGURACAO = "impressaoDaConfiguracao";

/**
 * A impressão da configuração financeira do lojista.
 *
 * Imposto, cupom, comissões internas e custos fixos entram no cálculo inteiro.
 * Se o lojista mudar o imposto de 12% para 18% entre a proposta e o clique, o
 * preço que ele aprovou deixou de entregar a margem que ele leu — e gravar
 * assim mesmo seria executar uma decisão sobre um mundo que não existe mais.
 *
 * Hash de 31 bits pela mesma razão do título: as precondições são numéricas.
 * O que se perde é dizer O QUE mudou; o resumo da proposta mostra o que valia.
 */
export function impressaoDaConfiguracao(c: CustosDoLojista): number {
  const partes = [
    c.embalagem,
    c.etiqueta,
    c.informativos,
    c.impostoPercentual,
    c.comissaoGestorPercentual,
    c.comissaoSistemaPercentual,
    c.cupomPercentual,
  ];
  let h = 0;
  for (const p of partes) {
    // Centavos/centésimos inteiros: 12.5 e 12.50 têm que dar a mesma impressão.
    const n = Math.round(p * 100);
    h = (h * 31 + n) | 0;
  }
  return Math.abs(h);
}

/**
 * As precondições de uma proposta de preço.
 *
 * TUDO que muda a conta materialmente. A comissão da API não entra: ela é
 * consultada COM o preço, e o preço é justamente o que a proposta congela —
 * revalidá-la exigiria uma chamada externa dentro da confirmação, e uma falha
 * de rede viraria "obsoleta" para uma proposta perfeitamente boa.
 */
export function precondicoesDePreco(e: {
  custo: number;
  precoAtual: number;
  taxas: ModeloTaxas;
}): { campo: string; valorNaCriacao: number | null }[] {
  const c = e.taxas.custosDoLojista ?? SEM_CUSTOS_DO_LOJISTA;
  return [
    { campo: CAMPO_CUSTO, valorNaCriacao: e.custo > 0 ? Math.round(e.custo * 100) : null },
    {
      campo: CAMPO_PRECO_ATUAL,
      valorNaCriacao: e.precoAtual > 0 ? Math.round(e.precoAtual * 100) : null,
    },
    {
      campo: CAMPO_PESO_COBRAVEL,
      valorNaCriacao: e.taxas.embalagem ? Math.round(pesoCobravelGramas(e.taxas.embalagem)) : null,
    },
    { campo: CAMPO_CONFIGURACAO, valorNaCriacao: impressaoDaConfiguracao(c) },
  ];
}

// ---------------------------------------------------------------------------
// leitura humana
// ---------------------------------------------------------------------------

/**
 * O resumo que a pessoa lê antes de autorizar.
 *
 * O preço, a margem que ele entrega e o lucro em reais. Os três juntos porque
 * "12% de margem" não diz quanto entra no bolso, e "R$ 11 de lucro" não diz se
 * isso é bom.
 */
export function resumoDaProposta(nome: string, d: Decomposicao): string {
  return `Colocar ${escreverReais(d.preco)} em "${nome}" — ${d.margem}% de margem, ${escreverReais(d.lucro)} de lucro por venda.`;
}

export function escreverReais(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

/**
 * A comissão em uma frase, com a honestidade do estado dela.
 *
 * "Estimada" precisa aparecer. Um percentual de tabela apresentado como o da
 * conta do lojista é a diferença entre uma conversa e uma promessa.
 */
export function escreverComissao(e: EntradasDoPreco): string {
  const pct = comissaoPercentual(e.taxas);
  const fixa = taxaFixaVenda(e.taxas);
  const sufixo = fixa > 0 ? ` mais ${escreverReais(fixa)} por venda` : "";
  switch (e.procedencia.comissao) {
    case "api":
      return `${pct}% da sua conta no Mercado Livre${sufixo}.`;
    case "anuncio":
      // O TIPO É DITO. "19%" sozinho não deixa a lojista conferir; "19%,
      // porque este anúncio é Premium" deixa — e é ela quem sabe se o anúncio
      // deveria ser Premium.
      return `${pct}% — este anúncio é ${nomeDoTipoDeAnuncio(e.taxas.tipoAnuncio)} no Mercado Livre${sufixo}.`;
    case "tabela":
      return `${pct}% — estimativa da tabela de Moda, não a comissão exata da sua conta${sufixo}.`;
    case "indisponivel":
      return "Não consegui a comissão do Mercado Livre.";
  }
}

/** Os percentuais do lojista, para a explicação poder citá-los. */
export function percentuaisDoLojistaDe(taxas: ModeloTaxas = TAXAS_PADRAO): number {
  return percentuaisDoLojista(custosDo(taxas));
}
