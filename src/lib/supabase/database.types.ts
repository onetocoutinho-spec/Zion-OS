// Tipos das linhas do banco Supabase (snake_case), incluindo os campos
// embutidos pelos joins do PostgREST (ex.: clientes(empresa)).
//
// Escritos à mão na v1.2 para manter o projeto simples. Futuramente podem
// ser gerados via CLI: `supabase gen types typescript` (ver README).

export interface ClienteRow {
  id: string;
  empresa: string;
  responsavel: string | null;
  segmento: string | null;
  marketplaces: string[] | null;
  plano: string | null;
  status: string;
  data_entrada: string | null;
  proxima_reuniao: string | null;
  proxima_acao: string | null;
  risco: string;
  observacoes: string | null;
}

export interface OnboardingRow {
  id: string;
  cliente_id: string;
  pendencias_cliente: string[] | null;
  observacoes: string | null;
  clientes?: { empresa: string } | null;
  onboarding_items?: OnboardingItemRow[] | null;
}

export interface OnboardingItemRow {
  id: string;
  onboarding_id: string;
  chave: string;
  status: string;
}

export interface ProdutoRow {
  id: string;
  cliente_id: string;
  nome: string;
  marca: string | null;
  modelo: string | null;
  categoria: string | null;
  sku: string | null;
  cor: string | null;
  tamanho: string | null;
  custo: number | null;
  preco_venda: number | null;
  estoque: number | null;
  marketplace: string | null;
  status_cadastro: string;
  status_seo: string;
  status_descricao: string;
  status_imagens: string;
  status_precificacao: string;
  prioridade: string;
  observacoes: string | null;
  // v1.7 (ausentes em bancos anteriores — rodar a migração 001)
  tipo_produto?: string | null;
  categoria_marketplace_sugerida?: string | null;
  descricao_base?: string | null;
  beneficios?: string | null;
  cuidados?: string | null;
  // v1.9 (rodar a migração 003)
  cod_erp?: string | null;
  preco_minimo?: number | null;
  margem?: number | null;
  confianca_custo?: string | null;
  tabela_medidas?: string | null;
  componentes?: { produtoId?: string; nome: string; sku?: string; quantidade: number; brinde?: boolean }[] | null;
  clientes?: { empresa: string } | null;
}

export interface TabelaMedidaRow {
  id: string;
  cliente_id: string;
  nome: string | null;
  marca: string | null;
  como_medir: string | null;
  linhas: { rotulo: string; valor: string }[] | null;
}

export interface AnuncioRow {
  id: string;
  cliente_id: string;
  produto_id: string;
  marketplace: string | null;
  link: string | null;
  titulo_atual: string | null;
  titulo_otimizado: string | null;
  status_seo: string;
  status_descricao: string;
  status_imagens: string;
  status_precificacao: string;
  status_concorrencia: string;
  status_revisao: string;
  status_publicacao: string;
  proxima_acao: string | null;
  responsavel: string | null;
  // v1.7
  categoria_marketplace?: string | null;
  descricao?: string | null;
  id_externo_marketplace?: string | null;
  observacoes?: string | null;
  clientes?: { empresa: string } | null;
  produtos?: { nome: string } | null;
}

export interface ProdutoVarianteRow {
  id: string;
  produto_id: string;
  cliente_id: string;
  sku: string | null;
  codigo_interno: string | null;
  ean: string | null;
  cor: string | null;
  tamanho: string | null;
  voltagem: string | null;
  sabor: string | null;
  aroma: string | null;
  modelo_variacao: string | null;
  custo: number | null;
  preco_base: number | null;
  estoque: number | null;
  peso: number | null;
  altura: number | null;
  largura: number | null;
  comprimento: number | null;
  status: string;
  observacoes: string | null;
  produtos?: { nome: string } | null;
}

export interface ProdutoAtributoRow {
  id: string;
  produto_id: string;
  /** NOT NULL desde a 049 — o escopo de cliente que faltava a esta tabela. */
  cliente_id: string;
  nome_atributo: string;
  valor_atributo: string | null;
  tipo_atributo: string;
  obrigatorio: boolean;
  origem: string;
}

export interface CategoriaTemplateRow {
  id: string;
  categoria_zion: string;
  marketplace: string;
  nome_template: string;
  descricao: string | null;
  campos_obrigatorios: string[] | null;
  campos_recomendados: string[] | null;
  atributos_marketplace: string[] | null;
  regras_variacao: string | null;
  checklist_categoria: string[] | null;
  agentes_recomendados: string[] | null;
}

export interface AnuncioVarianteRow {
  id: string;
  anuncio_id: string;
  produto_id: string;
  variante_id: string;
  cliente_id: string;
  sku_enviado: string | null;
  preco_enviado: number | null;
  estoque_enviado: number | null;
  status_envio: string;
  id_variacao_marketplace: string | null;
  observacoes: string | null;
  produto_variantes?: { cor: string | null; tamanho: string | null; voltagem: string | null; sabor: string | null; aroma: string | null; modelo_variacao: string | null } | null;
}

