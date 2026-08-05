// A preparação de um anúncio — o estado, as etapas e o que trava cada uma.
//
// ESTE MÓDULO NÃO GERA NADA. Ele não escreve título, não escolhe categoria e
// não calcula preço. Os motores disso já existem e continuam donos do assunto:
//
//   identidade  ->  publication/domain/atributosDoMarketplace   (os 6 do ML)
//   grade       ->  publication/domain/variacoesDoAnuncio        (SKU/EAN reais)
//   conteúdo    ->  agentes/catalogo A0–A12 + cadeiaEsteira      (roda no navegador)
//   pricing     ->  pricing/domain/modeloPreco                   (piso, envio, margem)
//   cadastro    ->  catalog/domain/lacunasDoProduto              (custo, peso, foto)
//
// O que faltava era o ORQUESTRADOR: quem sabe em que estado cada produto está,
// quais etapas dependem de quais, o que pode rodar agora e o que está travado.
// Sem ele, "prepare esse produto" só tinha duas respostas — tudo ou nada — e a
// pergunta "por que esse não foi?" não tinha resposta nenhuma.
//
// ---------------------------------------------------------------------------
// A DEPENDÊNCIA REAL, descoberta inspecionando o pipeline — não suposta:
//
//   IDENTIDADE  (marca, modelo, gênero, cor, tamanho, tipo)
//        │
//        ├──► CONTEÚDO   título, descrição, ficha. NÃO depende de custo,
//        │               peso nem foto: a esteira escreve texto a partir da
//        │               identidade do produto e da grade.
//        │
//   PRICING      custo + peso. INDEPENDENTE do conteúdo — os dois avançam
//                em paralelo, e é por isso que "prepare o que conseguir"
//                consegue avançar um com o outro travado.
//        │
//   IMAGENS      independente dos dois.
//        │
//        └──► PUBLICAÇÃO   exige conteúdo aprovado + imagem + preço + grade
//                          publicável. É a única que depende de todas.
//
// ---------------------------------------------------------------------------
// DUAS PERGUNTAS DIFERENTES SOBRE CONTEÚDO, e confundi-las era o buraco:
//
//   "dá para gerar o texto?"        -> identidade basta
//   "vale gastar a cota AGORA?"     -> não, se o anúncio vai voltar com
//                                      pendência de foto, custo ou peso
//
// A segunda é POLÍTICA, e é a que `propor_anuncio` sempre usou — está
// documentada e testada desde o PR #84. Ela continua idêntica em
// `bloqueiosParaGerar`. A primeira é FATO sobre o pipeline, e é ela que permite
// dizer "o texto eu consigo, o preço não".

import {
  OBRIGATORIOS_CALCADO,
  resolverObrigatorios,
  type AtributoResolvido,
  type DadosDoProduto,
  type ExigenciaDaCategoria,
} from "./atributosDoMarketplace";
import { gradePublicavel, montarVariacoes, type VarianteDaBase } from "./variacoesDoAnuncio";
import { lacunasDoProduto, type EstadoDoProduto } from "../../catalog/domain/lacunasDoProduto";
import {
  precoMinimo,
  MARGEM_MINIMA_PADRAO,
  TAXAS_PADRAO,
  type ModeloTaxas,
} from "../../pricing/domain/modeloPreco.ts";

// ---------------------------------------------------------------------------
// entrada
// ---------------------------------------------------------------------------

export interface ProdutoParaPreparar {
  id: string;
  nome: string;
  marca: string;
  modelo: string;
  custo: number;
  precoVenda: number;
  /** O MAIOR entre as variantes, em gramas. 0 = nenhuma tem peso. */
  pesoGramas: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
  quantidadeImagens: number;
  /** `false` dispensa o peso — sem custo de envio, ele não entra em conta. */
  vendedorPagaFrete?: boolean;
  /** A grade cadastrada. É dela que saem cor, tamanho, SKU e EAN do anúncio. */
  variantes: readonly VarianteDaBase[];
}

/** O anúncio que já existe para este produto, no mínimo que a decisão precisa. */
export interface AnuncioJaGerado {
  status: string;
  vereditoA10: string;
  qtdPendencias: number;
  mlItemId?: string | null;
}

