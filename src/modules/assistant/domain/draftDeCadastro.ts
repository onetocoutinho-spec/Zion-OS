// O cadastro em conversa — o estado que acumula entre uma frase e a criação.
//
// ESTE MÓDULO NÃO É UM SEGUNDO MOTOR DE CADASTRO.
//
// `catalog/domain/cadastroManual` continua sendo a AUTORIDADE sobre o que é
// obrigatório (`validarRascunho`) e sobre como um rascunho vira produto
// (`montarProduto`). O Draft CONVERTE para `RascunhoProduto` na finalização —
// e a conversão está aqui, em `paraRascunho`, justamente para não existir uma
// segunda lista de campos obrigatórios em lugar nenhum.
//
// O que o Draft acrescenta é o que o formulário não precisava:
//
//   PROCEDÊNCIA   informado ≠ inferido, campo a campo (`fatosDoCadastro`)
//   VARIANTES     `RascunhoProduto` tem um par cor/tamanho; a conversa tem seis
//   PERSISTÊNCIA  o formulário é estado de React; isto sobrevive ao navegador
//   CICLO DE VIDA um rascunho não autoriza escrita; a Proposal autoriza
//
// A REGRA QUE ATRAVESSA O MÓDULO:
//
//     o domínio determina o estado · o Gemini só traz palavras
//
// Nenhuma transição depende de o modelo ter escrito "está pronto". Prontidão é
// `validarRascunho` sobre a conversão, e mais nada.
//
// ---------------------------------------------------------------------------
// CUSTO — a semântica foi INSPECIONADA, não suposta.
//
// `CadastrarProduto` grava o custo no PRODUTO PAI e copia o MESMO valor para a
// variante que cria. `produto_variantes.custo` existe, mas o caminho de cadastro
// nunca o trata como independente. O Draft respeita isso: custo e preço são
// fatos do produto, e cada variante criada recebe a cópia — igual ao formulário.
//
// Isto é deliberado depois do incidente de R$ 30 milhões: inventar aqui uma
// semântica de custo por variante que o resto do sistema não tem produziria
// dois significados para a mesma coluna.

import type { Marketplace } from "../../../lib/types";
import {
  RASCUNHO_VAZIO,
  validarRascunho,
  embalagemDoRascunho,
  avisoDePreco,
  type ProblemaCampo,
  type RascunhoProduto,
} from "../../catalog/domain/cadastroManual";
import { MARGEM_MINIMA_PADRAO } from "../../pricing/domain/modeloPreco.ts";
import {
  aceitarFato,
  ehCritico,
  lerDinheiroEmCentavos,
  lerIdentificador,
  type Fato,
  type Procedencia,
} from "./fatosDoCadastro";
import {
  associarIdentificador,
  escreverVariante,
  montarGrade,
  resumirGrade,
  variantesSem,
  type EixosDitos,
  type VarianteEmRascunho,
} from "./gradeDeVariantes";
import { lerNumero, paraGramas } from "./propostaDeCorrecao";

// ---------------------------------------------------------------------------
// campos
// ---------------------------------------------------------------------------

/**
 * Os campos que um cadastro em conversa acumula.
 *
 * É a união do que `RascunhoProduto` pede com o que a conversa sabe a mais
 * (`modelo`, que o lojista chama de referência, e `ean`). Nada inventado: cada
 * um destes tem coluna em `produtos` ou em `produto_variantes`.
 */
export const CAMPOS_DO_CADASTRO = [
  "nome",
  "marca",
  "modelo",
  "categoria",
  "sku",
  "ean",
  "custo",
  "precoVenda",
  "estoque",
  "cor",
  "tamanho",
  "pesoGramas",
  "alturaCm",
  "larguraCm",
  "comprimentoCm",
] as const;
export type CampoDoCadastro = (typeof CAMPOS_DO_CADASTRO)[number];

export function ehCampoDoCadastro(campo: string): campo is CampoDoCadastro {
  return (CAMPOS_DO_CADASTRO as readonly string[]).includes(campo);
}

/** Dinheiro, sempre em CENTAVOS INTEIROS. Ver `lerDinheiroEmCentavos`. */
const CAMPOS_DE_DINHEIRO: readonly CampoDoCadastro[] = ["custo", "precoVenda"];
/** Identificadores. Texto, sempre — 473 SKUs desta base começam com zero. */
const CAMPOS_DE_IDENTIFICADOR: readonly CampoDoCadastro[] = ["sku", "ean"];
/** Números simples. Peso tem dedução de unidade própria. */
const CAMPOS_NUMERICOS: readonly CampoDoCadastro[] = [
  "estoque",
  "pesoGramas",
  "alturaCm",
  "larguraCm",
  "comprimentoCm",
];

