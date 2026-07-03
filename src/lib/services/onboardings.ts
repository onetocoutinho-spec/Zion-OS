// Serviço de Onboarding.
// No Supabase, o checklist vive na tabela onboarding_items (uma linha por
// item); no app continua sendo um Record — o mapeamento acontece aqui.

import { CHECKLIST_ONBOARDING, checklistVazio, statusGeralOnboarding } from "../onboarding";
import { getSupabase, supabaseConfigurado } from "../supabase/client";
import {
  createItem,
  getById,
  listAll,
  notificarMudanca,
  updateItem,
} from "../store";
import type { OnboardingRow } from "../supabase/database.types";
import type {
  ChecklistStatus,
  Onboarding,
  OnboardingItemKey,
  OnboardingStatus,
} from "../types";
import { atualizarCliente, buscarCliente } from "./clientes";

const SELECAO = "*, clientes(empresa), onboarding_items(id, onboarding_id, chave, status)";

function paraApp(row: OnboardingRow): Onboarding {
  const itens = checklistVazio();
  for (const item of row.onboarding_items ?? []) {
    if (item.chave in itens) {
      itens[item.chave as OnboardingItemKey] = item.status as ChecklistStatus;
    }
  }
  return {
    id: row.id,
    clienteId: row.cliente_id,
    cliente: row.clientes?.empresa ?? "—",
    itens,
    pendenciasCliente: row.pendencias_cliente ?? [],
    observacoes: row.observacoes ?? "",
  };
}

function erro(acao: string, mensagem: string): never {
  throw new Error(`[Zion OS] Erro ao ${acao} no Supabase: ${mensagem}`);
}

export async function listarOnboardings(): Promise<Onboarding[]> {
  if (!supabaseConfigurado) return listAll<Onboarding>("onboardings");
  const { data, error } = await getSupabase()
    .from("onboardings")
    .select(SELECAO)
    .order("created_at", { ascending: false });
  if (error) erro("listar onboardings", error.message);
  return ((data ?? []) as OnboardingRow[]).map(paraApp);
}

export async function buscarOnboarding(id: string): Promise<Onboarding | null> {
  if (!supabaseConfigurado) return getById<Onboarding>("onboardings", id) ?? null;
  const { data, error } = await getSupabase()
    .from("onboardings")
    .select(SELECAO)
    .eq("id", id)
    .maybeSingle();
  if (error) erro("buscar onboarding", error.message);
  return data ? paraApp(data as OnboardingRow) : null;
}

export async function buscarOnboardingDoCliente(
  clienteId: string
): Promise<Onboarding | null> {
  if (!supabaseConfigurado) {
    return (
      listAll<Onboarding>("onboardings").find((o) => o.clienteId === clienteId) ?? null
    );
  }
  const { data, error } = await getSupabase()
    .from("onboardings")
    .select(SELECAO)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (error) erro("buscar onboarding do cliente", error.message);
  return data ? paraApp(data as OnboardingRow) : null;
}

export async function criarOnboarding(
  clienteId: string,
  cliente: string
): Promise<Onboarding> {
  if (!supabaseConfigurado) {
    return createItem<Onboarding>(
      "onboardings",
      { clienteId, cliente, itens: checklistVazio(), pendenciasCliente: [], observacoes: "" },
      "onb"
    );
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("onboardings")
    .insert({ cliente_id: clienteId })
    .select("id")
    .single();
  if (error) erro("criar onboarding", error.message);

  const itens = CHECKLIST_ONBOARDING.map((i) => ({
    onboarding_id: data.id,
    chave: i.key,
    status: "Pendente",
  }));
  const { error: erroItens } = await sb.from("onboarding_items").insert(itens);
  if (erroItens) erro("criar itens do onboarding", erroItens.message);

  notificarMudanca();
  const criado = await buscarOnboarding(data.id);
  if (!criado) erro("criar onboarding", "registro não encontrado após inserção");
  return criado;
}

/** Atualiza pendências/observações do onboarding (não os itens do checklist). */
export async function atualizarOnboarding(
  id: string,
  dados: Partial<Pick<Onboarding, "pendenciasCliente" | "observacoes">>
): Promise<Onboarding | null> {
  if (!supabaseConfigurado) return updateItem<Onboarding>("onboardings", id, dados);
  const r: Record<string, unknown> = {};
  if (dados.pendenciasCliente !== undefined) r.pendencias_cliente = dados.pendenciasCliente;
  if (dados.observacoes !== undefined) r.observacoes = dados.observacoes;
  const { error } = await getSupabase().from("onboardings").update(r).eq("id", id);
  if (error) erro("atualizar onboarding", error.message);
  notificarMudanca();
  return buscarOnboarding(id);
}

/**
 * Atualiza um item do checklist e reflete o status geral no cliente:
 * onboarding concluído → cliente "Ativo"; em andamento/travado → "Onboarding".
 */
export async function atualizarItemOnboarding(
  id: string,
  item: OnboardingItemKey,
  status: ChecklistStatus
): Promise<Onboarding | null> {
  let atualizado: Onboarding | null;

  if (!supabaseConfigurado) {
    const atual = getById<Onboarding>("onboardings", id);
    if (!atual) return null;
    atualizado = updateItem<Onboarding>("onboardings", id, {
      itens: { ...atual.itens, [item]: status },
    });
  } else {
    const { error } = await getSupabase()
      .from("onboarding_items")
      .upsert(
        { onboarding_id: id, chave: item, status },
        { onConflict: "onboarding_id,chave" }
      );
    if (error) erro("atualizar item do onboarding", error.message);
    notificarMudanca();
    atualizado = await buscarOnboarding(id);
  }

  if (atualizado) await recalcularStatusOnboarding(atualizado);
  return atualizado;
}

/**
 * Deriva o status geral do checklist e sincroniza o status do cliente.
 * Aceita o objeto já carregado ou o id do onboarding.
 */
export async function recalcularStatusOnboarding(
  onboarding: Onboarding | string
): Promise<OnboardingStatus | null> {
  const o =
    typeof onboarding === "string" ? await buscarOnboarding(onboarding) : onboarding;
  if (!o) return null;

  const statusGeral = statusGeralOnboarding(o);
  const cliente = await buscarCliente(o.clienteId);
  if (cliente) {
    if (statusGeral === "Concluído" && cliente.status !== "Ativo") {
      await atualizarCliente(o.clienteId, { status: "Ativo" });
    } else if (
      (statusGeral === "Em andamento" || statusGeral === "Travado") &&
      cliente.status !== "Onboarding" &&
      cliente.status !== "Em risco"
    ) {
      await atualizarCliente(o.clienteId, { status: "Onboarding" });
    }
  }
  return statusGeral;
}
