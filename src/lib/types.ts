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

/** Status de um item do checklist de onboarding. */
export type ChecklistStatus = "Pendente" | "Em andamento" | "Concluído" | "Travado";

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

/** Chaves dos 14 itens do checklist de onboarding (rótulos em lib/onboarding.ts). */
export type OnboardingItemKey =
  | "contratoFechado"
  | "boasVindas"
  | "acessosML"
  | "acessosTikTok"
  | "acessosShopee"
  | "acessoERP"
  | "baseProdutos"
  | "pastaCriada"
  | "diagnosticoIniciado"
  | "diagnosticoConcluido"
  | "reuniaoInicial"
  | "plano30Dias"
  | "primeirasTarefas"
  | "clienteLiberado";

export interface Onboarding {
  id: string;
  clienteId: string;
  /** Nome de exibição (join com clientes). */
  cliente: string;
  itens: Record<OnboardingItemKey, ChecklistStatus>;
  pendenciasCliente: string[];
  observacoes: string;
}

export type CadastroStatus = "Não iniciado" | "Em cadastro" | "Publicado" | "Com erro";

export interface Produto {
  id: string;
  clienteId: string;
  /** Nome de exibição (join com clientes). */
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
  clienteId: string;
  /** Nome de exibição (join com clientes). */
  cliente: string;
  produtoId: string;
  /** Nome de exibição (join com produtos). */
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
  clienteId: string;
  /** Nome de exibição (join com clientes). */
  cliente: string;
  produtoId: string | null;
  /** Produto vinculado (nome de exibição), quando fizer sentido. */
  produto: string | null;
  anuncioId: string | null;
  /** Anúncio vinculado (nome do produto do anúncio), quando fizer sentido. */
  anuncio: string | null;
  agenteId: string | null;
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
  clienteId: string;
  /** Nome de exibição (join com clientes). */
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

export type ReuniaoStatus = "Agendada" | "Realizada" | "Cancelada";

export interface Reuniao {
  id: string;
  clienteId: string;
  /** Nome de exibição (join com clientes). */
  cliente: string;
  titulo: string;
  dataHora: string | null; // ISO datetime
  pauta: string;
  status: ReuniaoStatus;
}

export interface Pendencia {
  id: string;
  clienteId: string;
  /** Nome de exibição (join com clientes). */
  cliente: string;
  tarefaId: string | null;
  /** Descrição da tarefa vinculada (join com tarefas), se houver. */
  tarefa: string | null;
  descricao: string;
  resolvida: boolean;
}

/** Registro do histórico de execuções de agentes (reais via IA ou simuladas). */
export interface ExecucaoAgente {
  id: string;
  agenteId: string;
  agente: string;
  dataHora: string; // ISO datetime
  contexto: string;
  resultado: string;
  tipo: "IA" | "Simulada";
}

export interface RegistroFinanceiro {
  id: string;
  clienteId: string;
  /** Nome de exibição (join com clientes). */
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