export type ValorDeFato = string | number;

// ---------------------------------------------------------------------------
// estado
// ---------------------------------------------------------------------------

/**
 * O ciclo de vida. Mão única a partir de `criado` e `cancelado`.
 *
 * `pronto_para_finalizar` NÃO é uma opinião do modelo: é `validarRascunho` sem
 * problemas sobre a conversão. `aguardando_confirmacao` significa que existe uma
 * Proposal persistida — e é ela, não o Draft, que autoriza a escrita.
 */
export type EstadoDoDraft =
  | "ativo"
  | "pronto_para_finalizar"
  | "aguardando_confirmacao"
  | "criado"
  | "cancelado";

/** Uma discordância entre dois fatos de MESMA força sobre um campo crítico. */
export interface ConflitoDeFato {
  campo: CampoDoCadastro;
  valorAtual: ValorDeFato;
  valorNovo: ValorDeFato;
  procedencia: Procedencia;
}

export interface DraftDeCadastro {
  id: string;
  clienteId: string;
  conversaId: string;
  criadoPor: string | null;
  status: EstadoDoDraft;
  fatos: Readonly<Partial<Record<CampoDoCadastro, Fato<ValorDeFato>>>>;
  variantes: readonly VarianteEmRascunho[];
  /** Discordâncias abertas. Enquanto houver, o Draft não fica pronto. */
  conflitos: readonly ConflitoDeFato[];
  /** A Proposal de criação, quando já existe. */
  propostaId: string | null;
  /** O produto criado, quando o desfecho foi criação. */
  produtoId: string | null;
  criadoEm: string;
  atualizadoEm: string;
  /** Trava de escrita concorrente. Sobe a cada gravação. */
  versao: number;
}

export function draftNovo(base: {
  id: string;
  clienteId: string;
  conversaId: string;
  criadoPor: string | null;
  agoraISO: string;
}): DraftDeCadastro {
  return {
    id: base.id,
    clienteId: base.clienteId,
    conversaId: base.conversaId,
    criadoPor: base.criadoPor,
    status: "ativo",
    fatos: {},
    variantes: [],
    conflitos: [],
    propostaId: null,
    produtoId: null,
    criadoEm: base.agoraISO,
    atualizadoEm: base.agoraISO,
    versao: 1,
  };
}

/**
 * O Draft é deste cliente?
 *
 * Um Draft de outro tenant tem que ser INDISTINGUÍVEL de inexistente para quem
 * pergunta. A distinção fica aqui, no domínio, para a rota poder registrar a
 * tentativa na auditoria e ainda assim responder a mesma frase — o mesmo desenho
 * de `podeExecutar`.
 */
export function draftVisivelPara(
  draft: DraftDeCadastro | null,
  clienteIdDaSessao: string
): boolean {
  return Boolean(draft && draft.clienteId === clienteIdDaSessao);
}

/** Os estados em que um Draft ainda é trabalho aberto. */
export const ESTADOS_ATIVOS: readonly EstadoDoDraft[] = [
  "ativo",
  "pronto_para_finalizar",
  "aguardando_confirmacao",
];

export function draftEstaAberto(draft: DraftDeCadastro): boolean {
  return ESTADOS_ATIVOS.includes(draft.status);
}

// ---------------------------------------------------------------------------
// fatos
// ---------------------------------------------------------------------------

/**
 * A força de cada procedência.
 *
 * `informado` acima de `catalogo` porque quem está com a caixa na mão sabe mais
 * que uma linha gravada há seis meses. `inferido` no chão — e para campo
 * crítico ele nem chega aqui, `aceitarFato` recusa antes.
 */
const FORCA: Record<Procedencia, number> = {
  informado: 3,
  catalogo: 2,
  derivado: 1,
  inferido: 0,
};

export type ResultadoDeInformar =
  | { ok: true; draft: DraftDeCadastro; valor: ValorDeFato; unidadeDeduzida?: boolean }
  /** Nada mudou. `conflito` presente quando a recusa foi por discordância. */
  | { ok: false; motivo: string; conflito?: ConflitoDeFato; draft?: DraftDeCadastro };

/**
 * Lê o valor bruto no tipo do campo — ou devolve `null` quando não dá.
 *
 * `null` aqui NUNCA vira zero nem palpite. Dinheiro ambíguo ("1.2"), número
 * ilegível e identificador vazio voltam para a fila de perguntas.
 */
