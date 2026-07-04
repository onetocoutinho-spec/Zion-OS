// Lógica pura da Auditoria em Massa (v1.8): cálculo de score de qualidade,
// classificação ABC, priorização e rótulos legíveis dos enums (que no banco
// são snake_case). Sem dependências de rede — fácil de testar e reutilizar.

import type {
  ClassificacaoABC,
  GravidadeProblema,
  OrigemImportacao,
  PrioridadeAuditoria,
  StatusAuditoria,
  StatusExecucaoLote,
  StatusFila,
  StatusImportacao,
  StatusProblema,
  TipoAcaoFila,
  TipoExecucaoLote,
  TipoProblema,
} from "./types";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// ---- Score de qualidade (0 a 100) ----

export interface SinaisQualidade {
  tituloOtimizado: boolean;
  descricaoCompleta: boolean;
  imagensAdequadas: boolean;
  fichaTecnicaCompleta: boolean;
  precoCompetitivo: boolean;
  estoqueDisponivel: boolean;
  variacoesCorretas: boolean;
  tabelaMedidasAplicavel: boolean;
  tabelaMedidas: boolean;
  conversao: number; // %
  visitas: number;
}

/**
 * Score 0–100. 8 fatores booleanos somam até 70 pontos; conversão até 18;
 * visitas até 12. Quando a tabela de medidas não se aplica, o ponto é ganho.
 */
export function calcularScore(s: SinaisQualidade): number {
  const fatores: [boolean, number][] = [
    [s.tituloOtimizado, 12],
    [s.descricaoCompleta, 10],
    [s.imagensAdequadas, 12],
    [s.fichaTecnicaCompleta, 10],
    [s.precoCompetitivo, 10],
    [s.estoqueDisponivel, 6],
    [s.variacoesCorretas, 6],
    [!s.tabelaMedidasAplicavel || s.tabelaMedidas, 4],
  ];
  let score = fatores.reduce((acc, [ok, peso]) => acc + (ok ? peso : 0), 0); // máx 70
  score += Math.min(18, (Math.max(0, s.conversao) / 4) * 18); // conversão
  score += Math.min(12, (Math.max(0, s.visitas) / 300) * 12); // visitas
  return Math.round(clamp(score, 0, 100));
}

// ---- Classificação ABC (curva de valor) ----

/**
 * A = alto valor (campeões de venda / receita), C = cauda longa.
 * Considera vendas e receita estimada (preço × vendas).
 */
export function classificarABC(vendas: number, receitaEstimada: number): ClassificacaoABC {
  if (receitaEstimada >= 3000 || vendas >= 40) return "A";
  if (receitaEstimada >= 800 || vendas >= 12) return "B";
  return "C";
}

// ---- Priorização (valor × potencial de melhoria) ----

/**
 * Prioriza anúncios de alto valor com score baixo — onde a otimização gera
 * mais retorno. Anúncio A ruim é crítico; anúncio C bom é baixa prioridade.
 */
export function classificarPrioridade(
  score: number,
  abc: ClassificacaoABC
): PrioridadeAuditoria {
  if (abc === "A" && score < 60) return "critica";
  if ((abc === "A" && score < 80) || (abc === "B" && score < 55) || score < 45) return "alta";
  if (score < 70) return "media";
  return "baixa";
}

// ---- Rótulos legíveis (banco em snake_case → UI em português) ----

export const ROTULO_ORIGEM: Record<OrigemImportacao, string> = {
  planilha: "Planilha",
  csv: "CSV",
  api: "API",
  manual: "Manual",
};

export const ROTULO_STATUS_IMPORTACAO: Record<StatusImportacao, string> = {
  aguardando_processamento: "Aguardando processamento",
  processando: "Processando",
  concluida: "Concluída",
  erro: "Erro",
  cancelada: "Cancelada",
};

export const ROTULO_PRIORIDADE: Record<PrioridadeAuditoria, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const ROTULO_STATUS_AUDITORIA: Record<StatusAuditoria, string> = {
  pendente: "Pendente",
  analisado: "Analisado",
  em_otimizacao: "Em otimização",
  otimizado: "Otimizado",
  ignorado: "Ignorado",
  travado: "Travado",
};

export const ROTULO_GRAVIDADE: Record<GravidadeProblema, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const ROTULO_STATUS_PROBLEMA: Record<StatusProblema, string> = {
  aberto: "Aberto",
  em_correcao: "Em correção",
  resolvido: "Resolvido",
};

export const ROTULO_TIPO_PROBLEMA: Record<TipoProblema, string> = {
  titulo_ruim: "Título ruim",
  descricao_incompleta: "Descrição incompleta",
  imagem_fraca: "Imagem fraca",
  ficha_tecnica_incompleta: "Ficha técnica incompleta",
  preco_nao_competitivo: "Preço não competitivo",
  estoque_baixo: "Estoque baixo",
  variacao_incorreta: "Variação incorreta",
  falta_tabela_medidas: "Falta tabela de medidas",
  categoria_errada: "Categoria errada",
  baixa_conversao: "Baixa conversão",
  baixa_visibilidade: "Baixa visibilidade",
  risco_reputacao: "Risco à reputação",
};

export const ROTULO_TIPO_ACAO: Record<TipoAcaoFila, string> = {
  revisar_titulo: "Revisar título",
  revisar_descricao: "Revisar descrição",
  revisar_imagens: "Revisar imagens",
  revisar_precificacao: "Revisar precificação",
  revisar_variacoes: "Revisar variações",
  revisar_categoria: "Revisar categoria",
  criar_tabela_medidas: "Criar tabela de medidas",
  fazer_benchmark: "Fazer benchmark",
  revisar_compliance: "Revisar compliance",
  otimizar_completo: "Otimização completa",
};

export const ROTULO_STATUS_FILA: Record<StatusFila, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  aguardando_aprovacao: "Aguardando aprovação",
  concluido: "Concluído",
  travado: "Travado",
  ignorado: "Ignorado",
};

export const ROTULO_TIPO_EXECUCAO: Record<TipoExecucaoLote, string> = {
  auditoria_seo: "Auditoria de SEO",
  geracao_titulo: "Geração de títulos",
  geracao_descricao: "Geração de descrições",
  revisao_precificacao: "Revisão de precificação",
  revisao_imagens: "Revisão de imagens",
  checklist_final: "Checklist final",
  relatorio_cliente: "Relatório do cliente",
};

export const ROTULO_STATUS_EXECUCAO: Record<StatusExecucaoLote, string> = {
  pendente: "Pendente",
  processando: "Processando",
  concluida: "Concluída",
  erro: "Erro",
};

/** Agente recomendado por tipo de problema (nomes dos agentes da central). */
export const AGENTE_POR_PROBLEMA: Record<TipoProblema, string> = {
  titulo_ruim: "Zion SEO ML",
  descricao_incompleta: "Zion SEO ML",
  imagem_fraca: "Zion Imagens por Variação",
  ficha_tecnica_incompleta: "Zion Atributos por Categoria",
  preco_nao_competitivo: "Zion Precificação por Derivação",
  estoque_baixo: "Zion Variações e SKUs",
  variacao_incorreta: "Zion Variações e SKUs",
  falta_tabela_medidas: "Zion Atributos por Categoria",
  categoria_errada: "Zion Checklist por Categoria",
  baixa_conversao: "Zion Concorrência",
  baixa_visibilidade: "Zion Diagnóstico ML",
  risco_reputacao: "Zion Diagnóstico ML",
};
