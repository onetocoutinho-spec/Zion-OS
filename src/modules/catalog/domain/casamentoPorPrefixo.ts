// O CÓDIGO DA PLANILHA É O SEU SKU SEM O TAMANHO? — puro, e só PERGUNTA.
//
// ===========================================================================
// O CASO QUE PRODUZIU ISTO
// ===========================================================================
//
// Medido em 17/08/2026 no `TABELA CUSTOS LINX.CSV` da lojista, contra a base
// real:
//
//   · o LINX identifica o item por `CODIGO` de SEIS dígitos — "006427";
//   · o SKU da variação no Zion é esse código MAIS o número do calçado —
//     "00642743", "00642645";
//   · a importação compara SKU por igualdade, então nada casava;
//   · dos 24 produtos sem custo, 26 de 26 prefixos EXISTIAM no arquivo.
//
// O dado estava inteiro dos dois lados e o casamento não acontecia por causa de
// dois dígitos. É a mesma família de defeito que este repo já fechou no frete e
// no leitor de planilha: o dado existe, o leitor não alcança.
//
// ===========================================================================
// POR QUE ISTO NÃO CASA NADA SOZINHO
// ===========================================================================
//
// "Tira os dois últimos dígitos" é uma convenção do ERP DELA, não uma verdade
// sobre SKUs. Um cliente futuro com SKU de oito dígitos e outro significado
// receberia custo errado — em silêncio, e custo errado é pior que custo
// ausente, porque a tela passa a mostrar margem com confiança.
//
// Então este módulo não casa: ele MEDE quantas variações o prefixo alcançaria e
// devolve exemplos. Quem decide é a lojista, na tela de conferência, olhando
// para o próprio catálogo — que é a mesma razão de `ConferirPlanilha` existir.

/** Uma variação do catálogo, reduzida ao que decide o casamento. */
export interface VarianteParaCasar {
  sku: string;
  produtoId: string;
}

export interface CasamentoPorPrefixo {
  /** Quantos dígitos sobram no fim do SKU depois do código da planilha. */
  sufixo: number;
  /** Variações que passariam a casar, e que hoje NÃO casam. */
  variantes: number;
  /** Produtos distintos alcançados. */
  produtos: number;
  /** Códigos da planilha que encontraram alguém. */
  codigos: number;
  /** Para a tela mostrar o padrão em vez de afirmá-lo. */
  exemplos: { daPlanilha: string; doCatalogo: string }[];
}

const EXEMPLOS = 3;

/**
 * O MÍNIMO DE EVIDÊNCIA PARA SEQUER OFERECER.
 *
 * Um acerto isolado é coincidência: com 1.462 códigos de seis dígitos, algum
 * vai ser prefixo de algum SKU por acaso. Dois produtos distintos com várias
 * variações cada é padrão — e é o que o arquivo da lojista mostra (10 produtos,
 * 26 códigos).
 */
const MINIMO_DE_VARIANTES = 3;
const MINIMO_DE_PRODUTOS = 2;

/** Só dígitos, e curto: o que sobra tem que caber num número de calçado. */
const SUFIXOS_POSSIVEIS = [2, 1] as const;

const so = (s: string) => (s ?? "").trim().toLowerCase();

/**
 * O padrão existe nesta planilha e neste catálogo? Devolve `null` quando não.
 *
 * `codigosDaPlanilha` são os valores da coluna que a pessoa marcou como SKU.
 * Só interessam as variações que HOJE não casam — oferecer o prefixo para quem
 * já casa por igualdade seria oferecer trabalho que não muda nada.
 */
export function acharCasamentoPorPrefixo(
  codigosDaPlanilha: readonly string[],
  variantes: readonly VarianteParaCasar[]
): CasamentoPorPrefixo | null {
  const codigos = new Set<string>();
  for (const c of codigosDaPlanilha) {
    const k = so(c);
    if (k) codigos.add(k);
  }
  if (codigos.size === 0) return null;

  let melhor: CasamentoPorPrefixo | null = null;

  for (const sufixo of SUFIXOS_POSSIVEIS) {
    const produtos = new Set<string>();
    const usados = new Set<string>();
    const exemplos: { daPlanilha: string; doCatalogo: string }[] = [];
    let variantesQueCasam = 0;

    for (const v of variantes) {
      const sku = so(v.sku);
      if (sku.length <= sufixo) continue;
      // Já casa por igualdade: o prefixo não acrescenta nada e contá-lo
      // inflaria o número que a lojista usa para decidir.
      if (codigos.has(sku)) continue;
      const cauda = sku.slice(-sufixo);
      if (!/^\d+$/.test(cauda)) continue;
      const raiz = sku.slice(0, -sufixo);
      if (!codigos.has(raiz)) continue;

      variantesQueCasam++;
      produtos.add(v.produtoId);
      usados.add(raiz);
      if (exemplos.length < EXEMPLOS) exemplos.push({ daPlanilha: raiz, doCatalogo: sku });
    }

    if (variantesQueCasam < MINIMO_DE_VARIANTES || produtos.size < MINIMO_DE_PRODUTOS) continue;
    const achado: CasamentoPorPrefixo = {
      sufixo,
      variantes: variantesQueCasam,
      produtos: produtos.size,
      codigos: usados.size,
      exemplos,
    };
    // O sufixo que alcança MAIS variações ganha. Empate fica com o primeiro da
    // lista (2), que é o formato medido — número de calçado tem dois dígitos.
    if (!melhor || achado.variantes > melhor.variantes) melhor = achado;
  }

  return melhor;
}

/**
 * A frase que a tela mostra. Do domínio, e não da tela, porque ela carrega os
 * números que sustentam a decisão — e número redigido na tela é número que
 * diverge do que a gravação faz.
 */
export function fraseDoCasamento(a: CasamentoPorPrefixo): string {
  const [ex] = a.exemplos;
  return (
    `Os códigos desta planilha parecem ser os seus SKUs sem os ${a.sufixo} últimos dígitos — ` +
    `no seu cadastro esses dígitos são o tamanho. ` +
    (ex ? `Por exemplo: "${ex.daPlanilha}" na planilha, "${ex.doCatalogo}" no seu catálogo. ` : "") +
    `Casando assim, ${a.codigos} código(s) alcançam ${a.variantes} variação(ões) ` +
    `em ${a.produtos} produto(s) que hoje não casam por nada.`
  );
}