export function lerValorDoCampo(
  campo: CampoDoCadastro,
  bruto: string,
  unidade = ""
): { valor: ValorDeFato; unidadeDeduzida?: boolean } | null {
  const texto = String(bruto ?? "").trim();
  if (!texto) return null;

  if (CAMPOS_DE_DINHEIRO.includes(campo)) {
    const centavos = lerDinheiroEmCentavos(texto);
    return centavos === null ? null : { valor: centavos };
  }
  if (CAMPOS_DE_IDENTIFICADOR.includes(campo)) {
    const id = lerIdentificador(texto);
    return id === null ? null : { valor: id };
  }
  if (campo === "pesoGramas") {
    // A dedução de unidade já existe e já é mostrada a quem confirma. Escrever
    // uma segunda aqui faria "300" virar coisa diferente em dois lugares.
    const n = lerNumero(texto);
    if (n === null) return null;
    const g = paraGramas(n, unidade);
    return g === null ? null : { valor: g.gramas, unidadeDeduzida: g.deduzida };
  }
  if (CAMPOS_NUMERICOS.includes(campo)) {
    const n = lerNumero(texto);
    if (n === null || n < 0) return null;
    return { valor: n };
  }
  return { valor: texto };
}

/**
 * Acumula um fato — ou recusa, dizendo por quê.
 *
 * As três recusas, em ordem de checagem:
 *
 *   1. NÃO SE LÊ o valor      — "1.2" de dinheiro não vira R$ 1,20 nem R$ 12,00
 *   2. INFERÊNCIA em campo crítico — `aceitarFato` decide, não este módulo
 *   3. DISCORDÂNCIA de mesma força em campo crítico — vira conflito aberto
 *
 * O caso 3 é o que impede o custo de mudar em silêncio no meio da conversa. Duas
 * frases do lojista com valores diferentes de custo não são um erro de digitação
 * presumido: são duas afirmações, e o domínio pergunta qual vale em vez de ficar
 * com a última. Campo não-crítico (nome, cor) aceita a correção direto — ali a
 * última palavra é claramente a correção.
 */
export function informar(
  draft: DraftDeCadastro,
  campo: CampoDoCadastro,
  bruto: string,
  procedencia: Procedencia,
  agoraISO: string,
  unidade = ""
): ResultadoDeInformar {
  if (!draftEstaAberto(draft)) {
    return { ok: false, motivo: `Este cadastro está ${draft.status} e não aceita mais dados.` };
  }

  const lido = lerValorDoCampo(campo, bruto, unidade);
  if (!lido) {
    return { ok: false, motivo: motivoDeLeitura(campo, bruto) };
  }

  const aceite = aceitarFato(campo, lido.valor, procedencia);
  if (!aceite.aceito) return { ok: false, motivo: aceite.motivo };

  const atual = draft.fatos[campo];
  if (atual) {
    const forcaNova = FORCA[procedencia];
    const forcaAtual = FORCA[atual.procedencia];
    if (forcaNova < forcaAtual) {
      return {
        ok: false,
        motivo: `Já tenho ${campo} de fonte mais confiável (${atual.procedencia}). Não substituí.`,
      };
    }
    if (forcaNova === forcaAtual && !mesmoValor(atual.valor, lido.valor)) {
      if (ehCritico(campo)) {
        const conflito: ConflitoDeFato = {
          campo,
          valorAtual: atual.valor,
          valorNovo: lido.valor,
          procedencia,
        };
        return {
          ok: false,
          motivo: `Você já tinha me dito outro ${campo}. Qual vale?`,
          conflito,
          draft: comAtualizacao(
            { ...draft, conflitos: [...semConflitoDe(draft.conflitos, campo), conflito] },
            agoraISO
          ),
        };
      }
    }
  }

  const draftComFato = comAtualizacao(
    {
      ...draft,
      fatos: { ...draft.fatos, [campo]: { valor: lido.valor, procedencia } },
      conflitos: semConflitoDe(draft.conflitos, campo),
    },
    agoraISO
  );
  return {
    ok: true,
    draft: comStatusRecalculado(draftComFato),
    valor: lido.valor,
    ...(lido.unidadeDeduzida ? { unidadeDeduzida: true } : {}),
  };
}

