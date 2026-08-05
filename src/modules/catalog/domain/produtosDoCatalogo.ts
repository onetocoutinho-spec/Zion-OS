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

/**
 * Uma variação como uma PÁGINA de catálogo consegue descrevê-la.
 *
 * Sem SKU e sem EAN de propósito: catálogo de fornecedor quase nunca traz, e
 * inventar um código é o defeito que o prompt da esteira já proíbe em voz alta
 * — "um SKU plausível e falso vira pedido que ninguém sabe despachar".
 */
export interface VariacaoLidaDoCatalogo {
  cor?: string;
  tamanho?: string;
}

/** Um produto como uma página de catálogo consegue descrevê-lo. */
export interface ProdutoLidoDoCatalogo {
  nome: string;
  marca?: string;
  modelo?: string;
  /** Onde no PDF isto foi lido. É o que permite a lojista conferir. */
  paginaOrigem?: number;
  /** Texto livre que a página trouxe (material, dimensões, montagem…). */
  descricao?: string;
  variacoes?: VariacaoLidaDoCatalogo[];
}

const texto = (v: string | undefined): string => (v ?? "").trim();

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
    texto(p.descricao) || null,
  ].filter(Boolean);
  return partes.join(" ");
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
  const linhas: LinhaProduto[] = [];

  for (const p of lidos) {
    const nome = texto(p.nome);
    if (!nome) continue;

    const variacoes: VariacaoImportada[] = (p.variacoes ?? [])
      .map((v) => ({
        sku: "",
        cor: texto(v.cor),
        tamanho: texto(v.tamanho),
        ean: "",
        // Zerados pelo mesmo motivo do produto pai: o catálogo não é fonte de
        // preço. Ver o cabeçalho deste arquivo.
        custo: 0,
        precoBase: 0,
        estoque: 0,
        idExterno: "",
      }))
      // Uma variação que não diz nem cor nem tamanho não é uma variação — é
      // ruído de layout. Ela some aqui em vez de virar uma linha vazia que a
      // lojista teria de apagar à mão.
      .filter((v) => v.cor || v.tamanho);

    linhas.push({
      base: {
        nome,
        marca: texto(p.marca),
        modelo: texto(p.modelo),
        categoria: "",
        sku: "",
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
