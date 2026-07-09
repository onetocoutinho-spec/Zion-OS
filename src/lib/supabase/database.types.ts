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
  clientes?: { empresa: string } | null;
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