export interface PrecificacaoVarianteRow {
  id: string;
  cliente_id: string;
  produto_id: string;
  variante_id: string;
  marketplace: string;
  custo_produto: number | null;
  embalagem: number | null;
  imposto_percentual: number | null;
  taxa_marketplace_percentual: number | null;
  taxa_fixa: number | null;
  comissao_gestor_percentual: number | null;
  outros_custos: number | null;
  preco_venda: number | null;
  lucro_bruto: number | null;
  lucro_liquido: number | null;
  margem_liquida_percentual: number | null;
  preco_minimo: number | null;
  status_margem: string;
  observacoes: string | null;
  produto_variantes?: { cor: string | null; tamanho: string | null; voltagem: string | null; sabor: string | null; aroma: string | null; modelo_variacao: string | null } | null;
}

export interface ImagemProdutoRow {
  id: string;
  cliente_id: string;
  produto_id: string;
  variante_id: string | null;
  anuncio_id: string | null;
  tipo_imagem: string;
  url: string | null;
  status: string;
  observacoes: string | null;
}

// ---- v1.8: Auditoria em massa ----

export interface ImportacaoAnunciosRow {
  id: string;
  cliente_id: string;
  marketplace: string | null;
  nome_arquivo: string | null;
  origem: string;
  quantidade_anuncios: number | null;
  quantidade_processada: number | null;
  status: string;
  data_importacao: string | null;
  responsavel: string | null;
  observacoes: string | null;
  clientes?: { empresa: string } | null;
}

export interface AuditoriaAnuncioRow {
  id: string;
  importacao_id: string;
  cliente_id: string;
  anuncio_id: string | null;
  produto_id: string | null;
  marketplace: string | null;
  link_anuncio: string | null;
  titulo_atual: string | null;
  categoria: string | null;
  preco: number | null;
  estoque: number | null;
  vendas: number | null;
  visitas: number | null;
  conversao: number | null;
  score_qualidade: number | null;
  classificacao_abc: string;
  prioridade: string;
  status_auditoria: string;
  problemas_encontrados: string | null;
  oportunidades: string | null;
  proxima_acao: string | null;
  agente_recomendado: string | null;
  responsavel: string | null;
  clientes?: { empresa: string } | null;
}

export interface ProblemaAnuncioRow {
  id: string;
  auditoria_id: string;
  tipo_problema: string;
  gravidade: string;
  descricao: string | null;
  sugestao_correcao: string | null;
  agente_recomendado: string | null;
  status: string;
}

export interface FilaOtimizacaoRow {
  id: string;
  cliente_id: string;
  auditoria_id: string;
  anuncio_id: string | null;
  prioridade: string;
  tipo_acao: string;
  agente_responsavel: string | null;
  responsavel_humano: string | null;
  status: string;
  prazo: string | null;
  resultado_esperado: string | null;
  observacoes: string | null;
  clientes?: { empresa: string } | null;
  auditorias_anuncios?: { titulo_atual: string | null } | null;
}

export interface ExecucaoLoteRow {
  id: string;
  cliente_id: string;
  agente_id: string | null;
  tipo_execucao: string;
  quantidade_itens: number | null;
  status: string;
  entrada_resumo: string | null;
  saida_resumo: string | null;
  erros: string | null;
  responsavel: string | null;
  clientes?: { empresa: string } | null;
  agentes?: { nome: string } | null;
}

export interface AgenteRow {
  id: string;
  nome: string;
  area: string;
  objetivo: string | null;
  quando_usar: string | null;
  entrada_necessaria: string | null;
  saida_esperada: string | null;
  prompt_resumido: string | null;
  status_implantacao: string;
  frequencia_uso: string;
  agentes_conectados: string[] | null;
}

export interface TarefaRow {
  id: string;
  cliente_id: string;
  produto_id: string | null;
  anuncio_id: string | null;
  agente_id: string | null;
  area: string | null;
  tarefa: string;
  responsavel: string | null;
  prioridade: string;
  status: string;
  prazo: string | null;
  proxima_acao: string | null;
  observacoes: string | null;
  clientes?: { empresa: string } | null;
  produtos?: { nome: string } | null;
  anuncios?: { produtos: { nome: string } | null } | null;
  agentes?: { nome: string } | null;
}

export interface RelatorioRow {
  id: string;
  cliente_id: string;
  periodo: string;
  o_que_foi_feito: string | null;
  produtos_trabalhados: number | null;
  anuncios_revisados: number | null;
  problemas_encontrados: string | null;
  oportunidades: string | null;
  pendencias: string | null;
  proximas_acoes: string | null;
  status: string;
  clientes?: { empresa: string } | null;
}

export interface FinanceiroRow {
  id: string;
  cliente_id: string;
  plano: string | null;
  valor_mensal: number | null;
  data_vencimento: string | null;
  status_pagamento: string;
  servicos_extras: string | null;
  custo_operacional: number | null;
  lucro_estimado: number | null;
  observacoes: string | null;
  clientes?: { empresa: string } | null;
}

