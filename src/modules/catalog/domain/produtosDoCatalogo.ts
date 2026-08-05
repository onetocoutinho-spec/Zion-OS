// O que um catálogo em PDF pode honestamente virar — puro, sem rede, sem IA.
//
// ===========================================================================
// POR QUE ESTE MÓDULO EXISTE, E POR QUE ELE É PEQUENO
// ===========================================================================
//
// Chegou um cliente cujo catálogo é um PDF de 90 páginas. A fronteira do
// documento (05/08/2026) fez o modelo poder LER esse PDF; este módulo decide o
// que fazer com o que ele leu.
//
// A tentação era construir um caminho novo de importação. Não há caminho novo:
// o cano já existe inteiro e é usado pela planilha —
//
//     analisar → LinhaProduto[] → conferência → confirmarImportacaoProdutos
//
// e a última etapa já sabe gravar produto com variações. Então a única coisa
// que faltava era um TRADUTOR: da forma que o modelo devolve para a forma que o
// cano já aceita. É isso, e só isso, que mora aqui.
//
// ===========================================================================
// A REGRA QUE GOVERNA TUDO: O PDF NÃO É FONTE DE PREÇO
// ===========================================================================
//
// Um catálogo de fornecedor traz nome, medida, material, cor, foto. Às vezes
// traz um preço — que é preço DELE, não o custo da lojista nem o preço de venda
// dela. Herdar esse número seria a versão mais cara do defeito que este
// repositório persegue desde a AUD-001: suposição vestida de fato, e desta vez
// numa casa decimal que decide se a loja lucra.
//
// Então custo e preço saem ZERADOS daqui, sempre, e viram pendência. A lojista
// preenche. Um produto sem preço não publica — e não publicar é infinitamente
// melhor que publicar no prejuízo.
//
// Pelo mesmo motivo `margem` é `null`: a fórmula mora em
// `modules/pricing/domain/modeloPreco` e sem custo não existe conta. `null` não
// é zero, e essa distinção já foi aprendida aqui.

import type { LinhaProduto, VariacaoImportada } from "../../../lib/services/importacaoProdutos";
import { skuDoCatalogo, skusDoLote } from "./skuDoCatalogo";

/**
 * Uma variação como uma PÁGINA de catálogo consegue descrevê-la.
 *
 * Sem SKU e sem EAN de propósito: catálogo de fornecedor quase nunca traz, e
 * inventar um código é o defeito que o prompt da esteira já proíbe em voz alta
 * — "um SKU plausível e falso vira pedido que ninguém sabe despachar".
 */
export interface VariacaoLidaDoCatalogo {
  cor?: string;
  /** "Solteiro", "Casal", "2,80 x 0,85", "6 cadeiras" — o rótulo da versão. */
  tamanho?: string;
  /**
   * As medidas DESTA versão.
   *
   * Elas subiram para cá depois que quatro páginas reais do catálogo mostraram
   * o erro do desenho anterior: a Cama BELLA é Solteiro (202 × 90 × 103) E
   * Casal (202 × 143 × 103), cada uma nas mesmas três cores; a Mesa MAXI tem
   * quatro tamanhos. Dimensão presa ao produto daria a mesma medida às duas
   * camas — e o frete de uma cama de casal cobrado como solteiro.
   *
   * O beliche, que foi a primeira página que vi, tem um tamanho só. Ele passou
   * no desenho errado por coincidência, e uma amostra de um caso é isso.
   */
  dimensoes?: DimensoesLidas;
}

/**
 * As dimensões da peça, em centímetros.
 *
 * Elas ganharam campo próprio depois que uma página real do catálogo de móveis
 * mostrou o buraco: o beliche traz 202 × 93 × 155 cm num DESENHO TÉCNICO, e o
 * schema anterior só tinha `descricao` — os três números virariam prosa e
 * seriam gravados como zero.
 *
 * Em móvel a dimensão é o produto: é ela que decide o frete (a maior linha de
 * custo da categoria) e é por ela que o comprador filtra. Perdê-la para dentro
 * de um texto livre seria perder o campo mais consequente da página.
 */
export interface DimensoesLidas {
  /** `null` = a página não mostrou. Nunca zero: zero mediria zero. */
  alturaCm?: number | null;
  larguraCm?: number | null;
  comprimentoCm?: number | null;
  pesoKg?: number | null;
}

/** Um produto como uma página de catálogo consegue descrevê-lo. */
export interface ProdutoLidoDoCatalogo {
  nome: string;
  marca?: string;
  modelo?: string;
  /** "100% Madeira Maciça de Angelim" — atributo, não enfeite de descrição. */
  material?: string;
  /**
   * Medidas do produto quando ele tem UM tamanho só (o beliche, a mesa
   * dobrável). Quando as versões medem diferente, a medida é da variação e
   * esta fica vazia — a da variação vence.
   */
  dimensoes?: DimensoesLidas;
  /** Onde no PDF isto foi lido. É o que permite a lojista conferir. */
  paginaOrigem?: number;
  /** Texto livre que a página trouxe (material, dimensões, montagem…). */
  descricao?: string;
  variacoes?: VariacaoLidaDoCatalogo[];
}

