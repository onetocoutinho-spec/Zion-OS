// Tipos centrais do Zion OS.
// Quando o sistema for conectado ao Supabase, estes tipos viram o contrato
// entre o front e as tabelas do banco.

import type { AnuncioGerado } from "./agentes/esteira";

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

/**
 * Tipo do produto pai — determina se ele tem derivações (variantes) e como.
 * v1.7: modelagem universal de marketplace.
 */
export type TipoProduto = "simples" | "com_variacao" | "kit" | "combo" | "catalogo";

/**
 * Produto = **produto pai**. Os campos cor/tamanho/custo/precoVenda/estoque/sku
 * permanecem como atalho do "produto simples" (sem variação). Produtos com
 * variação usam `ProdutoVariante` como fonte da verdade, e esses campos ficam
 * como resumo/legado. Campos de modelagem marketplace são opcionais para não
 * quebrar dados anteriores à v1.7.
 */
export interface Produto {
  id: string;
  clienteId: string;
  /** Nome de exibição (join com clientes). */
  cliente: string;
  nome: string;
  marca: string;
  modelo: string;
  /** Categoria operacional da Zion (serve como categoria_zion). */
  categoria: string;
  sku: string;
  cor: string;
  tamanho: string;
  custo: number;
  precoVenda: number;
  estoque: number;
  marketplace: Marketplace;
  /** Status geral do produto pai (serve como status_geral). */
  statusCadastro: CadastroStatus;
  statusSeo: EtapaStatus;
  statusDescricao: EtapaStatus;
  statusImagens: EtapaStatus;
  statusPrecificacao: EtapaStatus;
  prioridade: Prioridade;
  observacoes: string;
  // ---- v1.7: modelagem marketplace (produto pai) ----
  tipoProduto?: TipoProduto;
  categoriaMarketplaceSugerida?: string;
  descricaoBase?: string;
  beneficios?: string;
  cuidados?: string;
  // ---- v1.9: alinhamento com o modelo real (ERP do cliente + precificação Zion) ----
  /**
   * SKU Pai no ERP do cliente — chave canônica entre ERP ↔ ML ↔ TikTok.
   * O ERP varia por cliente (Magazord na Chinelaria; Bling/Tiny/Linx em outros).
   */
  codErp?: string;
  /** Preço mínimo pelo piso Zion (margem mínima). */
  precoMinimo?: number;
  /** Margem % pelo modelo Zion (preço − custo − preço×0,30 − 1,15 − frete). */
  margem?: number;
  /** Confiança do custo (fonte): alta | media | baixa. */
  confiancaCusto?: "alta" | "media" | "baixa" | "";
}

export type VarianteStatus = "Ativa" | "Pausada" | "Sem estoque" | "Arquivada";

/** Derivação vendável do produto (cor + tamanho + SKU + estoque + preço…). */
export interface ProdutoVariante {
  id: string;
  produtoId: string;
  clienteId: string;
  /** Nome do produto pai (join). */
  produto?: string;
  sku: string;
  codigoInterno: string;
  ean: string;
  cor: string;
  tamanho: string;
  voltagem: string;
  sabor: string;
  aroma: string;
  modeloVariacao: string;
  custo: number;
  precoBase: number;
  estoque: number;
  peso: number; // kg
  altura: number; // cm
  largura: number; // cm
  comprimento: number; // cm
  status: VarianteStatus;
  observacoes: string;
}

export type TipoAtributo = "texto" | "numero" | "lista" | "booleano";
export type OrigemAtributo = "Manual" | "Template" | "Marketplace" | "IA";

/** Atributo dinâmico do produto (ficha técnica flexível por categoria). */
export interface ProdutoAtributo {
  id: string;
  produtoId: string;
  nomeAtributo: string;
  valorAtributo: string;
  tipoAtributo: TipoAtributo;
  obrigatorio: boolean;
  origem: OrigemAtributo;
}

/** Template operacional por categoria da Zion (o "molde" de cada nicho). */
export interface CategoriaTemplate {
  id: string;
  categoriaZion: string;
  marketplace: Marketplace | "Todos";
  nomeTemplate: string;
  descricao: string;
  camposObrigatorios: string[];
  camposRecomendados: string[];
  atributosMarketplace: string[];
  regrasVariacao: string;
  checklistCategoria: string[];
  agentesRecomendados: string[];
}

