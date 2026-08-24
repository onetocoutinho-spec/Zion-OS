// A GRADE NO MARKETPLACE — quanto da grade de um produto está comprável hoje.
//
// ===========================================================================
// POR QUE ISTO PRECISOU EXISTIR
// ===========================================================================
//
// A lojista disse: "as variações da Papete Modare não estão agrupadas". A
// medição em produção (24/08/2026) mostrou o formato do problema, e ele não é
// o que a frase sugere:
//
//   Papete Slide Modare 7208.101 · 16 anúncios no ML · 1 ativo
//   Chinelo Havaianas Slim Liso  · 41 anúncios no ML · 1 ativo
//   Chinelo Havaianas Top Liso   · 40 anúncios no ML · 3 ativos
//
// Em categoria de CALÇADO o Mercado Livre não aceita um anúncio com
// `variations[]`: cada numeração é um anúncio próprio, agrupado por família
// (o caminho User Products, ver `mlUserProducts.ts`). Ou seja, 16 anúncios
// para 16 numerações é o formato CERTO. O defeito é outro, e é pior:
// **quinze das dezesseis numerações não estão no ar.** Quem procura o 37
// não encontra a loja.
//
// Este módulo mede isso: a COBERTURA da grade — quanto do que existe está
// comprável — e o que está bloqueando o resto.
//
// ===========================================================================
// O QUE ESTE MÓDULO NÃO AFIRMA
// ===========================================================================
//
// 1. **Não diz se o ML agrupou.** O vínculo de família (`family_id`,
//    `user_product_id`) chega na importação e NÃO é guardado em
//    `anuncios_gerados` — conferido no banco em 24/08/2026: o jsonb `anuncio`
//    não tem nenhuma chave de família. Sem esse dado, afirmar "estão
//    agrupados" ou "não estão" seria chute. O módulo declara a lacuna.
//
// 2. **Não acusa duplicidade.** Dois produtos com a mesma referência podem ser
//    materiais diferentes do mesmo modelo — "7208.101 NOBUCK" e "7208.101 MICR
//    PERF SUPREM" existem no catálogo e provavelmente são produtos legítimos.
//    O módulo os aponta para CONFERÊNCIA, com a palavra "confira", nunca com a
//    palavra "duplicado".
//
// Puro.

import type { LinhaDaFila } from "./filaDeCorrecao";

/** Abaixo desta fração da grade no ar, o produto está perdendo venda. */
export const COBERTURA_BAIXA = 0.5;
/** Um produto com menos anúncios que isto não tem "grade" para avaliar. */
export const MINIMO_PARA_GRADE = 3;

export type SituacaoDaGrade =
  /** Tudo que existe está no ar. */
  | "completa"
  /** Parte no ar, parte fora — e a parte fora é grande. */
  | "partida"
  /** Um único anúncio no ar entre muitos. O caso mais caro. */
  | "so_um_no_ar"
  /** Nada no ar. O produto sumiu do marketplace. */
  | "fora_do_ar"
  /** Não medimos o estado de nenhum. Não é "fora do ar". */
  | "sem_leitura";

export interface GradeDoProduto {
  produtoId: string | null;
  produto: string;
  /** Anúncios deste produto no marketplace. */
  anuncios: number;
  ativos: number;
  fora: number;
  semLeitura: number;
  /** `ativos / (anuncios - semLeitura)`. `null` quando nada foi medido. */
  cobertura: number | null;
  /**
   * A MESMA cobertura, em porcentagem inteira — 6, não 0,0625.
   *
   * Existe porque a fração vazou crua para a tela em 24/08/2026: o Copilot
   * escreveu "Cobertura (percentual de anúncios no ar): 0.0625". Quem lê aquilo
   * como porcentagem entende 0,06% — cem vezes menor que os 6% reais.
   *
   * A conversão poderia ficar por conta do modelo, e é exatamente por isso que
   * ela não fica: número que a lojista lê sai do domínio na forma em que deve
   * ser lido. O mesmo motivo de nenhum número deste projeto passar pelo modelo.
   */
  coberturaPercentual: number | null;
  situacao: SituacaoDaGrade;
  /** O que mais bloqueia, na palavra do ML, do maior para o menor. */
  motivos: { motivo: string; quantos: number }[];
}

/** O que o módulo NÃO sabe, dito por extenso. */
export const LACUNA_DA_FAMILIA =
  "Não sei se estes anúncios estão agrupados numa família no Mercado Livre: o Zion recebe o vínculo de família na importação e não o guarda. Sem ele, dizer que estão ou que não estão agrupados seria chute.";

function situacaoDaGrade(anuncios: number, ativos: number, medidos: number): SituacaoDaGrade {
  if (medidos === 0) return "sem_leitura";
  if (ativos === 0) return "fora_do_ar";
  if (ativos === medidos) return "completa";
  if (ativos === 1 && anuncios >= MINIMO_PARA_GRADE) return "so_um_no_ar";
  return ativos / medidos < COBERTURA_BAIXA ? "partida" : "completa";
}

