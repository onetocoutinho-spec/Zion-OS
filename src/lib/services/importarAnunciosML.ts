// Importar os anúncios JÁ cadastrados na conta do ML → base do sistema.
//
// Puxa os itens do vendedor (via /api/ml/importar-anuncios) e traz pro sistema,
// pra: (1) montar a base sem planilha, a partir do que já está no ar; e
// (2) não duplicar na publicação (cada anúncio já vem vinculado ao MLB).
//
// AGRUPAMENTO por família/título: no ML o mesmo modelo costuma virar vários
// MLBs (User Products por tamanho, ou anúncios repetidos com o mesmo título).
// Reunimos em UM produto com variações, mantendo 1 registro de anúncio por MLB
// — assim a vinculação SKU↔MLB do ERP continua por tamanho.
//
// SUBSTITUI: cada importação limpa a importação anterior do ML do cliente e
// reimporta tudo agrupado (sem depender de apagar via SQL, sem duplicar).

import { buscarCanal } from "./canaisMarketplace";
import { cabecalhoAutenticacao } from "../supabase/sessao";
import { criarProdutos, excluirProdutosImportadosML, listarProdutosDoCliente } from "./produtos";
import { criarVariantesBulk, listarTodasVariantes } from "./produtoVariantes";
import {
  atualizarEstadoNoMarketplaceBulk,
  criarAnunciosGeradosBulk,
  excluirAnunciosImportadosML,
  listarAnunciosGeradosDoCliente,
} from "./anunciosGerados";
import { criarImagensBulk } from "./imagensProduto";
import { estadosDesatualizados } from "../../modules/integration/domain/estadoNoMarketplaceDesatualizado";
import { exigenciasNaoAtendidas } from "../../modules/integration/domain/oQueOMlEstaPedindo";
import {
  abaDesatualizada,
  AVISO_ABA_DESATUALIZADA,
} from "../../modules/integration/domain/abaDesatualizada";
import { substituirAtributosDoMarketplace } from "./produtoAtributos";
import {
  casarGruposComProdutos,
  variantesInexistentes,
} from "../../modules/integration/domain/casarComProdutoExistente";
import {
  ehDeFicha,
  planejarEnriquecimento,
  type ConflitoDeAtributo,
  type ForaDaFichaPorCategoria,
} from "../../modules/integration/domain/enriquecimentoDaFicha";
import type { AnuncioML } from "../marketplaces/mercadolivre";
import type { AnuncioGerado } from "../agentes/esteira";
import type { BaseProduto } from "./importacaoProdutos";
import type { ProdutoVariante, ImagemProduto } from "../types";

/** Máximo de fotos importadas por produto (o ML permite ~10-12 por anúncio). */
const MAX_FOTOS = 10;

// O recorte da ficha vive no DOMÍNIO, e é importado — não copiado.
//
// Ele é usado em três lugares: a ficha do anúncio importado, a conferência
// (`medirFichas`) e o enriquecimento. Duas cópias divergiriam no primeiro dia em
// que alguém acrescentasse um id a uma delas, e aí a tela mostraria um número e
// a ficha guardaria outro.
//
// O motivo do recorte está lá: identidade mora na grade, medida vira peso.

/**
 * "substituir" = apaga a importação anterior do ML e traz tudo de novo.
 * "novos" = mantém o que já existe e só adiciona os anúncios (MLBs) inéditos.
 */
/**
 * `medir` NÃO ESCREVE NADA. Existe porque as outras duas não servem para
 * perguntar "o que o ML tem?":
 *
 *   substituir → APAGA os produtos importados antes de reimportar, e o apagão
 *                é em cascata: variantes (com o CUSTO, que o ML não devolve),
 *                imagens, e o vínculo produto↔anúncio vira NULL, cegando a
 *                guarda contra publicação duplicada;
 *   novos      → importa só MLBs ausentes. Com tudo já importado, não faz nada.
 *
 * A busca no ML é a mesma nos três — a rota só LÊ, e toda a escrita acontece
 * deste lado. Então medir é devolver antes de escrever, e custa uma leitura.
 */
export type ModoImportacao = "substituir" | "novos" | "medir" | "enriquecer";