/** Fecha um conflito escolhendo um dos dois valores. Ninguém escolhe sozinho. */
export function resolverConflito(
  draft: DraftDeCadastro,
  campo: CampoDoCadastro,
  escolha: "atual" | "novo",
  agoraISO: string
): ResultadoDeInformar {
  const conflito = draft.conflitos.find((c) => c.campo === campo);
  if (!conflito) return { ok: false, motivo: `Não há conflito aberto em ${campo}.` };
  const valor = escolha === "novo" ? conflito.valorNovo : conflito.valorAtual;
  const draftResolvido = comAtualizacao(
    {
      ...draft,
      fatos: { ...draft.fatos, [campo]: { valor, procedencia: conflito.procedencia } },
      conflitos: semConflitoDe(draft.conflitos, campo),
    },
    agoraISO
  );
  return { ok: true, draft: comStatusRecalculado(draftResolvido), valor };
}

function semConflitoDe(
  conflitos: readonly ConflitoDeFato[],
  campo: CampoDoCadastro
): ConflitoDeFato[] {
  return conflitos.filter((c) => c.campo !== campo);
}

function mesmoValor(a: ValorDeFato, b: ValorDeFato): boolean {
  if (typeof a === "number" && typeof b === "number") return a === b;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function motivoDeLeitura(campo: CampoDoCadastro, bruto: string): string {
  if (CAMPOS_DE_DINHEIRO.includes(campo)) {
    return `Não consigo ler "${bruto}" como valor em reais sem adivinhar. Escreva assim: 47,80.`;
  }
  return `Não consegui ler "${bruto}" como ${campo}.`;
}

/** O valor de um campo, ou `null` quando ele ainda não foi dito. */
export function valorDe(draft: DraftDeCadastro, campo: CampoDoCadastro): ValorDeFato | null {
  return draft.fatos[campo]?.valor ?? null;
}

export function textoDe(draft: DraftDeCadastro, campo: CampoDoCadastro): string {
  const v = valorDe(draft, campo);
  return v === null ? "" : String(v);
}

export function numeroDe(draft: DraftDeCadastro, campo: CampoDoCadastro): number | null {
  const v = valorDe(draft, campo);
  return typeof v === "number" ? v : null;
}

// ---------------------------------------------------------------------------
// variantes
// ---------------------------------------------------------------------------

export type ResultadoDeGrade =
  | { ok: true; draft: DraftDeCadastro; total: number }
  | { ok: false; motivo: string };

/**
 * Define (ou redefine) a grade a partir dos eixos ditos.
 *
 * REDEFINIR NÃO APAGA IDENTIFICADOR. Quem já tinha SKU e continua existindo na
 * grade nova o mantém — o casamento é por cor+tamanho. Sem isso, "ah, também tem
 * bege 39" jogaria fora os cinco SKUs já informados, e ninguém perceberia até o
 * produto sair errado no pedido.
 */
export function definirGrade(
  draft: DraftDeCadastro,
  eixos: EixosDitos,
  agoraISO: string
): ResultadoDeGrade {
  if (!draftEstaAberto(draft)) {
    return { ok: false, motivo: `Este cadastro está ${draft.status} e não aceita mais dados.` };
  }
  const nova = montarGrade(eixos);
  if (nova.length === 0) {
    return { ok: false, motivo: "Não entendi as cores e os tamanhos." };
  }
  const preservada = nova.map((v) => {
    const antiga = draft.variantes.find(
      (a) => iguais(a.cor, v.cor) && iguais(a.tamanho, v.tamanho)
    );
    return antiga ? { ...v, ...(antiga.sku ? { sku: antiga.sku } : {}), ...(antiga.ean ? { ean: antiga.ean } : {}) } : v;
  });
  return {
    ok: true,
    draft: comStatusRecalculado(comAtualizacao({ ...draft, variantes: preservada }, agoraISO)),
    total: preservada.length,
  };
}

export type ResultadoDeAssociacao =
  | { ok: true; draft: DraftDeCadastro; variante: string }
  | { ok: false; motivo: string; candidatos?: readonly string[] };

/**
 * Associa um SKU ou EAN a UMA variante.
 *
 * Toda a decisão é de `associarIdentificador` — inclusive a recusa de alvo
 * ambíguo com os candidatos. Aqui só se costura o resultado no Draft.
 */
export function associarNaVariante(
  draft: DraftDeCadastro,
  campo: "sku" | "ean",
  valor: string,
  alvo: { cor?: string; tamanho?: string },
  agoraISO: string
): ResultadoDeAssociacao {
  if (!draftEstaAberto(draft)) {
    return { ok: false, motivo: `Este cadastro está ${draft.status} e não aceita mais dados.` };
  }
  if (draft.variantes.length === 0) {
    return { ok: false, motivo: "Ainda não tenho a grade de variantes deste produto." };
  }
  const r = associarIdentificador(draft.variantes, campo, valor, alvo);
  if (!r.ok) return { ok: false, motivo: r.motivo, ...(r.candidatos ? { candidatos: r.candidatos } : {}) };
  return {
    ok: true,
    draft: comStatusRecalculado(comAtualizacao({ ...draft, variantes: r.grade }, agoraISO)),
    variante: escreverVariante(r.grade[r.indice]),
  };
}

/** O resumo da grade, para o cartão e para a pergunta seguinte. */
export function resumoDasVariantes(draft: DraftDeCadastro): {
  total: number;
  porCor: readonly { cor: string; tamanhos: readonly string[] }[];
  semSku: number;
  semEan: number;
} {
  const r = resumirGrade(draft.variantes);
  return {
    total: r.total,
    porCor: r.porCor,
    semSku: variantesSem(draft.variantes, "sku").length,
    semEan: variantesSem(draft.variantes, "ean").length,
  };
}

function iguais(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// conversão — a travessia para a autoridade
// ---------------------------------------------------------------------------

/**
 * Centavos de volta para o texto que `paraNumero` lê.
 *
 * Vírgula decimal porque é o que `cadastroManual.paraNumero` trata como
 * decimal em pt-BR, e porque é o que aparece na tela se alguém abrir o cadastro
 * manual depois.
 */
export function centavosParaTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

/**
 * Draft → `RascunhoProduto`.
 *
 * A ÚNICA travessia. Depois dela quem manda é `validarRascunho` e
 * `montarProduto`, exatamente como no formulário — e é por isso que um produto
 * criado pela conversa é indistinguível de um criado à mão.
 *
 * O QUE O DRAFT SABE A MAIS e não cabe aqui:
 *
 *   modelo    — vai para `produtos.modelo` na criação, fora do rascunho
 *   ean       — vive na VARIANTE, e o rascunho não tem variantes
 *   variantes — a grade inteira; o rascunho carrega só o primeiro par
 *
 * Isso NÃO é perda: os três atravessam na criação, por
 * `criacaoDeProduto`. O rascunho é o crivo do obrigatório, não o transporte.
 *
 * COR E TAMANHO com grade: o rascunho recebe o primeiro par apenas para o
 * produto pai ficar coerente com o que o formulário produz — as seis variantes
 * são criadas depois, a partir da grade.
 */
export function paraRascunho(draft: DraftDeCadastro): RascunhoProduto {
  const primeira = draft.variantes[0];
  const custo = numeroDe(draft, "custo");
  const preco = numeroDe(draft, "precoVenda");
  const estoque = numeroDe(draft, "estoque");
  const peso = numeroDe(draft, "pesoGramas");
  const altura = numeroDe(draft, "alturaCm");
  const largura = numeroDe(draft, "larguraCm");
  const comprimento = numeroDe(draft, "comprimentoCm");

  return {
    ...RASCUNHO_VAZIO,
    nome: textoDe(draft, "nome"),
    sku: skuDoProduto(draft),
    precoVenda: preco === null ? "" : centavosParaTexto(preco),
    custo: custo === null ? "" : centavosParaTexto(custo),
    estoque: estoque === null ? "" : String(estoque),
    marca: textoDe(draft, "marca"),
    categoria: textoDe(draft, "categoria"),
    cor: textoDe(draft, "cor") || primeira?.cor || "",
    tamanho: textoDe(draft, "tamanho") || primeira?.tamanho || "",
    marketplace: "Mercado Livre" as Marketplace,
    pesoGramas: peso === null ? "" : String(peso),
    alturaCm: altura === null ? "" : String(altura),
    larguraCm: largura === null ? "" : String(largura),
    comprimentoCm: comprimento === null ? "" : String(comprimento),
  };
}

/**
 * O SKU do produto PAI.
 *
 * `validarRascunho` o exige, e ele é campo crítico — não se infere. Há UM caso
 * em que ele não é inferência: a grade tem exatamente uma variante e essa
 * variante tem SKU informado. Aí produto e variante são a mesma unidade, e é
 * literalmente o que `CadastrarProduto` faz hoje (o mesmo SKU vai para os dois).
 *
 * Com duas ou mais variantes NÃO há derivação possível: escolher o SKU de uma
 * delas para o pai seria eleger uma variante como representante — invenção.
 * O domínio pergunta.
 */
export function skuDoProduto(draft: DraftDeCadastro): string {
  const informado = textoDe(draft, "sku");
  if (informado) return informado;
  if (draft.variantes.length === 1 && draft.variantes[0].sku) return draft.variantes[0].sku;
  return "";
}

// ---------------------------------------------------------------------------
// prontidão e o que falta
// ---------------------------------------------------------------------------

export interface Pendencia {
  campo: CampoDoCadastro | "variantes" | "conflito";
  rotulo: string;
  /** Por que ela existe, na voz de quem vai responder. */
  porque: string;
  /** Verdadeiro quando impede a CRIAÇÃO. Vem de `validarRascunho`. */
  bloqueia: boolean;
}

/**
 * O que ainda falta — bloqueios primeiro, na ordem em que resolver rende.
 *
 * OS BLOQUEIOS VÊM DE `validarRascunho`. Não existe aqui uma segunda lista
 * dizendo "nome, sku e precoVenda são obrigatórios": ela existiria para
 * divergir da primeira no dia em que uma das duas mudasse.
 *
 * As pendências NÃO bloqueantes são outra coisa e estão marcadas como tal: peso
 * e medidas não impedem criar, impedem PRECIFICAR — é o que `avisoDePreco` já
 * diz quando devolve piso indefinido.
 */
export function oQueFalta(draft: DraftDeCadastro): Pendencia[] {
  const pendencias: Pendencia[] = [];

  // Conflito aberto vem antes de tudo: enquanto o lojista tiver dito dois
  // custos, perguntar o preço é conversar por cima de uma contradição.
  for (const c of draft.conflitos) {
    pendencias.push({
      campo: "conflito",
      rotulo: `Qual ${c.campo} vale`,
      porque: `Você me disse dois valores diferentes para ${c.campo}.`,
      bloqueia: true,
    });
  }

  const problemas = validarRascunho(paraRascunho(draft));
  for (const p of problemas) {
    pendencias.push({
      campo: p.campo as CampoDoCadastro,
      rotulo: rotuloDoCampo(p.campo as CampoDoCadastro),
      porque: p.texto,
      bloqueia: true,
    });
  }

  // ---- não bloqueiam a criação, mas travam trabalho logo depois ----
  const rascunho = paraRascunho(draft);
  if (!embalagemDoRascunho(rascunho)) {
    pendencias.push({
      campo: "pesoGramas",
      rotulo: "Peso e medidas da embalagem",
      porque: "Sem elas eu não calculo o frete, e sem frete não existe preço mínimo.",
      bloqueia: false,
    });
  }
  if (numeroDe(draft, "custo") === null) {
    pendencias.push({
      campo: "custo",
      rotulo: "Custo",
      porque: "Sem custo eu não sei a sua margem nem o piso do preço.",
      bloqueia: false,
    });
  }
  if (draft.variantes.length > 0) {
    const semSku = variantesSem(draft.variantes, "sku").length;
    if (semSku > 0) {
      pendencias.push({
        campo: "variantes",
        rotulo: `SKU de ${semSku} variante${semSku > 1 ? "s" : ""}`,
        porque: "Sem SKU por variante o estoque não concilia com o seu ERP.",
        bloqueia: false,
      });
    }
  }
  return pendencias;
}

function rotuloDoCampo(campo: CampoDoCadastro): string {
  const rotulos: Partial<Record<CampoDoCadastro, string>> = {
    nome: "Nome do produto",
    sku: "SKU do produto",
    precoVenda: "Preço de venda",
    custo: "Custo",
    marca: "Marca",
    modelo: "Referência",
    categoria: "Categoria",
    ean: "EAN",
    estoque: "Estoque",
    pesoGramas: "Peso",
  };
  return rotulos[campo] ?? campo;
}

/**
 * Pode finalizar?
 *
 * `validarRascunho` é a autoridade — e conflito aberto some por cima dela: um
 * cadastro com duas afirmações de custo não está pronto mesmo que o rascunho
 * passe, porque o valor que iria para o banco é uma das duas escolhida sozinha.
 */
export function prontidao(draft: DraftDeCadastro): {
  pronto: boolean;
  problemas: readonly ProblemaCampo[];
  conflitos: readonly ConflitoDeFato[];
} {
  const problemas = validarRascunho(paraRascunho(draft));
  return {
    pronto: problemas.length === 0 && draft.conflitos.length === 0,
    problemas,
    conflitos: draft.conflitos,
  };
}

/** O aviso de preço abaixo do piso — a mesma função do formulário. */
export function avisoDePrecoDoDraft(
  draft: DraftDeCadastro,
  margemMinima: number = MARGEM_MINIMA_PADRAO
): ReturnType<typeof avisoDePreco> {
  return avisoDePreco(paraRascunho(draft), margemMinima);
}

// ---------------------------------------------------------------------------
// ciclo de vida
// ---------------------------------------------------------------------------

export type TransicaoDoDraft =
  | { ok: true; draft: DraftDeCadastro }
  | { ok: false; motivo: string };

/**
 * Recalcula `ativo` ↔ `pronto_para_finalizar` a cada mudança de fato.
 *
 * Só entre esses dois. Um Draft `aguardando_confirmacao` não volta a `ativo`
 * porque um fato chegou: a Proposal já foi montada sobre o estado anterior, e
 * quem decide o destino dela é a revalidação, não este recálculo.
 */
export function comStatusRecalculado(draft: DraftDeCadastro): DraftDeCadastro {
  if (draft.status !== "ativo" && draft.status !== "pronto_para_finalizar") return draft;
  const alvo: EstadoDoDraft = prontidao(draft).pronto ? "pronto_para_finalizar" : "ativo";
  return draft.status === alvo ? draft : { ...draft, status: alvo };
}

/**
 * Draft → `aguardando_confirmacao`, com a Proposal que autoriza.
 *
 * Só a partir de `pronto_para_finalizar`. Propor a criação de um cadastro
 * incompleto produziria uma Proposal que a revalidação recusaria depois do
 * clique — e "clique aqui para falhar" é pior que não oferecer o botão.
 */
export function aguardarConfirmacao(
  draft: DraftDeCadastro,
  propostaId: string,
  agoraISO: string
): TransicaoDoDraft {
  if (draft.status === "cancelado") {
    return { ok: false, motivo: "Esse cadastro foi cancelado." };
  }
  if (draft.status === "criado") {
    return { ok: false, motivo: "Esse cadastro já virou produto." };
  }
  if (draft.status !== "pronto_para_finalizar") {
    return { ok: false, motivo: "Esse cadastro ainda não está completo." };
  }
  return {
    ok: true,
    draft: comAtualizacao({ ...draft, status: "aguardando_confirmacao", propostaId }, agoraISO),
  };
}

/** Draft → `criado`. Só depois de a criação ter acontecido de verdade. */
export function marcarCriado(
  draft: DraftDeCadastro,
  produtoId: string,
  agoraISO: string
): TransicaoDoDraft {
  if (draft.status === "cancelado") {
    return { ok: false, motivo: "Esse cadastro foi cancelado." };
  }
  if (draft.status === "criado") {
    return { ok: false, motivo: "Esse cadastro já virou produto." };
  }
  return { ok: true, draft: comAtualizacao({ ...draft, status: "criado", produtoId }, agoraISO) };
}

/**
 * Draft → `cancelado`.
 *
 * NÃO apaga. O histórico do Copilot é auditável, e um cadastro que sumiu não
 * responde "por que aquele produto nunca foi criado?". Cancelado deixa de
 * aparecer como ativo, não pode ser finalizado, e continua legível.
 */
export function cancelar(draft: DraftDeCadastro, agoraISO: string): TransicaoDoDraft {
  if (draft.status === "criado") {
    return { ok: false, motivo: "Esse cadastro já virou produto — não dá para cancelar." };
  }
  if (draft.status === "cancelado") {
    return { ok: false, motivo: "Esse cadastro já estava cancelado." };
  }
  return { ok: true, draft: comAtualizacao({ ...draft, status: "cancelado" }, agoraISO) };
}

function comAtualizacao(draft: DraftDeCadastro, agoraISO: string): DraftDeCadastro {
  return { ...draft, atualizadoEm: agoraISO, versao: draft.versao + 1 };
}

// ---------------------------------------------------------------------------
// retomada
// ---------------------------------------------------------------------------

/**
 * Como o Draft aparece numa lista de escolha.
 *
 * Um cadastro sem nome ainda precisa ser escolhível — "Produto ainda sem nome" é
 * pior que nada? Não: é honesto, e a marca ou a referência costumam estar lá.
 */
export function rotuloDoDraft(draft: DraftDeCadastro): string {
  const partes = [textoDe(draft, "marca"), textoDe(draft, "nome") || textoDe(draft, "modelo")]
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length === 0) return "Produto ainda sem nome";
  const rotulo = partes.join(" ");
  const referencia = textoDe(draft, "modelo");
  return referencia && !rotulo.includes(referencia) ? `${rotulo} ${referencia}` : rotulo;
}

export type Retomada =
  | { desfecho: "nenhum" }
  | { desfecho: "unico"; draft: DraftDeCadastro }
  | {
      desfecho: "varios";
      candidatos: readonly { ordem: number; id: string; rotulo: string }[];
      mensagem: string;
    };

/**
 * "Continua aquele cadastro."
 *
 * Um só → retoma. Vários → MOSTRA e pergunta. Nunca escolhe: o Draft errado
 * recebe os fatos do produto certo, e ninguém percebe até o produto sair errado.
 *
 * A `dica` é o que o lojista disse junto ("continua o da Modare"). Ela FILTRA;
 * se filtrar para exatamente um, retoma. Se não filtrar para nada, mostra todos
 * — melhor mostrar demais que dizer "não achei" sobre algo que existe.
 */
export function escolherParaRetomar(
  drafts: readonly DraftDeCadastro[],
  dica = ""
): Retomada {
  const abertos = drafts.filter(draftEstaAberto);
  if (abertos.length === 0) return { desfecho: "nenhum" };

  const termo = dica.trim().toLowerCase();
  const filtrados = termo
    ? abertos.filter((d) => rotuloDoDraft(d).toLowerCase().includes(termo))
    : abertos;
  const alvo = filtrados.length > 0 ? filtrados : abertos;

  if (alvo.length === 1) return { desfecho: "unico", draft: alvo[0] };
  return {
    desfecho: "varios",
    candidatos: alvo.map((d, i) => ({ ordem: i + 1, id: d.id, rotulo: rotuloDoDraft(d) })),
    mensagem: `Você tem ${alvo.length} cadastros em andamento. Qual deles?`,
  };
}

// ---------------------------------------------------------------------------
// o que a conversa vê
// ---------------------------------------------------------------------------

/**
 * O Draft no formato que o modelo e a tela leem.
 *
 * Dinheiro sai ESCRITO ("R$ 47,80") e não em centavos: o modelo repetiria "4780"
 * numa frase se recebesse 4780, e a tela teria que reconverter. A unidade
 * canônica fica no Draft; a borda escreve.
 */
export function comoResumo(draft: DraftDeCadastro): {
  draftId: string;
  status: EstadoDoDraft;
  rotulo: string;
  jaSei: readonly { campo: string; valor: string; procedencia: Procedencia }[];
  variantes: { total: number; porCor: readonly { cor: string; tamanhos: readonly string[] }[]; semSku: number };
  falta: readonly { o_que: string; porque: string; bloqueia: boolean }[];
  conflitos: readonly { campo: string; valorAtual: string; valorNovo: string }[];
  prontoParaCriar: boolean;
} {
  const variantes = resumoDasVariantes(draft);
  return {
    draftId: draft.id,
    status: draft.status,
    rotulo: rotuloDoDraft(draft),
    jaSei: CAMPOS_DO_CADASTRO.filter((c) => draft.fatos[c]).map((c) => ({
      campo: rotuloDoCampo(c),
      valor: escreverCampo(c, draft.fatos[c]!.valor),
      procedencia: draft.fatos[c]!.procedencia,
    })),
    variantes: { total: variantes.total, porCor: variantes.porCor, semSku: variantes.semSku },
    falta: oQueFalta(draft).map((p) => ({ o_que: p.rotulo, porque: p.porque, bloqueia: p.bloqueia })),
    conflitos: draft.conflitos.map((c) => ({
      campo: c.campo,
      valorAtual: escreverCampo(c.campo, c.valorAtual),
      valorNovo: escreverCampo(c.campo, c.valorNovo),
    })),
    prontoParaCriar: prontidao(draft).pronto,
  };
}

/** Como um campo aparece para quem lê. Dinheiro em reais, peso em gramas. */
export function escreverCampo(campo: CampoDoCadastro, valor: ValorDeFato): string {
  if (CAMPOS_DE_DINHEIRO.includes(campo) && typeof valor === "number") {
    return `R$ ${centavosParaTexto(valor)}`;
  }
  if (campo === "pesoGramas" && typeof valor === "number") return `${valor} g`;
  return String(valor);
}

/**
 * A frase que a pessoa lê antes de autorizar a criação.
 *
 * É o `resumo` que vai para a Proposal e para a auditoria — o que foi mostrado,
 * não só o que foi gravado.
 */
export function resumoDaCriacao(draft: DraftDeCadastro): string {
  const partes: string[] = [`Criar "${textoDe(draft, "nome") || rotuloDoDraft(draft)}"`];
  const sku = skuDoProduto(draft);
  if (sku) partes.push(`SKU ${sku}`);
  const preco = numeroDe(draft, "precoVenda");
  if (preco !== null) partes.push(`preço R$ ${centavosParaTexto(preco)}`);
  const custo = numeroDe(draft, "custo");
  if (custo !== null) partes.push(`custo R$ ${centavosParaTexto(custo)}`);
  if (draft.variantes.length > 0) {
    partes.push(
      `${draft.variantes.length} variante${draft.variantes.length > 1 ? "s" : ""}`
    );
  }
  return `${partes.join(", ")}.`;
}
