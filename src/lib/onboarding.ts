import { ChecklistStatus, Onboarding, OnboardingItemKey, OnboardingStatus } from "./types";

/** Itens do checklist de onboarding, na ordem do fluxo operacional. */
export const CHECKLIST_ONBOARDING: { key: OnboardingItemKey; label: string }[] = [
  { key: "contratoFechado", label: "Contrato fechado" },
  { key: "boasVindas", label: "Boas-vindas enviadas" },
  { key: "acessosML", label: "Acessos Mercado Livre recebidos" },
  { key: "acessosTikTok", label: "Acessos TikTok Shop recebidos" },
  { key: "acessosShopee", label: "Acessos Shopee recebidos" },
  { key: "acessoERP", label: "Acesso ERP recebido" },
  { key: "baseProdutos", label: "Base de produtos recebida" },
  { key: "pastaCriada", label: "Pasta do cliente criada" },
  { key: "diagnosticoIniciado", label: "Diagnóstico inicial iniciado" },
  { key: "diagnosticoConcluido", label: "Diagnóstico inicial concluído" },
  { key: "reuniaoInicial", label: "Reunião inicial marcada" },
  { key: "plano30Dias", label: "Plano de 30 dias criado" },
  { key: "primeirasTarefas", label: "Primeiras tarefas criadas" },
  { key: "clienteLiberado", label: "Cliente liberado para operação" },
];

export const CHECKLIST_STATUS: ChecklistStatus[] = [
  "Pendente",
  "Em andamento",
  "Concluído",
  "Travado",
];

/** Cria um checklist zerado (todos os itens pendentes). */
export function checklistVazio(): Record<OnboardingItemKey, ChecklistStatus> {
  return Object.fromEntries(
    CHECKLIST_ONBOARDING.map((i) => [i.key, "Pendente"])
  ) as Record<OnboardingItemKey, ChecklistStatus>;
}

/** Deriva o status geral do onboarding a partir dos itens do checklist. */
export function statusGeralOnboarding(o: Onboarding): OnboardingStatus {
  const valores = Object.values(o.itens);
  if (valores.some((v) => v === "Travado")) return "Travado";
  if (valores.every((v) => v === "Concluído")) return "Concluído";
  if (valores.some((v) => v !== "Pendente")) return "Em andamento";
  return "Não iniciado";
}

/** Percentual de itens concluídos, para a barra de progresso. */
export function progressoOnboarding(o: Onboarding): number {
  const valores = Object.values(o.itens);
  const done = valores.filter((v) => v === "Concluído").length;
  return Math.round((done / valores.length) * 100);
}
