// Listas de valores válidos usadas em filtros, formulários e validação.

import type {
  AreaAgente,
  CadastroStatus,
  ClienteStatus,
  EtapaStatus,
  Marketplace,
  PagamentoStatus,
  Prioridade,
  RelatorioStatus,
  Risco,
  TarefaStatus,
} from "./types";

export const MARKETPLACES: Marketplace[] = [
  "Mercado Livre",
  "TikTok Shop",
  "Shopee",
  "Amazon",
];

export const CLIENTE_STATUS: ClienteStatus[] = [
  "Lead",
  "Em proposta",
  "Onboarding",
  "Ativo",
  "Em risco",
  "Pausado",
  "Cancelado",
];

export const RISCOS: Risco[] = ["Baixo", "Médio", "Alto"];

export const PRIORIDADES: Prioridade[] = ["Baixa", "Média", "Alta", "Urgente"];

export const ETAPA_STATUS: EtapaStatus[] = ["Pendente", "Em andamento", "Concluído"];

export const CADASTRO_STATUS: CadastroStatus[] = [
  "Não iniciado",
  "Em cadastro",
  "Publicado",
  "Com erro",
];

export const PUBLICACAO_STATUS = ["Pendente", "Agendado", "Publicado"] as const;

export const TAREFA_STATUS: TarefaStatus[] = [
  "Não iniciado",
  "Em andamento",
  "Aguardando cliente",
  "Aguardando aprovação",
  "Em revisão",
  "Concluído",
  "Travado",
];

export const RELATORIO_STATUS: RelatorioStatus[] = [
  "Pendente",
  "Em elaboração",
  "Enviado",
  "Aprovado",
];

export const PAGAMENTO_STATUS: PagamentoStatus[] = ["Pago", "Pendente", "Atrasado"];

export const AREAS_AGENTE: AreaAgente[] = [
  "Agência",
  "Comercial",
  "Onboarding",
  "Mercado Livre",
  "TikTok Shop",
  "Precificação",
  "Imagens",
  "Relatórios",
  "Atendimento",
  "Performance",
  "Financeiro",
  "Processos internos",
];

export const AREAS_TAREFA = [
  "Agência",
  "Comercial",
  "Onboarding",
  "Mercado Livre",
  "TikTok Shop",
  "Shopee",
  "Amazon",
  "Anúncios",
  "Imagens",
  "Precificação",
  "Relatórios",
  "Financeiro",
] as const;

export const EQUIPE = ["Camila", "Lucas", "Amanda", "Rafael"] as const;

export const PLANOS = ["Início", "Organiza", "Escala", "—"] as const;

export const IMPLANTACAO_STATUS = ["Ativo", "Em teste", "Planejado"] as const;

export const FREQUENCIAS_USO = ["Diário", "Semanal", "Quinzenal", "Sob demanda"] as const;

export const REUNIAO_STATUS = ["Agendada", "Realizada", "Cancelada"] as const;