// ---------------------------------------------------------------------------
// etapas
// ---------------------------------------------------------------------------

export type EtapaDaPreparacao =
  /** Marca, modelo, gênero, cor, tamanho, tipo — o que o ML exige. */
  | "identidade"
  /** Título, descrição, ficha técnica, medidas. Roda a esteira. */
  | "conteudo"
  | "imagens"
  | "pricing"
  | "publicacao";

export type SituacaoDaEtapa =
  /** Já resolvida — nada a fazer. */
  | "pronta"
  /** Pode rodar agora. */
  | "apta"
  /** Falta dado, ou uma etapa da qual ela depende. */
  | "bloqueada"
  /** O domínio diz que ela não se aplica a este produto. */
  | "nao_se_aplica";

export interface EtapaAvaliada {
  etapa: EtapaDaPreparacao;
  situacao: SituacaoDaEtapa;
  /** O que falta, em português de lojista. Vazio quando pronta ou apta. */
  faltando: readonly string[];
  /** A consequência — por que isso importa. */
  porque: string;
  /** De quais etapas ela depende. Vazio = independente. */
  depende: readonly EtapaDaPreparacao[];
}

/**
 * O estado do produto na preparação.
 *
 * `em_preparacao` NÃO existe aqui de propósito: a esteira roda no navegador e
 * grava o progresso em `localStorage` (`progressoGeracao`). O servidor não
 * consegue observar isso, e inventar um estado que ele não mede produziria uma
 * tela afirmando "preparando" para uma aba que já fechou.
 */
export type EstadoDaPreparacao =
  /** Identidade incompleta — nem o texto sai. */
  | "nao_apto"
  /** O texto sairia, mas voltaria com pendência. O humano resolve antes. */
  | "precisa_humano"
  /** Pode gerar agora. */
  | "apto_para_preparar"
  /** O anúncio existe, com pendências. */
  | "preparado"
  /** O anúncio existe, aprovado, com imagem, preço e grade publicável. */
  | "pronto_para_publicar"
  /** Já está no ar. */
  | "publicado";

export interface Preparacao {
  produtoId: string;
  nome: string;
  estado: EstadoDaPreparacao;
  etapas: readonly EtapaAvaliada[];
  /** Os 6 obrigatórios do ML, com a origem de cada um. */
  identidade: readonly AtributoResolvido[];
  /**
   * O que impede GERAR AGORA — a política de não queimar cota.
   *
   * É exatamente a lista que `propor_anuncio` sempre usou. Diferente de
   * `etapas`, que responde o que é tecnicamente possível.
   */
  bloqueiosParaGerar: readonly string[];
  /** A próxima etapa que pode rodar. `null` quando não há. */
  proximaEtapa: EtapaDaPreparacao | null;
  /** Já existe anúncio gerado? Refazer é legítimo, mas se diz. */
  jaTemAnuncio: boolean;
}

// ---------------------------------------------------------------------------
// avaliação
// ---------------------------------------------------------------------------

const PORQUE: Record<EtapaDaPreparacao, string> = {
  identidade:
    "O Mercado Livre exige marca, modelo, gênero, cor, tamanho e tipo. Sem eles o anúncio não é aceito.",
  conteudo: "Título, descrição e ficha técnica. É o que a esteira escreve a partir do cadastro.",
  imagens: "O Mercado Livre não aceita anúncio sem imagem.",
  pricing: "Sem custo e peso não há frete, e sem frete não existe preço mínimo.",
  publicacao: "Só vai ao ar com texto aprovado, imagem, preço e a grade completa.",
};

export interface OpcoesDaPreparacao {
  margemMinima?: number;
  taxas?: ModeloTaxas;
  /**
   * O que a CATEGORIA deste produto exige. Omitido = calçado.
   *
   * A rede fica de fora daqui de propósito. `avaliarPreparacao` é
   * determinística — "por que esse produto não foi preparado?" precisa ter a
   * mesma resposta toda vez —, e uma consulta ao Mercado Livre dentro dela
   * faria a resposta depender de quando alguém perguntou.
   *
   * Então quem tem a categoria resolve os obrigatórios ANTES (`/api/ml/categoria`)
   * e passa a lista aqui. Quem não tem continua com o padrão de calçado, que é
   * exatamente o comportamento de antes — nenhum produto que funciona hoje muda.
   */
  obrigatorios?: readonly ExigenciaDaCategoria[];
}

