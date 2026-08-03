// Métricas derivadas para o Portal do Cliente — em linguagem simples.
// A precificação vive em modules/pricing/domain/modeloPreco; aqui só se traduz
// número em status amigável (Saudável / Atenção / Risco / Prejuízo).

import {
  margemLiquida,
  classificarMargem,
  MARGEM_MINIMA_PADRAO,
} from "@/modules/pricing/domain/modeloPreco";
import type { Tone } from "@/lib/status";
import type { AuditoriaAnuncio, AnuncioGeradoRegistro, Produto } from "@/lib/types";

export type SaudeMargem = "Saudável" | "Atenção" | "Risco" | "Prejuízo" | "—";

/** A cor de cada status. Separada para quem já tem o status calculado. */
export function toneSaudeMargem(status: SaudeMargem): Tone {
  if (status === "Prejuízo") return "red";
  if (status === "Risco") return "orange";
  if (status === "Atenção") return "yellow";
  if (status === "Saudável") return "green";
  return "gray";
}

/**
 * Classifica a margem de um produto contra o piso do LOJISTA.
 *
 * `margemMinima` é opcional e cai no padrão para as chamadas que ainda não
 * têm a escolha do cliente em mãos — nunca fica sem piso, o que faria toda
 * margem parecer saudável.
 */
export function saudeMargem(
  produto: Pick<Produto, "custo" | "precoVenda">,
  margemMinima: number = MARGEM_MINIMA_PADRAO
): { margem: number | null; status: SaudeMargem; tone: Tone } {
  const { custo, precoVenda } = produto;
  if (!precoVenda || precoVenda <= 0 || !custo || custo <= 0)
    return { margem: null, status: "—", tone: "gray" };
  const margem = margemLiquida(custo, precoVenda);
  const status = classificarMargem(margem, margemMinima);
  return { margem, status, tone: toneSaudeMargem(status) };
}

/**
 * Score de IA por produto: usa a nota do anúncio gerado mais recente; se não
 * houver, cai para o score de qualidade da auditoria daquele produto.
 *
 * O parâmetro pede os TRÊS campos que ele lê, não o registro inteiro. Pedir o
 * registro obrigava quem chama a carregar o JSONB da esteira — 76,6% do peso da
 * linha — para calcular uma média de notas. Assinatura larga demais é o que faz
 * uma tela de lista pagar o preço de uma tela de detalhe.
 */
export function mapaScorePorProduto(
  anuncios: readonly Pick<
    AnuncioGeradoRegistro,
    "produtoId" | "notaDiagnostico" | "criadoEm"
  >[],
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