export type StatusEnvioVariante = "Não enviada" | "Enviada" | "Erro" | "Pausada";

/** Vínculo de uma derivação a um anúncio (o que foi enviado ao marketplace). */
export interface AnuncioVariante {
  id: string;
  anuncioId: string;
  produtoId: string;
  varianteId: string;
  clienteId: string;
  skuEnviado: string;
  precoEnviado: number;
  estoqueEnviado: number;
  statusEnvio: StatusEnvioVariante;
  idVariacaoMarketplace: string;
  observacoes: string;
  /** Resumo da variante (join), ex.: "Preto / 36". */
  varianteResumo?: string;
}

export type StatusMargem = "Saudável" | "Apertada" | "Negativa";

/** Precificação detalhada por derivação e marketplace. */
export interface PrecificacaoVariante {
  id: string;
  clienteId: string;
  produtoId: string;
  varianteId: string;
  marketplace: Marketplace;
  custoProduto: number;
  embalagem: number;
  impostoPercentual: number;
  taxaMarketplacePercentual: number;
  taxaFixa: number;
  comissaoGestorPercentual: number;
  outrosCustos: number;
  precoVenda: number;
  lucroBruto: number;
  lucroLiquido: number;
  margemLiquidaPercentual: number;
  precoMinimo: number;
  statusMargem: StatusMargem;
  observacoes: string;
  /** Resumo da variante (join), ex.: "Preto / 36". */
  varianteResumo?: string;
}

export type TipoImagem = "Principal" | "Secundária" | "Lifestyle" | "Infográfico" | "Vídeo";
export type ImagemStatus = "Pendente" | "Em produção" | "Aprovada" | "Publicada";

