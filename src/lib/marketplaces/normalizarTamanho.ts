// Normalizador de tamanho de calçado — PURO, determinístico e idempotente.
//
// Problema que resolve: os tamanhos das variações vieram "sujos" do Mercado
// Livre ("38 BR", "33 - 34", "Nº 39", "34 ao 39"). No modelo User Products a
// publicação junta a variação à linha da guia de tamanhos por STRING
// (mlUserProducts.ts → rowIdPorTamanho[v.tamanho]). Se a variação disser
// "38 BR" e a guia disser "38", o join falha, o item vai sem SIZE_GRID_ROW_ID
// e o ML rejeita. Esta função produz o MESMO token canônico dos dois lados.
//
// Regra do Blueprint (L05 — nada é inventado): quando o valor é ambíguo (uma
// FAIXA de tamanhos como "33-38", ou algo não numérico), a função NÃO chuta —
// devolve ok:false com o motivo, para o chamador tratar como pendência.
//
// Escopo: tamanhos numéricos de calçado, incluindo PARES adjacentes de chinelo
// ("33/34"). Tamanhos por letra (P/M/G) estão fora do escopo desta tarefa e
// caem em ok:false ("revisar manualmente"), nunca num palpite.

export interface TamanhoNormalizado {
  /** true quando produziu um token canônico confiável. */
  readonly ok: boolean;
  /** token canônico (ex.: "38", "33/34") quando ok; "" caso contrário. */
  readonly valor: string;
  /** a entrada original, apenas com trim — sempre preservada. */
  readonly original: string;
  /** por que não foi possível normalizar (somente quando !ok). */
  readonly motivo?: string;
}

function sucesso(valor: string, original: string): TamanhoNormalizado {
  return { ok: true, valor, original };
}

function falha(motivo: string, original: string): TamanhoNormalizado {
  return { ok: false, valor: "", original, motivo };
}

/** Canoniza um único número: "38"→"38", "08"→"8", "37,5"→"37.5", "38.0"→"38". */
function canonizarNumero(token: string): string {
  const norm = token.replace(",", ".");
  if (norm.includes(".")) {
    const f = parseFloat(norm);
    return Number.isInteger(f) ? String(f) : String(f);
  }
  return String(parseInt(norm, 10));
}

/**
 * Normaliza um tamanho de calçado para um token canônico.
 * Idempotente: normalizarTamanho(normalizarTamanho(x).valor).valor === valor.
 */
export function normalizarTamanho(bruto: string | number | null | undefined): TamanhoNormalizado {
  const original = String(bruto ?? "").trim();
  if (!original) return falha("vazio", original);

  // Remove ruído de localidade/rótulo, preservando dígitos e separadores.
  const limpo = original
    .toUpperCase()
    .replace(/\bBR(A|ASIL)?\b/g, " ") // "38 BR", "38 BRASIL"
    .replace(/\bTAMANHOS?\b/g, " ")
    .replace(/\bTAM\b/g, " ")
    .replace(/\bN[º°O]?\b/g, " ") // "Nº 39", "N 39", "NO 39"
    .replace(/\bAO?\b/g, " ") // "34 A 39", "34 AO 39" (vira dois números)
    .replace(/\bE\b/g, " ") // "33 E 34"
    .replace(/#/g, " ")
    .trim();

  const numeros = limpo.match(/\d+(?:[.,]\d+)?/g) ?? [];

  if (numeros.length === 0) {
    return falha("tamanho não numérico — revisar manualmente", original);
  }

  if (numeros.length === 1) {
    return sucesso(canonizarNumero(numeros[0]), original);
  }

  if (numeros.length === 2) {
    // Pares só fazem sentido entre inteiros adjacentes (chinelo "33/34").
    const decimal = numeros.some((n) => n.includes(".") || n.includes(","));
    if (decimal) return falha("tamanho ambíguo", original);

    const a = parseInt(numeros[0], 10);
    const b = parseInt(numeros[1], 10);
    if (a === b) return sucesso(String(a), original);

    const min = Math.min(a, b);
    const max = Math.max(a, b);
    if (max - min === 1) return sucesso(`${min}/${max}`, original);

    return falha("faixa de tamanhos (não é um tamanho único)", original);
  }

  return falha("tamanho ambíguo", original);
}