/**
 * O estado da preparação deste produto.
 *
 * Determinístico: nenhuma parte disto depende do que um modelo respondeu. É o
 * ponto — "por que esse produto não foi preparado?" precisa ter a mesma resposta
 * toda vez que alguém perguntar.
 */
export function avaliarPreparacao(
  p: ProdutoParaPreparar,
  anuncio: AnuncioJaGerado | null = null,
  opcoes: OpcoesDaPreparacao = {}
): Preparacao {
  // A lista da CATEGORIA quando quem chamou a tem; calçado quando não tem.
  //
  // O padrão continua sendo calçado porque tirá-lo faria todo caminho que ainda
  // não descobriu a categoria parar de exigir qualquer coisa — e "não exige
  // nada" é pior que "exige o de calçado": o primeiro deixa publicar sem ficha,
  // o segundo no máximo pede um campo a mais.
  const identidade = resolverObrigatorios(
    dadosDoProduto(p),
    opcoes.obrigatorios ?? OBRIGATORIOS_CALCADO
  );
  const ausentes = identidade.filter((a) => a.origem === "ausente");

  const etapaIdentidade: EtapaAvaliada = {
    etapa: "identidade",
    situacao: ausentes.length === 0 ? "pronta" : "bloqueada",
    faltando: ausentes.map((a) => a.nome),
    porque: PORQUE.identidade,
    depende: [],
  };

  // CONTEÚDO depende só da identidade. Custo, peso e foto não entram: a esteira
  // escreve texto a partir do que o produto É, não do que ele custa.
  const jaTemAnuncio = Boolean(anuncio);
  const etapaConteudo: EtapaAvaliada = {
    etapa: "conteudo",
    situacao:
      etapaIdentidade.situacao === "bloqueada"
        ? "bloqueada"
        : jaTemAnuncio
          ? "pronta"
          : "apta",
    faltando:
      etapaIdentidade.situacao === "bloqueada"
        ? [`identidade (${ausentes.map((a) => a.nome).join(", ")})`]
        : [],
    porque: PORQUE.conteudo,
    depende: ["identidade"],
  };

  const etapaImagens: EtapaAvaliada = {
    etapa: "imagens",
    situacao: p.quantidadeImagens > 0 ? "pronta" : "bloqueada",
    faltando: p.quantidadeImagens > 0 ? [] : ["pelo menos uma foto"],
    porque: PORQUE.imagens,
    depende: [],
  };

  const etapaPricing = avaliarPricing(p, opcoes);

  const grade = montarVariacoes(p.variantes, p.precoVenda);
  const gradeOk = p.variantes.length > 0 && gradePublicavel(grade);
  const aprovado = anuncio?.vereditoA10 === "aprovado" && (anuncio?.qtdPendencias ?? 1) === 0;
  const faltaParaPublicar: string[] = [];
  if (!jaTemAnuncio) faltaParaPublicar.push("o anúncio ainda não foi gerado");
  else if (!aprovado) faltaParaPublicar.push("o anúncio tem pendências");
  if (etapaImagens.situacao !== "pronta") faltaParaPublicar.push("foto");
  if (!(p.precoVenda > 0)) faltaParaPublicar.push("preço de venda");
  if (!gradeOk) faltaParaPublicar.push("grade de variações completa");

  const etapaPublicacao: EtapaAvaliada = {
    etapa: "publicacao",
    situacao: anuncio?.mlItemId
      ? "pronta"
      : faltaParaPublicar.length === 0
        ? "apta"
        : "bloqueada",
    faltando: faltaParaPublicar,
    porque: PORQUE.publicacao,
    depende: ["conteudo", "imagens", "pricing"],
  };

  const etapas = [etapaIdentidade, etapaConteudo, etapaImagens, etapaPricing, etapaPublicacao];
  const bloqueiosParaGerar = calcularBloqueiosParaGerar(estadoDoProduto(p), p.id, identidade);

  return {
    produtoId: p.id,
    nome: p.nome,
    estado: decidirEstado({ anuncio, ausentes: ausentes.length, bloqueiosParaGerar, etapaPublicacao }),
    etapas,
    identidade,
    bloqueiosParaGerar,
    proximaEtapa: etapas.find((e) => e.situacao === "apta")?.etapa ?? null,
    jaTemAnuncio,
  };
}

