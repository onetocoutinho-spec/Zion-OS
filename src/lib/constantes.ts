// Listas de valores válidos usadas em filtros, formulários e validação.

import type {
  AreaAgente,
  CadastroStatus,
  ClienteStatus,
  EtapaStatus,
  Marketplace,
  Prioridade,
  RelatorioStatus,
  Risco,
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

export const RELATORIO_STATUS: RelatorioStatus[] = [
  "Pendente",
  "Em elaboração",
  "Enviado",
  "Aprovado",
];

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

export const EQUIPE = ["Camila", "Lucas", "Amanda", "Rafael"] as const;

export const PLANOS = ["Início", "Organiza", "Escala", "—"] as const;

export const IMPLANTACAO_STATUS = ["Ativo", "Em teste", "Planejado"] as const;

export const FREQUENCIAS_USO = ["Diário", "Semanal", "Quinzenal", "Sob demanda"] as const;

// ---- v1.7: modelagem de produtos marketplace ----

export const TIPOS_PRODUTO = [
  { valor: "simples", rotulo: "Simples (sem variação)" },
  { valor: "com_variacao", rotulo: "Com variação (cor, tamanho…)" },
  { valor: "kit", rotulo: "Kit" },
  { valor: "combo", rotulo: "Combo" },
  { valor: "catalogo", rotulo: "Catálogo" },
] as const;

export const VARIANTE_STATUS = ["Ativa", "Pausada", "Sem estoque", "Arquivada"] as const;

export const TIPO_ATRIBUTO = ["texto", "numero", "lista", "booleano"] as const;

export const ORIGEM_ATRIBUTO = ["Manual", "Template", "Marketplace", "IA"] as const;

export const STATUS_ENVIO_VARIANTE = ["Não enviada", "Enviada", "Erro", "Pausada"] as const;

export const STATUS_MARGEM = ["Saudável", "Apertada", "Negativa"] as const;

export const TIPO_IMAGEM = [
  "Principal",
  "Secundária",
  "Lifestyle",
  "Infográfico",
  "Vídeo",
] as const;

export const IMAGEM_STATUS = ["Pendente", "Em produção", "Aprovada", "Publicada"] as const;

/** Eixos de variação disponíveis para o gerador de grade. */
export const EIXOS_VARIACAO = [
  { chave: "cor", rotulo: "Cor" },
  { chave: "tamanho", rotulo: "Tamanho" },
  { chave: "voltagem", rotulo: "Voltagem" },
  { chave: "sabor", rotulo: "Sabor" },
  { chave: "aroma", rotulo: "Aroma" },
  { chave: "modeloVariacao", rotulo: "Modelo" },
] as const;

export type EixoVariacao = (typeof EIXOS_VARIACAO)[number]["chave"];
