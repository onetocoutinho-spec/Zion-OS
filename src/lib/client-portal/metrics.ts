// Métricas derivadas para o Portal do Cliente — em linguagem simples.
// Reaproveita a precificação Zion (margemZion / precoMinimoZion) e traduz
// números em status amigáveis (Saudável / Atenção / Risco / Prejuízo).

import { margemZion } from "@/lib/services/importacaoProdutos";
import type { Tone } from "@/lib/status";
import type { AuditoriaAnuncio, AnuncioGeradoRegistro, Produto } from "@/lib/types";

export type SaudeMargem = "Saudável" | "Atenção" | "Risco" | "Prejuízo" | "—";

/** Classifica a margem Zion (em %) num status de saúde com cor. */
export function saudeMargem(
  produto: Pick<Produto, "custo" | "precoVenda">
): { margem: number | null; status: SaudeMargem; tone: Tone } {
  const { custo, precoVenda } = produto;
  if (!precoVenda || precoVenda <= 0 || !custo || custo <= 0)
    return { margem: null, status: "—", tone: "gray" };
  const margem = margemZion(custo, precoVenda); // %
  if (margem < 0) return { margem, status: "Prejuízo", tone: "red" };
  if (margem < 10) return { margem, status: "Risco", tone: "orange" };
  if (margem < 20) return { margem, status: "Atenção", tone: "yellow" };
  return { margem, status: "Saudável", tone: "green" };
}

/**
 * Score de IA por produto: usa a nota do anúncio gerado mais recente; se não
 * houver, cai para o score de qualidade da auditoria daquele produto.
 */
export function mapaScorePorProduto(
  anuncios: AnuncioGeradoRegistro[],
  auditorias: AuditoriaAnuncio[]
): Map<string, number> {
  const mapa = new Map<string, number>();
  [...anuncios]
    .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
    .forEach((a) => {
      if (a.produtoId && a.notaDiagnostico > 0 && !mapa.has(a.produtoId))
        mapa.set(a.produtoId, a.notaDiagnostico);
    });
  auditorias.forEach((au) => {
    if (au.produtoId && !mapa.has(au.produtoId) && au.scoreQualidade > 0)
      mapa.set(au.produtoId, au.scoreQualidade);
  });
  return mapa;
}

/** Faixa de score → cor. */
export function toneScore(score: number | null): Tone {
  if (score == null) return "gray";
  if (score >= 70) return "green";
  if (score >= 40) return "yellow";
  return "red";
}