/** Quantos anúncios informaram cada atributo, sem tocar em nada. */
export interface MedicaoDaFicha {
  anuncios: number;
  /** Anúncios com ao menos um atributo ALÉM dos que já têm casa própria. */
  comFichaPropria: number;
  /** Média de atributos de ficha por anúncio, uma casa decimal. */
  mediaDaFicha: number;
  /** Cada atributo e em quantos anúncios ele veio preenchido, do mais comum. */
  porAtributo: { id: string; nome: string; anuncios: number }[];
  /**
   * O status REAL de cada anúncio no ML (`active`, `paused`, `closed`, …).
   *
   * Medido em 2026-08-01: a conta tem 781 anúncios e o export do ERP lista 561.
   * A diferença de 220 não tem explicação enquanto ninguém souber quantos estão
   * no ar. E importar sem saber é pior: o importador grava
   * `status: "publicado"` FIXO, e `StatusAnuncioGerado` não tem `pausado` nem
   * `encerrado` — um anúncio morto entraria aqui como publicado.
   */
  porStatus: { status: string; anuncios: number }[];
  /** Os que o Zion ainda não tem, pelo status deles no ML. */
  novosPorStatus: { status: string; anuncios: number }[];
  /**
   * POR QUE os anúncios que não estão `active` não estão no ar.
   *
   * `under_review` sozinho não é acionável. O ML diz o motivo em `sub_status`,
   * e sem isso a lojista vê "155 em revisão" e não tem onde mexer.
   */
  motivosDeNaoEstarNoAr: { motivo: string; anuncios: number }[];
  /**
   * Campos que a categoria EXIGE e faltam nos anúncios fora do ar.
   *
   * `waiting_for_patch` diz que falta alguma coisa e não diz o quê. Isto
   * responde a pergunta que a lojista tem de verdade: o que preencher.
   */
  exigenciasNaoAtendidas: { id: string; nome: string; anuncios: number }[];
  /**
   * Quantas categorias tiveram a lista de exigências obtida do ML.
   *
   * Existe porque `exigenciasNaoAtendidas: []` significava DUAS coisas — "nada
   * falta" e "não perguntamos" — e a tela mostrava silêncio para as duas.
   * Observado em 2026-08-02: a linha não apareceu e nem eu soube dizer qual dos
   * dois era. É o mesmo defeito mudo que passei o dia arrancando, criado por
   * mim na véspera.
   *
   * `0` = não sabemos o que o ML exige. Nunca "está tudo certo".
   */
  categoriasComExigencias: number;
  /** Anúncios fora do ar que foram conferidos contra as exigências. */
  anunciosForaDoArConferidos: number;
}

/** O que a leitura do ML conseguiu ver, e o que não conseguiu. */
export interface LeituraRelatada {
  /** Quantos o ML DIZ que a conta tem. -1 = não informou. */
  total: number;
  /** Quantos ids listamos. */
  ids: number;
  /** Ids listados que o multiget não devolveu. */
  perdidos: number;
  parede: "nenhuma" | "offset-1000" | "teto" | "paginacao-parou";
}

/**
 * A frase que conta a verdade da leitura — ou `undefined` quando leu tudo.
 *
 * Existe porque `489 já existiam` se lê como "está tudo em dia", e naquele dia
 * faltavam 61. Silêncio aqui não é neutro: ele afirma completude.
 */
export function avisoDaLeitura(l: LeituraRelatada | undefined): string | undefined {
  if (!l) return undefined;
  const partes: string[] = [];
  if (l.total >= 0 && l.ids < l.total) {
    partes.push(`O ML diz que a conta tem ${l.total} anúncios e só consegui listar ${l.ids}.`);
  }
  if (l.perdidos > 0) {
    partes.push(`${l.perdidos} anúncio(s) foram listados mas não vieram — lote com falha no ML.`);
  }
  if (l.parede === "offset-1000") {
    partes.push(
      "O Mercado Livre não deixa passar do anúncio 1.000 nesta forma de busca. Ler além disso exige outro endpoint, que ainda não está implementado."
    );
  } else if (l.parede === "paginacao-parou") {
    partes.push("O ML parou de devolver páginas antes do total, sem dizer por quê.");
  } else if (l.parede === "teto") {
    partes.push("A leitura parou num limite pedido por quem chamou.");
  }
  return partes.length > 0 ? partes.join(" ") : undefined;
}

export interface ResultadoImportacaoAnuncios {
  produtos: number;
  anuncios: number;
  variacoes: number;
  imagens: number;
  pulados: number;
  /**
   * Produtos que JÁ existiam e receberam os anúncios novos em vez de virar
   * duplicata. Fica separado de `produtos` de propósito: somar os dois num
   * número só faria a tela dizer "26 produtos" quando 8 foram criados.
   * Estes NÃO recebem foto — veja o passo 4.
   */
  casados?: number;
  /** O que a leitura do ML viu — presente sempre que a rota respondeu. */
  leitura?: LeituraRelatada;
  /** Anúncios JÁ cadastrados cujo estado no marketplace mudou (modo `novos`). */
  estadosAtualizados?: number;
  /**
   * Anúncios cujo estado NÃO conseguiu ser gravado.
   *
   * Fica separado de `estadosAtualizados` porque somar os dois esconderia a
   * falha: "767 atualizados" e "767 atualizados, 14 falharam" são frases
   * diferentes, e só a segunda é verdadeira.
   */
  estadosQueFalharam?: number;
  aviso?: string;
  /** Só no modo `medir`. */
  medicao?: MedicaoDaFicha;
  /** Só no modo `enriquecer`. */
  enriquecimento?: {
    atributos: number;
    produtos: number;
    conflitos: ConflitoDeAtributo[];
    anunciosSemProduto: number;
  };
}