/** Imagem/vídeo por produto, variação e/ou anúncio. */
export interface ImagemProduto {
  id: string;
  clienteId: string;
  produtoId: string;
  varianteId: string | null;
  anuncioId: string | null;
  tipoImagem: TipoImagem;
  url: string;
  status: ImagemStatus;
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
  // ---- v1.7: modelagem marketplace ----
  categoriaMarketplace?: string;
  descricao?: string;
  idExternoMarketplace?: string;
  observacoes?: string;
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

// ============================================================
// v1.8 — Auditoria em massa (grandes bases de anúncios)
// Enums em snake_case (iguais ao banco); rótulos legíveis em lib/auditoria.ts.
// ============================================================

export type OrigemImportacao = "planilha" | "csv" | "api" | "manual";
export type StatusImportacao =
  | "aguardando_processamento"
  | "processando"
  | "concluida"
  | "erro"
  | "cancelada";

export interface ImportacaoAnuncios {
  id: string;
  clienteId: string;
  /** Nome de exibição (join com clientes). */
  cliente: string;
  marketplace: Marketplace;
  nomeArquivo: string;
  origem: OrigemImportacao;
  quantidadeAnuncios: number;
  quantidadeProcessada: number;
  status: StatusImportacao;
  dataImportacao: string; // ISO yyyy-mm-dd
  responsavel: string;
  observacoes: string;
}

export type PrioridadeAuditoria = "critica" | "alta" | "media" | "baixa";
export type ClassificacaoABC = "A" | "B" | "C";
export type StatusAuditoria =
  | "pendente"
  | "analisado"
  | "em_otimizacao"
  | "otimizado"
  | "ignorado"
  | "travado";

export interface AuditoriaAnuncio {
  id: string;
  importacaoId: string;
  clienteId: string;
  /** Nome de exibição (join com clientes). */
  cliente: string;
  anuncioId: string | null;
  produtoId: string | null;
  marketplace: Marketplace;
  linkAnuncio: string;
  tituloAtual: string;
  categoria: string;
  preco: number;
  estoque: number;
  vendas: number;
  visitas: number;
  conversao: number; // %
  scoreQualidade: number; // 0-100
  classificacaoAbc: ClassificacaoABC;
  prioridade: PrioridadeAuditoria;
  statusAuditoria: StatusAuditoria;
  problemasEncontrados: string;
  oportunidades: string;
  proximaAcao: string;
  agenteRecomendado: string;
  responsavel: string;
}

export type TipoProblema =
  | "titulo_ruim"
  | "descricao_incompleta"
  | "imagem_fraca"
  | "ficha_tecnica_incompleta"
  | "preco_nao_competitivo"
  | "estoque_baixo"
  | "variacao_incorreta"
  | "falta_tabela_medidas"
  | "categoria_errada"
  | "baixa_conversao"
  | "baixa_visibilidade"
  | "risco_reputacao";
export type GravidadeProblema = "critica" | "alta" | "media" | "baixa";
export type StatusProblema = "aberto" | "em_correcao" | "resolvido";

export interface ProblemaAnuncio {
  id: string;
  auditoriaId: string;
  tipoProblema: TipoProblema;
  gravidade: GravidadeProblema;
  descricao: string;
  sugestaoCorrecao: string;
  agenteRecomendado: string;
  status: StatusProblema;
}

export type TipoAcaoFila =
  | "revisar_titulo"
  | "revisar_descricao"
  | "revisar_imagens"
  | "revisar_precificacao"
  | "revisar_variacoes"
  | "revisar_categoria"
  | "criar_tabela_medidas"
  | "fazer_benchmark"
  | "revisar_compliance"
  | "otimizar_completo";
export type StatusFila =
  | "pendente"
  | "em_andamento"
  | "aguardando_aprovacao"
  | "concluido"
  | "travado"
  | "ignorado";

export interface ItemFilaOtimizacao {
  id: string;
  clienteId: string;
  /** Nome de exibição (join com clientes). */
  cliente: string;
  auditoriaId: string;
  anuncioId: string | null;
  prioridade: PrioridadeAuditoria;
  tipoAcao: TipoAcaoFila;
  agenteResponsavel: string;
  responsavelHumano: string;
  status: StatusFila;
  prazo: string; // ISO yyyy-mm-dd
  resultadoEsperado: string;
  observacoes: string;
  /** Título do anúncio auditado (join), para exibição. */
  tituloAnuncio?: string;
}

export type TipoExecucaoLote =
  | "auditoria_seo"
  | "geracao_titulo"
  | "geracao_descricao"
  | "revisao_precificacao"
  | "revisao_imagens"
  | "checklist_final"
  | "relatorio_cliente";
export type StatusExecucaoLote = "pendente" | "processando" | "concluida" | "erro";

export interface ExecucaoLote {
  id: string;
  clienteId: string;
  /** Nome de exibição (join com clientes). */
  cliente: string;
  agenteId: string | null;
  /** Nome do agente (join). */
  agente?: string;
  tipoExecucao: TipoExecucaoLote;
  quantidadeItens: number;
  status: StatusExecucaoLote;
  entradaResumo: string;
  saidaResumo: string;
  erros: string;
  responsavel: string;
}

// ============================================================
// v1.9 — Anúncios gerados pela Esteira (persistência + fila de aprovação)
// O anúncio que a esteira produz vira registro com status; a fila de
// "aprovados" é o que a publicação (Fase 2) consome.
// ============================================================

export type StatusAnuncioGerado =
  | "rascunho"
  | "aguardando_aprovacao"
  | "aprovado"
  | "rejeitado"
  | "publicado";

export interface AnuncioGeradoRegistro {
  id: string;
  clienteId: string;
  /** Nome de exibição (join com clientes). */
  cliente: string;
  produtoId: string | null;
  /** Nome do produto (join), quando vinculado. */
  produto: string | null;
  /** Auditoria de origem (esteira em lote), sem FK rígida. */
  auditoriaId: string | null;
  marketplace: Marketplace;
  origem: "esteira" | "esteira_lote";
  tipoExecucao: "IA" | "Simulada";
  notaDiagnostico: number;
  vereditoA10: "aprovado" | "reprovado";
  qtdPendencias: number;
  /** Payload completo do anúncio produzido pela esteira (JSON). */
  anuncio: AnuncioGerado;
  status: StatusAnuncioGerado;
  aprovadoPor: string;
  aprovadoEm: string | null; // ISO datetime
  criadoEm: string; // ISO datetime
  observacoes: string;
}