/**
 * PRICING — reusa `precoMinimo` inteiro, inclusive o motivo da recusa.
 *
 * Este módulo NÃO publica o número. A pergunta desta vertical é "dá para
 * calcular?" e "o que falta?" — e essas duas não dependem da comissão exata da
 * conta do lojista, que só a tela de precificação consulta na API. Devolver um
 * piso calculado com a tabela padrão aqui produziria um número que parece o
 * real e não é. O preço tem vertical própria.
 */
function avaliarPricing(p: ProdutoParaPreparar, opcoes: OpcoesDaPreparacao): EtapaAvaliada {
  const faltando: string[] = [];
  if (!(p.custo > 0)) faltando.push("custo");

  const embalagem =
    p.pesoGramas > 0 || p.alturaCm > 0 || p.larguraCm > 0 || p.comprimentoCm > 0
      ? {
          pesoGramas: p.pesoGramas,
          alturaCm: p.alturaCm,
          larguraCm: p.larguraCm,
          comprimentoCm: p.comprimentoCm,
        }
      : null;

  const taxas: ModeloTaxas = {
    ...(opcoes.taxas ?? TAXAS_PADRAO),
    embalagem,
    ...(p.vendedorPagaFrete === false ? { vendedorPagaFrete: false } : {}),
  };

  // O motivo vem do domínio de preço, não de um `if` local: ele é quem sabe
  // quando o peso é dispensável e quando a margem é impossível.
  const r = precoMinimo(p.custo, opcoes.margemMinima ?? MARGEM_MINIMA_PADRAO, taxas);
  if (!r.ok) {
    if (r.motivo === "sem_peso") faltando.push("peso da embalagem");
    else faltando.push("uma margem possível (comissão + margem passam de 100%)");
  }

  return {
    etapa: "pricing",
    situacao: faltando.length === 0 ? "pronta" : "bloqueada",
    faltando,
    porque: PORQUE.pricing,
    depende: [],
  };
}

/**
 * O que impede GERAR AGORA. A política, não o fato técnico.
 *
 * Idêntica à que `propor_anuncio` usa desde o PR #84, e por isso vive aqui uma
 * vez só: cadastro (custo, peso, foto — nunca preço) mais os obrigatórios do ML
 * que o cadastro não sustenta. Gerar sem eles queima três minutos e uma cota
 * para devolver um anúncio com pendência.
 */
export function calcularBloqueiosParaGerar(
  estado: EstadoDoProduto,
  produtoId: string,
  identidade: readonly AtributoResolvido[]
): string[] {
  const faltando: string[] = [];
  for (const l of lacunasDoProduto(estado, produtoId)) {
    // O PREÇO é consequência de custo e peso, não uma lacuna própria — listá-lo
    // faria a pessoa procurar um campo que não precisa preencher.
    if (l.tipo !== "preco") faltando.push(l.rotulo);
  }
  for (const a of identidade) if (a.origem === "ausente") faltando.push(a.nome);
  return faltando;
}

function decidirEstado(e: {
  anuncio: AnuncioJaGerado | null;
  ausentes: number;
  bloqueiosParaGerar: readonly string[];
  etapaPublicacao: EtapaAvaliada;
}): EstadoDaPreparacao {
  if (e.anuncio?.mlItemId) return "publicado";
  if (e.anuncio) {
    return e.etapaPublicacao.situacao === "apta" ? "pronto_para_publicar" : "preparado";
  }
  // Sem anúncio: a identidade decide se é sequer possível.
  if (e.ausentes > 0) return "nao_apto";
  return e.bloqueiosParaGerar.length === 0 ? "apto_para_preparar" : "precisa_humano";
}