const texto = (v: string | undefined): string => (v ?? "").trim();

/** Só as medidas que a página realmente mostrou. `null` e zero são "não sei". */
function medidasUsaveis(d: DimensoesLidas | undefined): DimensoesLidas {
  const out: DimensoesLidas = {};
  for (const k of ["alturaCm", "larguraCm", "comprimentoCm", "pesoKg"] as const) {
    const v = d?.[k];
    if (typeof v === "number" && v > 0) out[k] = v;
  }
  return out;
}

/**
 * A medida da PEÇA vira texto na observação — e NÃO vai para os campos de
 * dimensão da variante.
 *
 * ===========================================================================
 * POR QUE NÃO PODE IR
 * ===========================================================================
 *
 * `altura`, `largura` e `comprimento` da variante são a EMBALAGEM: é deles que
 * `pesoCobravelGramas` tira a cubagem, e é a cubagem que define o frete quando o
 * volume pesa mais que a balança.
 *
 * O catálogo dá a medida da peça MONTADA. Um beliche de 202 × 93 × 155 viaja
 * desmontado, em caixas planas de volume muito menor. Herdar a peça como
 * embalagem infla a cubagem, sobe o preço mínimo e tira a loja do jogo — o erro
 * é para o outro lado do que eu temia, e custa igual.
 *
 * Então a embalagem fica VAZIA e vira pendência, que é o estado honesto: quem
 * sabe como aquilo viaja é a lojista ou o fornecedor, não o desenho da página.
 *
 * A medida não se perde — vai para a observação, escrita como o que é. Falta um
 * lugar ESTRUTURADO para "dimensão do produto" separado de "dimensão da caixa";
 * hoje ele não existe no modelo, e inventá-lo aqui seria decidir sozinho uma
 * mudança de schema que não é minha.
 */
function cotasDe(d: DimensoesLidas | undefined): string {
  const m = medidasUsaveis(d);
  const cotas = [
    m.larguraCm ? `${m.larguraCm} cm de largura` : null,
    m.alturaCm ? `${m.alturaCm} cm de altura` : null,
    m.comprimentoCm ? `${m.comprimentoCm} cm de comprimento` : null,
    m.pesoKg ? `${m.pesoKg} kg` : null,
  ].filter(Boolean);
  return cotas.join(" × ");
}

/**
 * As medidas da peça, do produto e de cada versão que meça diferente.
 *
 * A Cama BELLA é Solteiro E Casal com larguras distintas, e essa diferença é a
 * informação mais útil da página para quem vai comprar. Ela não cabe em campo
 * nenhum da variação hoje, então vira texto — mas texto que diz de QUAL versão
 * está falando, em vez de uma medida solta que não se sabe a quem pertence.
 */
function textoDaPeca(p: ProdutoLidoDoCatalogo): string | null {
  const doProduto = cotasDe(p.dimensoes);
  const porVersao = (p.variacoes ?? [])
    .map((v) => ({ rotulo: texto(v.tamanho), cotas: cotasDe(v.dimensoes) }))
    .filter((x) => x.cotas)
    // A mesma versão aparece uma vez por cor — Solteiro em três cores mede
    // igual nas três, e repetir isso três vezes é ruído, não informação.
    .filter((x, i, todas) => todas.findIndex((o) => o.rotulo === x.rotulo && o.cotas === x.cotas) === i);

  if (porVersao.length) {
    const lista = porVersao.map((x) => (x.rotulo ? `${x.rotulo} ${x.cotas}` : x.cotas)).join("; ");
    return `Produto montado: ${lista}.`;
  }
  return doProduto ? `Produto montado: ${doProduto}.` : null;
}

/**
 * A observação que acompanha o produto até a tela de conferência.
 *
 * Carrega a página porque é isso que torna a conferência possível: sem ela, a
 * lojista teria de procurar o produto em 90 páginas para saber se o que está na
 * tela corresponde ao que o fornecedor escreveu. Com ela, é uma olhada.
 */
export function observacaoDaOrigem(p: ProdutoLidoDoCatalogo): string {
  const partes = [
    p.paginaOrigem ? `Importado do catálogo em PDF (página ${p.paginaOrigem}).` : "Importado do catálogo em PDF.",
    texto(p.material) ? `Material: ${texto(p.material)}.` : null,
    textoDaPeca(p),
    texto(p.descricao) || null,
  ].filter(Boolean);
  return partes.join(" ");
}

/**
 * Uma linha pronta para importar, com a página de onde ela saiu do lado.
 *
 * A página viaja SEPARADA porque `LinhaProduto` é a forma do cano de importação
 * e não tem campo para ela — dentro da linha, ela só existe como prosa na
 * observação. A tela de conferência precisa dela como NÚMERO, e reextraí-la da
 * própria prosa casaria a tela com o texto que este módulo escreve.
 */
export interface LinhaComOrigem {
  linha: LinhaProduto;
  /** 0 quando o modelo não declarou a página. */
  paginaOrigem: number;
}

