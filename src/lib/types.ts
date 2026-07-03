// Tipos centrais do Zion OS.
// Quando o sistema for conectado ao Supabase, estes tipos viram o contrato
// entre o front e as tabelas do banco.

export type Marketplace = "Mercado Livre" | "TikTok Shop" | "Shopee" | "Amazon";

export type ClienteStatus =
  | "Lead"
  | "Em proposta"
  | "Onboarding"
  | "Ativo"
  | "Em risco"
  | "Pausado"
  | "Cancelado";

export type Risco = "Baixo" | "Médio" | "Alto";

export type Prioridade = "Baixa" | "Média" | "Alta" | "Urgente";

/** Status de uma etapa de trabalho (SEO, descrição, imagens etc.) */
export type EtapaStatus = "Pendente" | "Em andamento" | "Concluído";

export interface Cliente {
  id: string;
  empresa: string;
  responsavel: string;
  segmento: string;
  marketplaces: Marketplace[];
  plano: string;
  status: ClienteStatus;
  dataEntrada: string; // ISO yyyy-mm-dd
  proximaReuniao: string | null;
  proximaAcao: string;
  risco: Risco;
  observacoes: string;
}

export type OnboardingStatus = "Não iniciado" | "Em andamento" | "Concluído" | "Travado";

export interface Onboarding {
  id: string;
  cliente: string;
  statusGeral: OnboardingStatus;
  contratoFechado: boolean;
  acessosRecebidos: string[];
  acessosPendentes: string[];
  baseProdutosRecebida: boolean;
  diagnosticoInicial: EtapaStatus;
  reuniaoInicial: EtapaStatus;
  pastasCriadas: boolean;
  planoTrintaDias: EtapaStatus;
  pendenciasCliente: string[];
}

export type CadastroStatus = "Não iniciado" | "Em cadastro" | "Publicado" | "Com erro";

export interface Produto {
  id: string;
  cliente: string;
  nome: string;
  marca: string;
  modelo: string;
  categoria: string;
  sku: string;
  cor: string;
  tamanho: string;
  custo: number;
  precoVenda: number;
  estoque: number;
  marketplace: Marketplace;
  statusCadastro: CadastroStatus;
  statusSeo: EtapaStatus;
  statusDescricao: EtapaStatus;
  statusImagens: EtapaStatus;
  statusPrecificacao: EtapaStatus;
  prioridade: Prioridade;
  observacoes: string;
}

export interface Anuncio {
  id: string;
  cliente: string;
  produto: string;
  marketplace: Marketplace;
  link: string;
  tituloAtual: string;
  tituloOtimizado: string;
  statusSeo: EtapaStatus;
  statusDescricao: EtapaStatus;
  statusImagens: EtapaStatus;
  statusPrecificacao: EtapaStatus;
  statusConcorrencia: EtapaStatus;
  statusRevisao: EtapaStatus;
  statusPublicacao: "Pendente" | "Agendado" | "Publicado";
  proximaAcao: string;
  responsavel: string;
}

export type AreaAgente =
  | "Agência"
  | "Comercial"
  | "Onboarding"
  | "Mercado Livre"
  | "TikTok Shop"
  | "Precificação"
  | "Imagens"
  | "Relatórios"
  | "Atendimento"
  | "Performance"
  | "Financeiro"
  | "Processos internos";

export interface AgenteIA {
  id: string;
  nome: string;
  area: AreaAgente;
  objetivo: string;
  quandoUsar: string;
  entradaNecessaria: string;
  saidaEsperada: string;
  promptResumido: string;
  statusImplantacao: "Ativo" | "Em teste" | "Planejado";
  frequenciaUso: "Diário" | "Semanal" | "Quinzenal" | "Sob demanda";
  agentesConectados: string[];
}

export type TarefaStatus =
  | "Não iniciado"
  | "Em andamento"
  | "Aguardando cliente"
  | "Aguardando aprovação"
  | "Em revisão"
  | "Concluído"
  | "Travado";

export interface Tarefa {
  id: string;
  cliente: string;
  area: string;
  tarefa: string;
  responsavel: string;
  prioridade: Prioridade;
  status: TarefaStatus;
  prazo: string; // ISO yyyy-mm-dd
  agenteRelacionado: string | null;
  proximaAcao: string;
  observacoes: string;
}

export type RelatorioStatus = "Pendente" | "Em elaboração" | "Enviado" | "Aprovado";

export interface Relatorio {
  id: string;
  cliente: string;
  periodo: string;
  oQueFoiFeito: string;
  produtosTrabalhados: number;
  anunciosRevisados: number;
  problemasEncontrados: string;
  oportunidades: string;
  pendencias: string;
  proximasAcoes: string;
  status: RelatorioStatus;
}

export type PagamentoStatus = "Pago" | "Pendente" | "Atrasado";

export interface RegistroFinanceiro {
  id: string;
  cliente: string;
  plano: string;
  valorMensal: number;
  dataVencimento: string; // ISO yyyy-mm-dd
  statusPagamento: PagamentoStatus;
  servicosExtras: string;
  custoOperacional: number;
  lucroEstimado: number;
  observacoes: string;
}