/**
 * A medição, PURA — sem rede, sem banco, sem decisão.
 *
 * Conta o que a lojista já informou ao Mercado Livre e que o Zion descartava
 * até 2026-08-01. Usa o MESMO recorte do enriquecimento — `ehDeFicha` —, senão
 * o número mediria uma coisa e a ficha guardaria outra.
 */
function contarStatus(anuncios: readonly AnuncioML[]): { status: string; anuncios: number }[] {
  const c = new Map<string, number>();
  for (const a of anuncios) {
    // Status em branco NÃO vira "active". O ML não disse, e inventar aqui é o
    // mesmo defeito que fez o Copilot preencher campo sem fonte.
    const k = (a.status || "").trim() || "(não informado)";
    c.set(k, (c.get(k) ?? 0) + 1);
  }
  return [...c.entries()]
    .map(([status, anuncios]) => ({ status, anuncios }))
    .sort((x, y) => y.anuncios - x.anuncios || x.status.localeCompare(y.status));
}

function contarMotivos(anuncios: readonly AnuncioML[]): { motivo: string; anuncios: number }[] {
  const c = new Map<string, number>();
  for (const a of anuncios) {
    if ((a.status || "").trim().toLowerCase() === "active") continue;
    // Um anúncio pode ter mais de um motivo — cada um conta uma vez. E quando
    // o ML não informou nenhum, isso É a resposta: ele não disse.
    // `?? []` não é zelo com fixture: `anuncios` chega por JSON de
    // `/api/ml/importar-anuncios`, e o servidor pode ser de um deploy diferente
    // do pacote que está na aba. Aconteceu hoje mesmo — uma aba aberta rodou o
    // código de antes e não gravou estado nenhum. Campo novo atravessando essa
    // fronteira pode chegar ausente, e ausente não pode explodir.
    const lista = a.subStatus ?? [];
    const motivos = lista.length > 0 ? lista : ["(o ML não informou o motivo)"];
    for (const m of motivos) c.set(m, (c.get(m) ?? 0) + 1);
  }
  return [...c.entries()]
    .map(([motivo, anuncios]) => ({ motivo, anuncios }))
    .sort((x, y) => y.anuncios - x.anuncios || x.motivo.localeCompare(y.motivo));
}

export function medirFichas(
  anuncios: readonly AnuncioML[],
  fora: ForaDaFichaPorCategoria = {},
  mlbsJaConhecidos: ReadonlySet<string> = new Set(),
  obrigatorios: Record<string, { id: string; nome: string }[]> = {}
): MedicaoDaFicha {
  // O MESMO recorte do enriquecimento, e por construção: os dois chamam
  // `ehDeFicha`. Antes eram duas listas iguais por disciplina; agora é uma
  // função só, e divergir deixou de ser possível sem alguém perceber.
  const ehFicha = ehDeFicha(fora);
  const contagem = new Map<string, { nome: string; anuncios: number }>();
  let comFichaPropria = 0;
  let totalDeLinhas = 0;

  for (const a of anuncios) {
    const daFicha = a.atributos.filter((at) => ehFicha(a.categoria, at.id));
    if (daFicha.length > 0) comFichaPropria++;
    totalDeLinhas += daFicha.length;
    for (const at of daFicha) {
      const atual = contagem.get(at.id);
      if (atual) atual.anuncios++;
      else contagem.set(at.id, { nome: at.nome || at.id, anuncios: 1 });
    }
  }

  return {
    anuncios: anuncios.length,
    comFichaPropria,
    mediaDaFicha: anuncios.length === 0 ? 0 : Math.round((totalDeLinhas / anuncios.length) * 10) / 10,
    porAtributo: [...contagem.entries()]
      .map(([id, v]) => ({ id, nome: v.nome, anuncios: v.anuncios }))
      .sort((x, y) => y.anuncios - x.anuncios || x.id.localeCompare(y.id)),
    porStatus: contarStatus(anuncios),
    motivosDeNaoEstarNoAr: contarMotivos(anuncios),
    exigenciasNaoAtendidas: exigenciasNaoAtendidas(anuncios, obrigatorios),
    categoriasComExigencias: Object.values(obrigatorios).filter((v) => v.length > 0).length,
    anunciosForaDoArConferidos: anuncios.filter(
      (a) =>
        (a.status || "").trim().toLowerCase() !== "active" &&
        (obrigatorios[a.categoria] ?? []).length > 0
    ).length,
    novosPorStatus: contarStatus(anuncios.filter((a) => !mlbsJaConhecidos.has(a.mlb))),
  };
}

/** Um grupo vira 1 produto. */
type Grupo = AnuncioML[];