/**
 * A grade de cada produto, do mais quebrado para o mais inteiro.
 *
 * A ordem é por PREJUÍZO, não por nome: quantos anúncios estão fora do ar.
 * Um produto com 40 numerações paradas custa mais que um com duas.
 */
export function gradesDosProdutos(linhas: readonly LinhaDaFila[]): GradeDoProduto[] {
  const porProduto = new Map<string, LinhaDaFila[]>();
  for (const l of linhas) {
    if (!l.mlItemId) continue;
    // Anúncio sem produto vinculado não some: vira o próprio grupo, nomeado.
    const chave = l.produtoId ?? `sem-produto:${l.produto ?? l.mlItemId}`;
    const g = porProduto.get(chave);
    if (g) g.push(l);
    else porProduto.set(chave, [l]);
  }

  const grades: GradeDoProduto[] = [];
  for (const doProduto of porProduto.values()) {
    let ativos = 0;
    let semLeitura = 0;
    const motivos = new Map<string, number>();
    for (const l of doProduto) {
      const estado = (l.statusMarketplace ?? "").trim().toLowerCase();
      if (!estado) {
        semLeitura += 1;
        continue;
      }
      if (estado === "active") {
        ativos += 1;
        continue;
      }
      for (const m of new Set((l.subStatusMarketplace ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean))) {
        motivos.set(m, (motivos.get(m) ?? 0) + 1);
      }
    }
    const medidos = doProduto.length - semLeitura;
    grades.push({
      produtoId: doProduto[0].produtoId,
      produto: doProduto[0].produto ?? "(sem produto vinculado)",
      anuncios: doProduto.length,
      ativos,
      fora: medidos - ativos,
      semLeitura,
      // Sobre os MEDIDOS: incluir os não medidos faria a cobertura mentir
      // para baixo, e "não sei" viraria "está ruim".
      cobertura: medidos > 0 ? ativos / medidos : null,
      // Arredonda, e nunca para zero quando há ALGUM anúncio no ar: "0%" com um
      // anúncio vivo é falso, e é o tipo de falso que faz a pessoa desistir do
      // produto. 1 de 16 vira 6%; 1 de 300 vira 1%, não 0%.
      coberturaPercentual:
        medidos > 0 ? (ativos > 0 ? Math.max(1, Math.round((ativos / medidos) * 100)) : 0) : null,
      situacao: situacaoDaGrade(doProduto.length, ativos, medidos),
      motivos: [...motivos.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([motivo, quantos]) => ({ motivo, quantos })),
    });
  }

  return grades.sort((a, b) => b.fora - a.fora || b.anuncios - a.anuncios || a.produto.localeCompare(b.produto));
}

// ---------------------------------------------------------------------------
// REFERÊNCIAS REPETIDAS — para CONFERIR, nunca para acusar
// ---------------------------------------------------------------------------

export interface ProdutoComModelo {
  id: string;
  nome: string;
  modelo: string | null;
}

export interface ReferenciaRepetida {
  referencia: string;
  produtos: { id: string; nome: string; modelo: string }[];
}

/**
 * A referência do fabricante dentro do modelo — o primeiro pedaço antes do
 * espaço. "7208.101 NOBUCK" → "7208.101".
 *
 * É HEURÍSTICA, e é por isso que o resultado se chama "confira" e não
 * "duplicado": o campo é texto livre e a loja escreve como quer.
 */
export function referenciaDoModelo(modelo: string | null | undefined): string | null {
  const bruto = (modelo ?? "").trim();
  if (!bruto) return null;
  const primeiro = bruto.split(/\s+/)[0];
  // Só vale como referência se tiver dígito: "PELE" não é referência.
  return /\d/.test(primeiro) ? primeiro.toUpperCase() : null;
}

/**
 * Produtos que compartilham a mesma referência de fabricante.
 *
 * Pode ser duplicidade de cadastro — e pode ser o mesmo modelo em dois
 * materiais, que é legítimo. Quem decide é quem olha.
 */
export function referenciasRepetidas(produtos: readonly ProdutoComModelo[]): ReferenciaRepetida[] {
  const porReferencia = new Map<string, { id: string; nome: string; modelo: string }[]>();
  for (const p of produtos) {
    const ref = referenciaDoModelo(p.modelo);
    if (!ref) continue;
    const item = { id: p.id, nome: p.nome, modelo: (p.modelo ?? "").trim() };
    const g = porReferencia.get(ref);
    if (g) g.push(item);
    else porReferencia.set(ref, [item]);
  }
  return [...porReferencia.entries()]
    .filter(([, ps]) => ps.length > 1)
    .map(([referencia, produtos]) => ({
      referencia,
      produtos: [...produtos].sort((a, b) => a.nome.localeCompare(b.nome)),
    }))
    .sort((a, b) => b.produtos.length - a.produtos.length || a.referencia.localeCompare(b.referencia));
}
