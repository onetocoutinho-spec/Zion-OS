// Os custos do lojista — leitura e escrita.
//
// A regra do cálculo vive no núcleo puro (modules/pricing/domain/custosDoLojista).
// Aqui só existe o acesso ao banco, pelas funções security definer da migração
// 033: o cliente não toca a tabela `clientes` direto, e as funções expõem
// exatamente estes sete campos — nunca plano, status, risco ou limite.

import { getSupabase, supabaseConfigurado } from "../supabase/client";
import { argumentoDaLoja } from "../contexto/lojaEmOperacao";
import {
  normalizarCustos,
  SEM_CUSTOS_DO_LOJISTA,
  type CustosDoLojista,
} from "../../modules/pricing/domain/custosDoLojista";

/**
 * Os custos que o lojista informou.
 *
 * Diante de qualquer falha devolve tudo zero — que é o comportamento de quem
 * ainda não preencheu, e faz a conta sair igual à de antes. É o padrão SEGURO
 * aqui: um custo inventado por causa de erro de rede apareceria como margem
 * menor e mandaria o lojista subir preço sem motivo.
 */
export async function custosDoLojista(clienteId?: string | null): Promise<CustosDoLojista> {
  if (!supabaseConfigurado) return SEM_CUSTOS_DO_LOJISTA;
  try {
    const { data, error } = await getSupabase().rpc("portal_custos_do_lojista", argumentoDaLoja(clienteId));
    if (error || data == null) return SEM_CUSTOS_DO_LOJISTA;
    return normalizarCustos(data as Partial<CustosDoLojista>);
  } catch {
    return SEM_CUSTOS_DO_LOJISTA;
  }
}

/**
 * Grava os custos informados.
 *
 * Normaliza ANTES de enviar: o banco tem a mesma guarda (constraint de faixa),
 * mas depender só dela transformaria um dedo escorregando num erro de SQL cru
 * na cara do lojista. Aqui o valor absurdo vira zero e ele vê o campo zerado.
 */
export async function definirCustosDoLojista(
  bruto: Partial<CustosDoLojista>
): Promise<CustosDoLojista> {
  const c = normalizarCustos(bruto);
  if (!supabaseConfigurado) return c; // demo: aceita sem persistir
  const { error } = await getSupabase().rpc("portal_definir_custos_do_lojista", {
    ...argumentoDaLoja(),
    p_embalagem: c.embalagem,
    p_etiqueta: c.etiqueta,
    p_informativos: c.informativos,
    p_imposto: c.impostoPercentual,
    p_gestor: c.comissaoGestorPercentual,
    p_sistema: c.comissaoSistemaPercentual,
    p_cupom: c.cupomPercentual,
  });
  if (error) throw new Error(error.message || "Não foi possível salvar seus custos.");
  return c;
}