/** Quantas unidades de variação o grupo tem (soma de tamanhos/variações). */
function unidades(g: Grupo): number {
  return g.reduce((n, a) => n + (a.variacoes.length > 0 ? a.variacoes.length : 1), 0);
}

function normalizarTitulo(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Reúne os itens do mesmo modelo em um grupo (= 1 produto), em ordem de
 * confiança:
 *  1) `family_name` — o campo que o ML compartilha entre os itens da mesma
 *     família (ex.: mesmo chinelo em tamanhos/cores separados por MLB). É o
 *     sinal mais forte aqui.
 *  2) `user_product_id` COMPARTILHADO por 2+ itens (o ML costuma dar um id
 *     único por item, que sozinho não serve pra agrupar).
 *  3) título normalizado — fallback pra anúncios repetidos sem família.
 */
function agrupar(anuncios: AnuncioML[]): Grupo[] {
  const contFamilia = new Map<string, number>();
  for (const a of anuncios) {
    if (a.familyId) contFamilia.set(a.familyId, (contFamilia.get(a.familyId) ?? 0) + 1);
  }
  const chaveDe = (a: AnuncioML): string => {
    const fam = a.familyName.trim().toLowerCase();
    if (fam) return `fam:${fam}`;
    if (a.familyId && (contFamilia.get(a.familyId) ?? 0) > 1) return `fid:${a.familyId}`;
    const t = normalizarTitulo(a.titulo);
    return t ? `tit:${t}` : `mlb:${a.mlb}`;
  };
  const mapa = new Map<string, Grupo>();
  for (const a of anuncios) {
    const chave = chaveDe(a);
    const lista = mapa.get(chave) ?? [];
    lista.push(a);
    mapa.set(chave, lista);
  }
  return [...mapa.values()];
}

function baseProdutoDoGrupo(g: Grupo): BaseProduto {
  const rep = g[0];
  const comVariacao = unidades(g) > 1;
  const estoque = g.reduce(
    (s, a) => s + (a.variacoes.length > 0 ? a.variacoes.reduce((x, v) => x + v.estoque, 0) : a.estoque),
    0
  );
  return {
    nome: rep.familyName || rep.titulo || "Anúncio do ML",
    marca: rep.marca,
    modelo: rep.modelo,
    categoria: rep.categoria,
    sku: comVariacao ? "" : rep.sku, // com variação, o SKU fica em cada variante
    cor: "",
    tamanho: "",
    custo: 0, // o ML não expõe o custo — o cliente completa depois
    precoVenda: rep.preco,
    estoque,
    // Quem paga o frete vem do próprio anúncio. Antes este campo era jogado
    // fora e o cálculo descontava frete de todo produto, inclusive daqueles em
    // que o comprador paga — margem menor que a real, sem ninguém saber por quê.
    ...(typeof rep.vendedorPagaFrete === "boolean"
      ? { vendedorPagaFrete: rep.vendedorPagaFrete }
      : {}),
    marketplace: "Mercado Livre",
    statusCadastro: "Publicado",
    statusSeo: "Concluído",
    statusDescricao: "Concluído",
    statusImagens: "Concluído",
    statusPrecificacao: "Pendente",
    prioridade: "Média",
    observacoes: comVariacao
      ? `Importado do ML (${g.length} anúncio(s), ${unidades(g)} variação(ões)). Complete o custo para a margem.`
      : `Importado do ML (${rep.mlb}). Complete o custo para a margem.`,
    tipoProduto: comVariacao ? "com_variacao" : "simples",
    codErp: comVariacao ? undefined : rep.sku || undefined,
    confiancaCusto: "",
  };
}

/** Variante a partir de um MLB de tamanho (User Products). */
function varianteDeItem(produtoId: string, clienteId: string, a: AnuncioML): Omit<ProdutoVariante, "id"> {
  return {
    produtoId,
    clienteId,
    sku: a.sku,
    codigoInterno: "",
    ean: a.ean,
    cor: a.cor,
    tamanho: a.tamanho,
    voltagem: "",
    sabor: "",
    aroma: "",
    modeloVariacao: "",
    custo: 0,
    precoBase: a.preco,
    estoque: a.estoque,
    // Medidas REAIS do ML. Antes eram zeros — e zero significa "não sei", o que
    // deixava a precificação cega para o custo de envio de todo produto
    // importado. A variante guarda o peso em kg; o ML entrega em gramas.
    peso: a.pesoGramas / 1000,
    altura: a.alturaCm,
    largura: a.larguraCm,
    comprimento: a.comprimentoCm,
    status: "Ativa",
    observacoes: a.mlb, // guarda o MLB deste tamanho
  };
}

/**
 * Variante a partir da variação interna de um anúncio clássico.
 *
 * As medidas vêm do ITEM PAI (`a`), não da variação: o ML guarda a embalagem no
 * item, e todas as variações internas dividem o mesmo pacote.
 */