/**
 * Converte o que o modelo leu em linhas que o cano de importação já aceita.
 *
 * Produto sem nome é descartado: nome é a única coisa sem a qual não há produto,
 * e uma linha "Produto sem nome" vinda de um PDF é quase sempre um cabeçalho ou
 * um rodapé que o modelo confundiu com item.
 */
export function linhasDoCatalogo(
  lidos: readonly ProdutoLidoDoCatalogo[],
  marketplacePadrao: LinhaProduto["base"]["marketplace"] = "Mercado Livre"
): LinhaProduto[] {
  return linhasComOrigem(lidos, marketplacePadrao).map((x) => x.linha);
}

/**
 * O mesmo, com a página junto. É AQUI que o descarte de produto sem nome
 * acontece — `linhasDoCatalogo` delega.
 *
 * Uma segunda travessia com o mesmo filtro escrito de novo é como as duas listas
 * sairiam desalinhadas, e desalinhadas significa a página de um produto exibida
 * ao lado de outro. O erro não pareceria erro: seria só um número.
 */
export function linhasComOrigem(
  lidos: readonly ProdutoLidoDoCatalogo[],
  marketplacePadrao: LinhaProduto["base"]["marketplace"] = "Mercado Livre"
): LinhaComOrigem[] {
  const linhas: LinhaComOrigem[] = [];

  for (const p of lidos) {
    const nome = texto(p.nome);
    if (!nome) continue;

    // O fornecedor não deu código, então damos o nosso — marcado como nosso e
    // derivado do nome, para reimportar não duplicar. Ver `skuDoCatalogo`: isto
    // é criar, não inventar, e a diferença é sobre quem o código afirma ser.
    const codigos = skusDoLote(
      (p.variacoes ?? []).map((v) => ({ nome, tamanho: v.tamanho, cor: v.cor }))
    );

    const variacoes: VariacaoImportada[] = (p.variacoes ?? [])
      .map((v, i) => ({
        sku: codigos[i] ?? "",
        cor: texto(v.cor),
        tamanho: texto(v.tamanho),
        ean: "",
        // Zerados pelo mesmo motivo do produto pai: o catálogo não é fonte de
        // preço. Ver o cabeçalho deste arquivo.
        custo: 0,
        precoBase: 0,
        estoque: 0,
        idExterno: "",
        // Sem dimensão nenhuma aqui, de propósito: estes campos são a
        // EMBALAGEM, e o catálogo mede a peça montada. Ver `textoDaPeca`.
      }))
      // Uma variação que não diz nem cor nem tamanho não é uma variação — é
      // ruído de layout. Ela some aqui em vez de virar uma linha vazia que a
      // lojista teria de apagar à mão.
      .filter((v) => v.cor || v.tamanho);

    const linha: LinhaProduto = {
      base: {
        nome,
        marca: texto(p.marca),
        modelo: texto(p.modelo),
        categoria: "",
        // O produto pai leva o código da primeira versão como raiz; sem
        // variação nenhuma, o dele próprio.
        sku: variacoes[0]?.sku ?? skuDoCatalogo(nome),
        cor: variacoes[0]?.cor ?? "",
        tamanho: variacoes[0]?.tamanho ?? "",
        custo: 0,
        precoVenda: 0,
        estoque: 0,
        marketplace: marketplacePadrao,
        statusCadastro: "Não iniciado",
        statusSeo: "Pendente",
        statusDescricao: "Pendente",
        statusImagens: "Pendente",
        statusPrecificacao: "Pendente",
        prioridade: "Média",
        observacoes: observacaoDaOrigem(p),
      },
      // `null`, não zero: sem custo não há conta de margem, e zero afirmaria
      // uma margem que ninguém calculou.
      margem: null,
      ...(variacoes.length ? { variacoes } : {}),
    };

    // Página truncada e nunca negativa: ela vira rótulo na tela, e "página 3,7"
    // ou "página -1" mandaria alguém procurar o que não existe. 0 = não disse.
    const pagina = Number(p.paginaOrigem);
    linhas.push({
      linha,
      paginaOrigem: Number.isFinite(pagina) ? Math.max(0, Math.trunc(pagina)) : 0,
    });
  }

  return linhas;
}

/**
 * O que a lojista precisa saber antes de confirmar.
 *
 * Não é validação que trava — é o que a tela mostra. Preço ausente em 100% dos
 * produtos é ESPERADO vindo de PDF, e dizer isso evita que pareça defeito.
 */
export interface ResumoDoCatalogo {
  produtos: number;
  variacoes: number;
  semPreco: number;
  semPagina: number;
}

export function resumoDoCatalogo(
  lidos: readonly ProdutoLidoDoCatalogo[],
  linhas: readonly LinhaProduto[]
): ResumoDoCatalogo {
  return {
    produtos: linhas.length,
    variacoes: linhas.reduce((s, l) => s + (l.variacoes?.length ?? 0), 0),
    semPreco: linhas.filter((l) => !l.base.precoVenda).length,
    semPagina: lidos.filter((p) => !p.paginaOrigem).length,
  };
}
