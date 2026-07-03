import { checklistVazio, statusGeralOnboarding } from "../onboarding";
import { createItem, getById, listAll, updateItem } from "../store";
import type { ChecklistStatus, Onboarding, OnboardingItemKey } from "../types";
import { listarClientes, atualizarCliente } from "./clientes";

export async function listarOnboardings(): Promise<Onboarding[]> {
  return listAll<Onboarding>("onboardings");
}

export async function buscarOnboarding(id: string): Promise<Onboarding | null> {
  return getById<Onboarding>("onboardings", id) ?? null;
}

export async function buscarOnboardingDoCliente(
  cliente: string
): Promise<Onboarding | null> {
  return listAll<Onboarding>("onboardings").find((o) => o.cliente === cliente) ?? null;
}

export async function criarOnboarding(cliente: string): Promise<Onboarding> {
  return createItem<Onboarding>(
    "onboardings",
    { cliente, itens: checklistVazio(), pendenciasCliente: [], observacoes: "" },
    "onb"
  );
}

export async function atualizarOnboarding(
  id: string,
  dados: Partial<Onboarding>
): Promise<Onboarding | null> {
  return updateItem<Onboarding>("onboardings", id, dados);
}

/**
 * Atualiza um item do checklist e reflete o status geral no cliente:
 * onboarding concluído → cliente "Ativo"; em andamento → cliente "Onboarding".
 */
export async function atualizarItemOnboarding(
  id: string,
  item: OnboardingItemKey,
  status: ChecklistStatus
): Promise<Onboarding | null> {
  const atual = getById<Onboarding>("onboardings", id);
  if (!atual) return null;

  const atualizado = updateItem<Onboarding>("onboardings", id, {
    itens: { ...atual.itens, [item]: status },
  });

  if (atualizado) {
    const statusGeral = statusGeralOnboarding(atualizado);
    const cliente = (await listarClientes()).find(
      (c) => c.empresa === atualizado.cliente
    );
    if (cliente) {
      if (statusGeral === "Concluído" && cliente.status !== "Ativo") {
        await atualizarCliente(cliente.id, { status: "Ativo" });
      } else if (
        (statusGeral === "Em andamento" || statusGeral === "Travado") &&
        cliente.status !== "Onboarding" &&
        cliente.status !== "Em risco"
      ) {
        await atualizarCliente(cliente.id, { status: "Onboarding" });
      }
    }
  }

  return atualizado;
}
