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
  clientes?: { empresa: string } | null;
  produtos?: { nome: string } | null;
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
  agentes?: { nome: string } | null;
}
