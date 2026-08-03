// A margem mínima do lojista — leitura e escrita.
//
// A regra do cálculo vive no núcleo puro (modules/pricing/domain/modeloPreco).
// Aqui só existe o acesso ao banco, pelas funções security definer da migração
// 029: o cliente não toca a tabela `clientes` direto, e a função expõe
// exatamente um campo.

import { getSupabase, supabaseConfigurado } from "../supabase/client";
import {
  MARGEM_MINIMA_PADRAO,
  margemValida,
} from "../../modules/pricing/domain/modeloPreco.ts";

/**
 * A margem escolhida pelo lojista, em %.
 *
 * Sem Supabase (modo demo) ou diante de qualquer falha, devolve o padrão. Nunca
 * devolve null: um piso ausente viraria "sem piso", e a tela passaria a chamar
 * de saudável uma margem que o lojista considera risco.
 */
export async function margemMinimaDoCliente(): Promise<number> {
  return (await margemMinimaComOrigem()).margem;
}

/**
 * A margem E DE ONDE ELA VEIO.
 *
 * `margemMinimaDoCliente` devolve o padrão em qualquer falha — o que é a
 * decisão certa (piso ausente viraria "sem piso") e apaga uma diferença que
 * importa: **"ela escolheu 5%"** e **"assumimos 5% por ela"** produzem o mesmo
 * número e não a mesma frase.
 *
 * Auditado em 03/08/2026 (AUD-001): a tela chamava de "Saudável" uma margem
 * medida contra um piso que a lojista nunca viu. O número continua igual; o que
 * muda é a tela poder dizer isso.
 */
export async function margemMinimaComOrigem(): Promise<{
  margem: number;
  /** `true` só quando o valor veio do banco. Falha e ausência são `false`. */
  escolhida: boolean;
}> {
  if (!supabaseConfigurado) return { margem: MARGEM_MINIMA_PADRAO, escolhida: false };
  try {
    const { data, error } = await getSupabase().rpc("portal_margem_minima");
    if (error || data == null) return { margem: MARGEM_MINIMA_PADRAO, escolhida: false };
    const n = Number(data);
    return Number.isFinite(n)
      ? { margem: n, escolhida: true }
      : { margem: MARGEM_MINIMA_PADRAO, escolhida: false };
  } catch {
    return { margem: MARGEM_MINIMA_PADRAO, escolhida: false };
  }
}

/**
 * Grava a margem escolhida e devolve o valor EFETIVAMENTE gravado — não o que
 * foi enviado. Se o banco recusar, quem chamou fica sabendo pelo erro, nunca
 * por um sucesso silencioso.
 */
export async function definirMargemMinima(margem: number): Promise<number> {
  if (!margemValida(margem)) {
    throw new Error("Margem fora da faixa permitida (0% a 60%).");
  }
  if (!supabaseConfigurado) return margem; // demo: aceita sem persistir
  const { data, error } = await getSupabase().rpc("portal_definir_margem_minima", {
    nova: margem,
  });
  if (error) throw new Error(error.message || "Não foi possível salvar a margem mínima.");
  const n = Number(data);
  return Number.isFinite(n) ? n : margem;
}