/** A ponte com `atributosDoMarketplace`. Cores e tamanhos vêm da grade real. */
export function dadosDoProduto(p: ProdutoParaPreparar): DadosDoProduto {
  return {
    nome: p.nome,
    marca: p.marca,
    modelo: p.modelo,
    cores: distintos(p.variantes.map((v) => v.cor)),
    tamanhos: distintos(p.variantes.map((v) => v.tamanho)),
  };
}

/** A ponte com `lacunasDoProduto`. O peso é o maior — a pergunta é sobre frete. */
function estadoDoProduto(p: ProdutoParaPreparar): EstadoDoProduto {
  return {
    custo: p.custo,
    precoVenda: p.precoVenda,
    pesoGramas: p.pesoGramas,
    temFoto: p.quantidadeImagens > 0,
    ...(p.vendedorPagaFrete === false ? { vendedorPagaFrete: false } : {}),
  };
}

function distintos(vs: readonly (string | undefined)[]): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const v of vs) {
    const t = (v ?? "").trim();
    if (!t || vistos.has(t.toLowerCase())) continue;
    vistos.add(t.toLowerCase());
    saida.push(t);
  }
  return saida;
}

// ---------------------------------------------------------------------------
// lote
// ---------------------------------------------------------------------------

export interface SelecaoParaPreparar {
  analisados: number;
  /** Os que podem gerar AGORA, sem faltar nada. */
  elegiveis: readonly Preparacao[];
  /** Os que não podem, agrupados pelo motivo. Nunca uma lista solta de ids. */
  naoElegiveis: readonly { motivo: string; quantos: number; exemplos: readonly string[] }[];
  /** Os que já têm anúncio. Refazer é outra intenção, e não entra em "prepare". */
  jaPreparados: number;
  /** Verdadeiro quando a análise não cobriu o catálogo inteiro. */
  truncado: boolean;
  totalNoCatalogo: number;
}

/**
 * "Prepare todos que estiverem prontos."
 *
 * QUEM SELECIONA É O BACKEND. O modelo recebe contagens e grupos — mandar 500
 * objetos de produto ao Gemini estouraria o contexto e ainda deixaria a escolha
 * com quem não mede nada.
 *
 * Quem JÁ TEM anúncio fica de fora: "prepare todos que estiverem prontos" não é
 * "refaça o que já está feito". Refazer é uma intenção diferente, e cara.
 */
export function selecionarParaPreparar(
  preparacoes: readonly Preparacao[],
  totalNoCatalogo = preparacoes.length
): SelecaoParaPreparar {
  const elegiveis: Preparacao[] = [];
  const porMotivo = new Map<string, { motivo: string; quantos: number; exemplos: string[] }>();
  let jaPreparados = 0;

  for (const p of preparacoes) {
    if (p.jaTemAnuncio) {
      jaPreparados += 1;
      continue;
    }
    if (p.estado === "apto_para_preparar") {
      elegiveis.push(p);
      continue;
    }
    // O motivo é o PRIMEIRO bloqueio — o que a pessoa vai resolver primeiro. A
    // lista inteira vive na preparação de cada produto, para o drill-down.
    const motivo = p.bloqueiosParaGerar[0] ?? "não apto";
    const atual = porMotivo.get(motivo);
    if (atual) {
      atual.quantos += 1;
      if (atual.exemplos.length < 3) atual.exemplos.push(p.nome);
    } else {
      porMotivo.set(motivo, { motivo, quantos: 1, exemplos: [p.nome] });
    }
  }

  return {
    analisados: preparacoes.length,
    elegiveis,
    naoElegiveis: [...porMotivo.values()].sort((a, b) => b.quantos - a.quantos),
    jaPreparados,
    truncado: totalNoCatalogo > preparacoes.length,
    totalNoCatalogo,
  };
}

/**
 * O resultado de preparar VÁRIOS — item a item.
 *
 * "Preparei 50" quando 47 funcionaram é mentira, e é o tipo de mentira que só
 * aparece três dias depois. Cada item carrega o próprio desfecho.
 */
export interface ItemDoLote {
  produtoId: string;
  nome: string;
  desfecho: "preparado" | "bloqueado" | "falhou";
  motivo?: string;
}

export interface ResultadoDoLote {
  analisados: number;
  preparados: number;
  bloqueados: number;
  falharam: number;
  itens: readonly ItemDoLote[];
}