function varianteClassica(
  produtoId: string,
  clienteId: string,
  v: AnuncioML["variacoes"][number],
  a: AnuncioML
): Omit<ProdutoVariante, "id"> {
  return {
    produtoId,
    clienteId,
    sku: v.sku,
    codigoInterno: "",
    ean: v.ean,
    cor: v.cor,
    tamanho: v.tamanho,
    voltagem: "",
    sabor: "",
    aroma: "",
    modeloVariacao: "",
    custo: 0,
    precoBase: v.preco,
    estoque: v.estoque,
    peso: a.pesoGramas / 1000, // a variante guarda em kg; o ML entrega em gramas
    altura: a.alturaCm,
    largura: a.larguraCm,
    comprimento: a.comprimentoCm,
    status: "Ativa",
    observacoes: "",
  };
}

/**
 * Exportada por ser PURA e por ser o que mudou: a ficha deixou de ser um par
 * fixo no código e passou a vir dos atributos do ML. Sem rede e sem banco —
 * exportar aqui não abre orquestração para o teste, só torna endereçável uma
 * função que já era determinística.
 */
export function anuncioGeradoDoML(
  a: AnuncioML,
  fora: ForaDaFichaPorCategoria = {}
): AnuncioGerado {
  const ehFicha = ehDeFicha(fora);
  // A ficha vem do que o MERCADO LIVRE devolveu, não de um par fixo aqui.
  //
  // Até 2026-08-01 eram duas linhas escritas no código, Marca e Modelo, e o
  // resto — material da sola, palmilha, tipo de salto, gênero, tipo de calçado —
  // chegava do ML e era descartado. Medido: 500 dos 501 anúncios importados
  // ficaram com exatamente dois atributos.
  //
  // Sem `obrigatorio`: ver D5 do DES-001. Quem exige é o marketplace, e a
  // exigência varia por categoria.
  const ficha = a.atributos
    .filter((at) => ehFicha(a.categoria, at.id))
    .map((at) => ({ atributo: at.nome || at.id, valor: at.valor }));
  const variacoes =
    a.variacoes.length > 0
      ? a.variacoes.map((v) => ({
          cor: v.cor,
          tamanho: v.tamanho,
          sku: v.sku,
          ean: v.ean,
          estoque: String(v.estoque),
          preco: String(v.preco),
          obs: "",
        }))
      : a.cor || a.tamanho || a.sku
        ? [
            {
              cor: a.cor,
              tamanho: a.tamanho,
              sku: a.sku,
              ean: a.ean,
              estoque: String(a.estoque),
              preco: String(a.preco),
              obs: "",
            },
          ]
        : [];
  return {
    notaDiagnostico: 0,
    tituloOtimizado: a.titulo,
    palavrasChavePrincipais: [],
    palavrasChaveSecundarias: [],
    descricaoCompleta: "",
    descricaoCurta: "",
    fichaTecnica: ficha,
    tabelaMedidas: "",
    comoMedir: "",
    forma: "nao_aplicavel",
    variacoes,
    imagensSugeridas: [],
    faq: [],
    // Um anúncio IMPORTADO já está no ar: não há o que travar nem o que
    // sugerir. As duas listas vazias são afirmações verdadeiras.
    pendencias: [],
    sugestoes: [],
    vereditoA10: "aprovado",
    motivoVeredito: "Importado do Mercado Livre (já publicado).",
  };
}