export interface ExecucaoRow {
  id: string;
  agente_id: string;
  data_hora: string;
  contexto: string | null;
  resultado: string | null;
  /** Ausente em bancos criados antes da v1.4 (rodar a migração). */
  tipo?: string | null;
  agentes?: { nome: string } | null;
}

export interface ReuniaoRow {
  id: string;
  cliente_id: string;
  titulo: string;
  data_hora: string | null;
  pauta: string | null;
  status: string;
  clientes?: { empresa: string } | null;
}

export interface PendenciaRow {
  id: string;
  cliente_id: string;
  tarefa_id: string | null;
  descricao: string;
  resolvida: boolean;
  clientes?: { empresa: string } | null;
  tarefas?: { tarefa: string } | null;
}

// ---- v1.9: Anúncios gerados pela Esteira (rodar a migração 004) ----

export interface AnuncioGeradoRow {
  id: string;
  cliente_id: string;
  produto_id: string | null;
  auditoria_id: string | null;
  marketplace: string | null;
  origem: string | null;
  tipo_execucao: string | null;
  nota_diagnostico: number | null;
  veredito_a10: string | null;
  qtd_pendencias: number | null;
  anuncio: unknown; // jsonb com o payload completo da esteira
  status: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  observacoes: string | null;
  ml_item_id?: string | null;
  ml_permalink?: string | null;
  created_at?: string;
  clientes?: { empresa: string } | null;
  produtos?: { nome: string } | null;
}

// ---- Decision Journal (AIL) — rodar a migração 022 ----
// Linha da tabela `decisoes` (log append-only). A identidade (id) nasce no
// DOMÍNIO e é preservada via Repository.salvar() (contrato R-INF-001).
// `decidido_em` = Decision.timestamp (domínio); `created_at` = instante de
// persistência (infra) — created_at NUNCA representa a decisão de negócio.

export interface DecisaoRow {
  id: string;
  empresa: string;
  autor: string;
  contexto: string;
  entidade_tipo: string;
  entidade_id: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string;
  origem: string;
  decidido_em: string;
  correlacao: string | null;
  metadados: Record<string, unknown> | null;
  created_at?: string;
}

// ---- Pattern Detector (AIL) — rodar a migração 023 ----
// Linha da tabela `padroes` (projeção materializada do Decision Journal).
// `id` = PatternId (SHA-256 da PatternKey canônica — identidade nasce no
// domínio, preservada via Repository.salvar()). `pattern_key` armazena a
// chave canônica textual para explicabilidade. `updated_at` é controlado
// pela APLICAÇÃO (sem trigger).

// ---- Knowledge Maturation (AIL, ADR-002) — rodar a migração 027 ----
// Linha da tabela `conhecimentos` (fatos append-only de maturação).
export interface ConhecimentoRow {
  id: string;
  pattern_id: string;
  empresa: string;
  contexto: string;
  campo: string;
  valor: string;
  tipo: string; // 'promocao' | 'rebaixamento'
  versao: number;
  autor_humano: string;
  motivo: string;
  fotografia: Record<string, unknown>;
  versao_politica: string;
  ocorrido_em: string;
  created_at?: string;
}

// ---- Delegation Runtime (AIL, E5.10b) — rodar a migração 028 ----
// Linha da tabela `delegacoes` (fatos append-only de concessão/revogação).
export interface DelegacaoRow {
  id: string;
  empresa: string;
  contexto: string;
  campo: string;
  knowledge_pattern_id: string;
  knowledge_versao: number;
  valor_delegado: string;
  tipo: string; // 'concessao' | 'revogacao'
  delegado_por: string;
  motivo: string;
  assinatura: Record<string, unknown>;
  evidencias: Record<string, unknown>;
  ocorrido_em: string;
  created_at?: string;
}

// ---- Registro de Ofertas (AIL, ADR-001) — rodar a migração 025 ----
// Linha da tabela `ofertas` (log append-only de sugestões apresentadas).
export interface OfertaRow {
  id: string;
  empresa: string;
  contexto: string;
  campo: string;
  entidade_tipo: string | null;
  entidade_id: string | null;
  pattern_id: string;
  valor_oferecido: string;
  confidence_utilizada: string;
  ocorrencias_no_momento: number;
  autor_da_oferta: string;
  versao_contrato: string;
  origem_explicacao: string;
  // Assinatura versionada (migração 026 — E5.9): null = oferta pré-versionamento.
  versao_engine: string | null;
  versao_confidence: string | null;
  versao_explainability: string | null;
  correlacao: string | null;
  oferecida_em: string;
  created_at?: string;
}

export interface PadraoRow {
  id: string;
  pattern_key: string;
  empresa: string;
  contexto: string;
  campo: string;
  valor: string;
  ocorrencias: number;
  confidence: string;
  estado: string;
  estado_slot: string;
  primeira_ocorrencia: string;
  ultima_ocorrencia: string;
  decisoes_de_suporte: string[];
  created_at?: string;
  updated_at?: string;
}