export function consolidarLote(itens: readonly ItemDoLote[]): ResultadoDoLote {
  return {
    analisados: itens.length,
    preparados: itens.filter((i) => i.desfecho === "preparado").length,
    bloqueados: itens.filter((i) => i.desfecho === "bloqueado").length,
    falharam: itens.filter((i) => i.desfecho === "falhou").length,
    itens,
  };
}

// ---------------------------------------------------------------------------
// leitura humana
// ---------------------------------------------------------------------------

const ROTULO_ESTADO: Record<EstadoDaPreparacao, string> = {
  nao_apto: "não dá para preparar ainda",
  precisa_humano: "precisa de você antes",
  apto_para_preparar: "pronto para preparar",
  preparado: "anúncio preparado, com pendências",
  pronto_para_publicar: "pronto para publicar",
  publicado: "já está no ar",
};

export function escreverEstado(e: EstadoDaPreparacao): string {
  return ROTULO_ESTADO[e];
}

/**
 * "O que falta para esse anúncio ficar pronto?"
 *
 * A resposta vem do ESTADO REAL das etapas, não de uma checklist escrita no
 * prompt. Etapa pronta não aparece: dizer o que já está feito é ruído para quem
 * perguntou o que falta.
 */
export function oQueFalta(p: Preparacao): readonly { etapa: EtapaDaPreparacao; faltando: readonly string[] }[] {
  return p.etapas
    .filter((e) => e.situacao === "bloqueada" && e.faltando.length > 0)
    .map((e) => ({ etapa: e.etapa, faltando: e.faltando }));
}

// ---------------------------------------------------------------------------
// título
// ---------------------------------------------------------------------------

/** O campo da precondição de título. Uma constante, para os dois lados casarem. */
export const CAMPO_TITULO_ATUAL = "impressaoDoTitulo";

/**
 * A impressão de um título — para a revalidação saber se ele mudou.
 *
 * As precondições da Proposal são numéricas (`valorNaCriacao: number | null`),
 * e um título é texto. Um hash de 31 bits resolve a pergunta que importa aqui:
 * "alguém trocou este título entre a proposta e o clique?".
 *
 * O QUE SE PERDE, e é honesto dizer: um hash não conta O QUE mudou. Para
 * dinheiro isso importaria ("de R$ 42 para R$ 55"); para título, o resumo da
 * proposta já mostra o que estava lá quando ela nasceu.
 *
 * Título vazio devolve `null` — "não havia título" é diferente de "o título era
 * a string vazia", e `null` é como o resto do sistema escreve ausência.
 */
export function impressaoDoTitulo(titulo: string): number | null {
  const t = (titulo ?? "").trim();
  if (!t) return null;
  let h = 0;
  for (let i = 0; i < t.length; i++) {
    h = (h * 31 + t.charCodeAt(i)) | 0;
  }
  // Positivo: o `numeric` da coluna aceita negativo, mas um número sem sinal se
  // lê melhor numa inspeção de auditoria.
  return Math.abs(h);
}

/** O limite do Mercado Livre. É a razão de o agente de título existir. */
export const LIMITE_DE_TITULO = 60;

export type VeredictoDoTitulo =
  | { ok: true; titulo: string }
  | { ok: false; motivo: string };

/**
 * O título proposto serve?
 *
 * Três recusas, e nenhuma delas é opinião: vazio, igual ao atual (não há o que
 * trocar) e acima do limite do ML (o anúncio seria recusado na publicação).
 * O modelo escreve; o domínio decide se aquilo pode virar proposta.
 */
export function avaliarTituloProposto(
  proposto: string,
  atual: string
): VeredictoDoTitulo {
  const t = (proposto ?? "").trim();
  if (!t) return { ok: false, motivo: "Não consegui gerar um título agora." };
  if (t.length > LIMITE_DE_TITULO) {
    return {
      ok: false,
      motivo: `O título proposto tem ${t.length} caracteres e o Mercado Livre aceita ${LIMITE_DE_TITULO}.`,
    };
  }
  if (t === (atual ?? "").trim()) {
    return { ok: false, motivo: "O título que eu proporia é igual ao atual. Não há o que trocar." };
  }
  return { ok: true, titulo: t };
}
