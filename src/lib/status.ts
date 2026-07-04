// Mapeia qualquer status/prioridade do sistema para um tom de cor do Badge.

export type Tone =
  | "green"
  | "yellow"
  | "red"
  | "blue"
  | "violet"
  | "orange"
  | "cyan"
  | "gray";

const TONE_MAP: Record<string, Tone> = {
  // Clientes
  Lead: "cyan",
  "Em proposta": "blue",
  Onboarding: "violet",
  Ativo: "green",
  "Em risco": "red",
  Pausado: "orange",
  Cancelado: "gray",
  // Etapas / onboarding / tarefas
  Pendente: "yellow",
  "Em andamento": "blue",
  Concluído: "green",
  "Não iniciado": "gray",
  Travado: "red",
  "Aguardando cliente": "orange",
  "Aguardando aprovação": "yellow",
  "Em revisão": "violet",
  // Cadastro de produtos
  "Em cadastro": "blue",
  Publicado: "green",
  "Com erro": "red",
  Agendado: "cyan",
  // Agentes
  "Em teste": "yellow",
  Planejado: "gray",
  IA: "violet",
  Simulada: "gray",
  // Relatórios
  "Em elaboração": "blue",
  Enviado: "cyan",
  Aprovado: "green",
  // Financeiro
  Pago: "green",
  Atrasado: "red",
  // Reuniões
  Agendada: "cyan",
  Realizada: "green",
  Cancelada: "gray",
  // Pendências
  Aberta: "yellow",
  Resolvida: "green",
  // Prioridade
  Baixa: "gray",
  Média: "blue",
  Alta: "orange",
  Urgente: "red",
  // Risco
  Baixo: "green",
  Médio: "yellow",
  Alto: "red",
  // v1.7 — variantes / envio / margem / imagens
  Ativa: "green",
  Pausada: "orange",
  "Sem estoque": "red",
  Arquivada: "gray",
  "Não enviada": "gray",
  Enviada: "green",
  Erro: "red",
  Saudável: "green",
  Apertada: "yellow",
  Negativa: "red",
  "Em produção": "blue",
  Aprovada: "green",
  Publicada: "cyan",
  Principal: "violet",
  Secundária: "gray",
  Lifestyle: "cyan",
  Infográfico: "blue",
  Vídeo: "orange",
  // v1.8 — Auditoria em Massa
  "Aguardando processamento": "yellow",
  Processando: "blue",
  Concluída: "green",
  Analisado: "blue",
  "Em otimização": "violet",
  Otimizado: "green",
  Ignorado: "gray",
  Crítica: "red",
  Aberto: "yellow",
  "Em correção": "blue",
  Resolvido: "green",
};

export function toneFor(status: string): Tone {
  return TONE_MAP[status] ?? "gray";
}