export async function importarAnunciosDoCliente(
  clienteId: string,
  cliente: string,
  modo: ModoImportacao = "substituir"
): Promise<ResultadoImportacaoAnuncios> {
  const canal = await buscarCanal(clienteId, "Mercado Livre");
  if (!canal?.ativo) {
    return { produtos: 0, anuncios: 0, variacoes: 0, imagens: 0, pulados: 0, aviso: "Cliente não conectado ao Mercado Livre." };
  }

  // O refresh_token fica no servidor (R3): enviamos só o clienteId + a sessão.
  const resposta = await fetch("/api/ml/importar-anuncios", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ clienteId }),
  });
  const dados = (await resposta.json()) as {
    anuncios?: AnuncioML[];
    /** O recorte da ficha, por categoria, vindo da API pública do ML. */
    foraDaFicha?: ForaDaFichaPorCategoria;
    obrigatorios?: Record<string, { id: string; nome: string }[]>;
    /** A versão que o SERVIDOR está rodando (ver `abaDesatualizada`). */
    versao?: string;
    leitura?: LeituraRelatada;
    erro?: string;
  };
  if (!resposta.ok) {
    return { produtos: 0, anuncios: 0, variacoes: 0, imagens: 0, pulados: 0, aviso: dados.erro ?? "Falha ao importar anúncios." };
  }

  // A verdade da leitura anda junto com o resultado, em TODOS os retornos
  // daqui pra baixo. Ela não é um extra: sem ela, "489 já existiam" afirma uma
  // completude que ninguém verificou.
  const leitura = dados.leitura;
  // A aba pode estar rodando um pacote anterior ao do servidor — aconteceu três
  // vezes em 01–02/08 e cada vez o resultado parcial foi lido como completo.
  // O aviso vem PRIMEIRO, antes de qualquer número, porque ele muda como todos
  // os outros devem ser lidos.
  const avisoVersao = abaDesatualizada({
    doNavegador: process.env.NEXT_PUBLIC_VERSAO,
    doServidor: dados.versao,
  })
    ? AVISO_ABA_DESATUALIZADA
    : undefined;
  const avisoLeitura = [avisoVersao, avisoDaLeitura(leitura)].filter(Boolean).join(" ") || undefined;

  const todos = (dados.anuncios ?? []).filter((a) => a.mlb);
  if (todos.length === 0) {
    return { produtos: 0, anuncios: 0, variacoes: 0, imagens: 0, pulados: 0, leitura, aviso: avisoLeitura ?? "Nenhum anúncio encontrado na conta." };
  }

  // MEDIR sai AQUI, antes de qualquer escrita — e a posição é o ponto.
  //
  // Tudo o que apaga vem depois desta linha. Sair antes não é economia de
  // trabalho: é a garantia de que perguntar "o que o ML tem?" não pode, por
  // nenhum caminho, apagar o catálogo.
  if (modo === "medir") {
    // Uma LEITURA a mais, para o "novos por status" existir. `medir` continua
    // não escrevendo nada — e continua saindo antes de tudo que apaga.
    const conhecidos = new Set(
      (await listarAnunciosGeradosDoCliente(clienteId)).map((e) => e.mlItemId).filter(Boolean) as string[]
    );
    return {
      produtos: 0,
      anuncios: 0,
      variacoes: 0,
      imagens: 0,
      pulados: 0,
      leitura,
      aviso: avisoLeitura,
      medicao: medirFichas(todos, dados.foraDaFicha, conhecidos, dados.obrigatorios),
    };
  }

  // ENRIQUECER sai aqui também — e pelo mesmo motivo.
  //
  // Escreve SÓ em `produto_atributos`. Não cria produto, não cria variante, não
  // toca em custo, peso, foto nem no vínculo com anúncios publicados. É a
  // diferença inteira em relação a `substituir`, e ela é posicional: tudo o que
  // apaga catálogo continua depois desta linha.
  //
  // O vínculo anúncio→produto já existe em `anuncios_gerados` (`ml_item_id` →
  // `produto_id`). Não é preciso reagrupar por família nem adivinhar: quem já
  // sabe qual MLB é de qual produto é a própria base.
  if (modo === "enriquecer") {
    const registros = await listarAnunciosGeradosDoCliente(clienteId);
    const produtoPorMlb = new Map<string, string>();
    for (const r of registros) {
      if (r.mlItemId && r.produtoId) produtoPorMlb.set(r.mlItemId, r.produtoId);
    }

    const plano = planejarEnriquecimento(todos, produtoPorMlb, dados.foraDaFicha);

    // UMA chamada, não um laço por produto.
    //
    // A primeira versão iterava os produtos, e cada par apagar+inserir dispara
    // `notificarMudanca()` — que faz as 5 `useLiveQuery` desta tela recarregarem,
    // duas delas com ~600 linhas. Com 73 produtos isso vira uma tempestade de
    // centenas de requisições, e o navegador desistiu no nono:
    // `TypeError: Failed to fetch`.
    //
    // Agora o serviço faz DUAS requisições no total, e o plano já vem com o
    // `produtoId` em cada linha.
    await substituirAtributosDoMarketplace(clienteId, plano.paraGravar);

    return {
      produtos: 0,
      anuncios: 0,
      variacoes: 0,
      imagens: 0,
      pulados: 0,
      leitura,
      aviso: avisoLeitura,
      enriquecimento: {
        atributos: plano.paraGravar.length,
        produtos: plano.produtos,
        conflitos: plano.conflitos,
        anunciosSemProduto: plano.anunciosSemProduto,
      },
    };
  }

  let anuncios = todos;
  let pulados = 0;
  let estadosAtualizados = 0;
  let estadosQueFalharam = 0;
  if (modo === "substituir") {
    // SUBSTITUI: apaga a importação anterior do ML (anúncios + produtos, com as
    // variações em cascata) antes de reimportar — evita duplicar e não depende
    // de limpar via SQL. Só mexe no que foi importado do ML.
    await excluirAnunciosImportadosML(clienteId);
    await excluirProdutosImportadosML(clienteId);
  } else {
    // NOVOS: mantém o que já existe; só traz os MLBs ainda não importados.
    const existentes = await listarAnunciosGeradosDoCliente(clienteId);

    // O estado dos anúncios que JÁ temos chega nesta mesma resposta, e era
    // descartado — o mesmo defeito que jogou fora a ficha do lojista, a
    // associação foto↔cor e o `paging.total`. Não é leitura nova: é parar de
    // descartar a que já foi feita.
    //
    // Grava só onde o valor MUDOU, e só as duas colunas do eixo do marketplace.
    // `status` (a esteira do Zion) não é tocado. Anúncio que o ML não devolveu
    // fica intocado: ausência não é encerramento.
    const desatualizados = estadosDesatualizados(
      existentes,
      todos.map((a) => ({ mlb: a.mlb, status: a.status })),
      new Date().toISOString()
    );
    if (desatualizados.length > 0) {
      const r = await atualizarEstadoNoMarketplaceBulk(desatualizados);
      estadosAtualizados = r.atualizados;
      estadosQueFalharam = r.falharam;
    }

    const jaTem = new Set(existentes.map((e) => e.mlItemId).filter(Boolean));
    anuncios = todos.filter((a) => !jaTem.has(a.mlb));
    pulados = todos.length - anuncios.length;
    if (anuncios.length === 0) {
      // "tudo já estava importado" é uma AFIRMAÇÃO de completude. Ela só pode
      // ser dita quando a leitura viu tudo; senão, o que sai é o que faltou.
      //
      // E ela NÃO vai em `aviso`. `aviso` é o canal do que deu errado — a tela
      // pinta de vermelho o que chega por ele. Observado em 2026-08-01: uma
      // execução perfeita (781 lidos, 15 estados corrigidos, 0 falhas) apareceu
      // com triângulo de alerta, porque a frase informativa vinha por aqui.
      // Alarme falso em operação bem-sucedida é como se aprende a ignorar
      // alarme.
      return {
        produtos: 0, anuncios: 0, variacoes: 0, imagens: 0, pulados, leitura,
        estadosAtualizados,
        estadosQueFalharam,
        aviso: avisoLeitura,
      };
    }
  }

  // Agrupa por família/título → 1 produto por grupo.
  const grupos = agrupar(anuncios);

  // 1) Produtos — CASANDO antes de criar.
  //
  // Em `novos`, um grupo pode pertencer a um produto que já existe. O código
  // antigo criava produto para todo grupo, e medido contra um export do ERP em
  // 2026-08-01 isso produziria 18 DUPLICATAS — 117 dos 170 anúncios que
  // faltavam eram de produtos já cadastrados, inclusive o Papete Modare que
  // acabara de ser publicado.
  //
  // Em `substituir` não há o que casar: os produtos importados foram apagados
  // logo acima, e a lista vem vazia — o comportamento fica idêntico ao de antes.
  const jaCadastrados = modo === "novos" ? await listarProdutosDoCliente(clienteId) : [];
  const casados = casarGruposComProdutos(
    grupos.map((g) => baseProdutoDoGrupo(g).nome),
    jaCadastrados.map((p) => ({ id: p.id, nome: p.nome }))
  );

  const indicesParaCriar = grupos.map((_, i) => i).filter((i) => !casados[i]);
  const novosProdutos = await criarProdutos(
    indicesParaCriar.map((i) => ({ ...baseProdutoDoGrupo(grupos[i]), clienteId, cliente }))
  );

  // `destino[gi]` é o produto daquele grupo — o que já existia ou o recém-criado.
  const destino: { id: string; nome: string }[] = new Array(grupos.length);
  grupos.forEach((_, i) => {
    if (casados[i]) destino[i] = casados[i]!;
  });
  indicesParaCriar.forEach((gi, k) => {
    destino[gi] = { id: novosProdutos[k].id, nome: novosProdutos[k].nome };
  });
  const criados = destino;
  const temCasado = casados.some((c) => c != null);

  // 2) Variações (por tamanho na família; internas no clássico).
  //
  // Em produto CASADO a regra muda em dois pontos, e os dois têm motivo:
  //
  //   a) o atalho "unidades <= 1 → produto simples" NÃO vale. O produto já
  //      existe com a forma dele; o anúncio que chega é uma unidade A MAIS.
  //      Pular criaria o anúncio sem o tamanho — o Papete Modare que acabou de
  //      ser publicado é exatamente esse caso: 1 anúncio, 1 unidade.
  //   b) a variante pode já estar lá. Sem deduplicar, reimportar duplicaria o
  //      tamanho dentro do produto certo — trocaríamos um defeito por outro.
  const variantesJaExistentes = new Map<string, ProdutoVariante[]>();
  if (temCasado) {
    for (const v of await listarTodasVariantes()) {
      const lista = variantesJaExistentes.get(v.produtoId) ?? [];
      lista.push(v);
      variantesJaExistentes.set(v.produtoId, lista);
    }
  }

  const variantes: Omit<ProdutoVariante, "id">[] = [];
  criados.forEach((prod, gi) => {
    const g = grupos[gi];
    const casado = casados[gi] != null;
    if (!casado && unidades(g) <= 1) return; // produto simples, sem variação
    const doGrupo: Omit<ProdutoVariante, "id">[] = [];
    for (const a of g) {
      if (a.variacoes.length > 0) {
        a.variacoes.forEach((v) => doGrupo.push(varianteClassica(prod.id, clienteId, v, a)));
      } else {
        doGrupo.push(varianteDeItem(prod.id, clienteId, a));
      }
    }
    variantes.push(
      ...(casado
        ? variantesInexistentes(doGrupo, variantesJaExistentes.get(prod.id) ?? [])
        : doGrupo)
    );
  });
  if (variantes.length > 0) await criarVariantesBulk(variantes);

  // 3) Anúncios: 1 por MLB (mantém SKU↔MLB pro ERP), apontando ao produto do grupo.
  const agora = new Date().toISOString();
  const anunciosPayload = criados.flatMap((prod, gi) =>
    grupos[gi].map((a) => ({
      clienteId,
      cliente,
      produtoId: prod.id,
      produto: prod.nome,
      auditoriaId: null,
      marketplace: "Mercado Livre" as const,
      origem: "esteira" as const,
      tipoExecucao: "Simulada" as const,
      notaDiagnostico: 0,
      vereditoA10: "aprovado" as const,
      qtdPendencias: 0,
      anuncio: anuncioGeradoDoML(a, dados.foraDaFicha),
      // `status` é a esteira do Zion: o anúncio VEIO do ML, então do ponto de
      // vista dela ele está publicado — isso continua verdade.
      status: "publicado" as const,
      // O estado NO ML é outro eixo, e é o que estava sendo mentido. Antes da
      // migração 050 não havia onde dizer `paused`, e todo anúncio importado
      // virava publicado. Medido: 104 dos 511 não estavam no ar.
      //
      // Sem tradução e sem `?? "active"`: se o ML não disser, fica `null`, que
      // significa NÃO SABEMOS.
      statusMarketplace: (a.status || "").trim() || null,
      statusMarketplaceEm: agora,
      aprovadoPor: "Mercado Livre",
      aprovadoEm: agora,
      criadoEm: agora,
      observacoes: "Importado do Mercado Livre.",
      mlItemId: a.mlb,
      mlPermalink: a.permalink,
    }))
  );
  // Os produtos + variações (a base) já estão gravados. Anúncios e fotos são
  // complementares: se a rede falhar, NÃO derrubamos a importação inteira —
  // avisamos e o cliente clica de novo pra completar (é "substituir").
  let avisoParcial: string | undefined;
  let anunciosOk = 0;
  try {
    await criarAnunciosGeradosBulk(anunciosPayload);
    anunciosOk = anunciosPayload.length;
  } catch {
    avisoParcial =
      "Produtos importados e agrupados. Alguns anúncios não gravaram (rede) — clique em Importar de novo para completar.";
  }

  // 4) Imagens: as fotos reais do ML viram imagens do produto (prontas pro
  //    Estúdio IA). Capa = Principal; as demais Secundárias; dedup por URL.
  //
  //    Em produto CASADO, NÃO. E é uma decisão, não um esquecimento:
  //
  //      · `imagens_produto` não tem índice único em (produto_id, tipo_imagem).
  //        Uma segunda "Principal" entraria calada, e o produto passaria a ter
  //        duas capas sem nada reclamar.
  //      · o produto casado já tem até MAX_FOTOS fotos. Acrescentar as do
  //        anúncio novo agrava o defeito de cor que está aberto — foi ele que
  //        pôs foto Nude num anúncio Marrom (DES-003).
  //
  //    Então o casado ganha variante e anúncio, e não ganha foto. O que ele
  //    perde está no aviso do resultado, não em silêncio.
  const imagens: Omit<ImagemProduto, "id">[] = [];
  criados.forEach((prod, gi) => {
    if (casados[gi]) return;
    const urls = [...new Set(grupos[gi].flatMap((a) => a.fotos))].slice(0, MAX_FOTOS);
    urls.forEach((url, i) => {
      imagens.push({
        clienteId,
        produtoId: prod.id,
        varianteId: null,
        anuncioId: null,
        tipoImagem: i === 0 ? "Principal" : "Secundária",
        url,
        status: "Aprovada", // é a foto real que já está no anúncio
        observacoes: "Importada do Mercado Livre.",
      });
    });
  });
  let imagensOk = 0;
  try {
    if (imagens.length > 0) await criarImagensBulk(imagens);
    imagensOk = imagens.length;
  } catch {
    /* fotos são secundárias — não derruba a importação */
  }

  const qtdCasados = casados.filter((c) => c != null).length;
  return {
    produtos: novosProdutos.length,
    casados: qtdCasados,
    anuncios: anunciosOk,
    variacoes: variantes.length,
    imagens: imagensOk,
    pulados,
    leitura,
    estadosAtualizados,
    estadosQueFalharam,
    aviso: [avisoLeitura, avisoParcial].filter(Boolean).join(" ") || undefined,
  };
}
