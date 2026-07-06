// Importação real de base de anúncios (CSV/planilha) → auditorias.
//
// Lê o arquivo, reconhece as colunas (com aliases tolerantes a acento/caixa),
// deriva os sinais de qualidade de cada anúncio, calcula score/ABC/prioridade
// e monta as auditorias + problemas. Faz preview (analisar) e gravação em lote
// (confirmar). Funciona no Supabase e no modo local.

import { parseCsv, normalizarHeader } from "../csv";
import {
  calcularScore,
  classificarABC,
  classificarPrioridade,
  classificarPrioridadeColdStart,
  ehBaseColdStart,
  AGENTE_POR_PROBLEMA,
  ROTULO_TIPO_PROBLEMA,
  GRAVIDADE_PROBLEMA as GRAVIDADE,
  SUGESTAO_PROBLEMA as SUGESTAO,
  type SinaisQualidade,
} from "../auditoria";
import type {
  AuditoriaAnuncio,
  Marketplace,
  ProblemaAnuncio,
  TipoProblema,
} from "../types";
import { MARKETPLACES } from "../constantes";
import { criarImportacao } from "./importacoes";
import { criarAuditorias } from "./auditorias";
import { criarProblemas } from "./problemasAnuncio";

// ---- Colunas reconhecidas (canônicas) e seus aliases ----

const ALIASES: Record<string, string> = {
  // métricas
  titulo: "titulo", title: "titulo", anuncio: "titulo", nome: "titulo", nome_do_anuncio: "titulo", produto: "titulo",
  sku: "sku", codigo: "sku", cod: "sku", mlb: "sku", id: "sku", id_do_anuncio: "sku", id_anuncio: "sku", codigo_do_anuncio: "sku",
  categoria: "categoria", category: "categoria", departamento: "categoria",
  preco: "preco", price: "preco", valor: "preco", preco_de_venda: "preco", preco_unitario: "preco",
  estoque: "estoque", stock: "estoque", quantidade: "estoque", estoque_disponivel: "estoque", qtd: "estoque", quantidade_disponivel: "estoque",
  vendas: "vendas", vendas_totais: "vendas", unidades_vendidas: "vendas", sold: "vendas", quantidade_vendida: "vendas", vendidos: "vendas",
  visitas: "visitas", visits: "visitas", visualizacoes: "visitas", views: "visitas",
  conversao: "conversao", conversion: "conversao", taxa_de_conversao: "conversao",
  link: "link", permalink: "link", url: "link", link_do_anuncio: "link",
  marketplace: "marketplace", canal: "marketplace", plataforma: "marketplace",
  // sinais de qualidade opcionais (0/1, sim/nao)
  titulo_ok: "titulo_ok", titulo_otimizado: "titulo_ok",
  descricao_ok: "descricao_ok", descricao_completa: "descricao_ok",
  imagens_ok: "imagens_ok", imagens: "imagens_ok", fotos_ok: "imagens_ok", imagem_ok: "imagens_ok",
  ficha_ok: "ficha_ok", ficha_completa: "ficha_ok", ficha_tecnica: "ficha_ok", ficha_tecnica_completa: "ficha_ok", atributos_ok: "ficha_ok",
  preco_competitivo: "preco_competitivo", preco_ok: "preco_competitivo",
  variacoes_ok: "variacoes_ok", variacoes: "variacoes_ok", variacoes_corretas: "variacoes_ok",
  tabela_medidas: "tabela_medidas", tabela_de_medidas: "tabela_medidas", tabela_ok: "tabela_medidas",
};

const COLUNAS_METRICAS = ["titulo", "sku", "categoria", "preco", "estoque", "vendas", "visitas", "conversao", "link", "marketplace"];
const COLUNAS_SINAIS = ["titulo_ok", "descricao_ok", "imagens_ok", "ficha_ok", "preco_competitivo", "variacoes_ok", "tabela_medidas"];

// Gravidade, sugestão e agente por tipo de problema vêm de lib/auditoria.ts
// (mapas canônicos, compartilhados com a auditoria gerada da base).

// ---- Parsers de valor ----

function parseNumero(s: string): number {
  if (!s) return 0;
  let t = s.replace(/[^\d,.-]/g, "").trim();
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}
const parseInteiro = (s: string): number => Math.max(0, Math.round(parseNumero(s)));

function parseBool(s: string): boolean {
  const v = (s ?? "").trim().toLowerCase();
  return ["1", "sim", "s", "true", "verdadeiro", "x", "ok", "yes", "y"].includes(v);
}

function tituloParecOtimizado(titulo: string): boolean {
  const palavras = titulo.trim().split(/\s+/).filter(Boolean);
  return titulo.trim().length >= 20 && titulo.trim().length <= 60 && palavras.length >= 4;
}

function resolverMarketplace(valor: string, padrao: Marketplace): Marketplace {
  const v = (valor ?? "").trim().toLowerCase();
  const achado = MARKETPLACES.find((m) => m.toLowerCase() === v);
  return achado ?? padrao;
}

// ---- Tipos expostos ----

export type BaseAuditoria = Omit<AuditoriaAnuncio, "id" | "importacaoId" | "clienteId" | "cliente">;

export interface LinhaAuditoria {
  base: BaseAuditoria;
  tiposProblema: TipoProblema[];
}

export interface ResultadoAnalise {
  total: number;
  colunasReconhecidas: string[];
  colunasIgnoradas: string[];
  faltandoObrigatorias: string[];
  amostra: LinhaAuditoria[];
  linhas: LinhaAuditoria[];
  /** Base quase sem vendas: prioridade recalculada por potencial (cold-start). */
  coldStart: boolean;
  erro?: string;
}

// ---- Análise (preview, sem gravar) ----

function mapearColunas(headers: string[]): Record<string, string> {
  const encontrado: Record<string, string> = {};
  for (const h of headers) {
    const canon = ALIASES[normalizarHeader(h)];
    if (canon && !encontrado[canon]) encontrado[canon] = h;
  }
  return encontrado;
}

function mapearLinha(
  rec: Record<string, string>,
  cols: Record<string, string>,
  marketplacePadrao: Marketplace
): LinhaAuditoria {
  const val = (canon: string): string => {
    const header = cols[canon];
    return header ? (rec[header] ?? "") : "";
  };
  const temCol = (canon: string) => Boolean(cols[canon]);
  const sinal = (canon: string, padrao: boolean) => (temCol(canon) ? parseBool(val(canon)) : padrao);

  const titulo = val("titulo") || "Anúncio sem título";
  const categoria = val("categoria");
  const preco = parseNumero(val("preco"));
  const estoque = parseInteiro(val("estoque"));
  const vendas = parseInteiro(val("vendas"));
  const visitas = parseInteiro(val("visitas"));
  const conversao = temCol("conversao")
    ? Math.round(parseNumero(val("conversao")) * 10) / 10
    : visitas > 0
      ? Math.round((vendas / visitas) * 1000) / 10
      : 0;
  const marketplace = resolverMarketplace(val("marketplace"), marketplacePadrao);

  const catBaixa = categoria.toLowerCase();
  const tabelaAplicavel = /cal[çc]ado|t[êe]nis|roupa|moda|camiseta|vestu/.test(catBaixa);

  const sinais: SinaisQualidade = {
    tituloOtimizado: temCol("titulo_ok") ? parseBool(val("titulo_ok")) : tituloParecOtimizado(titulo),
    descricaoCompleta: sinal("descricao_ok", true),
    imagensAdequadas: sinal("imagens_ok", true),
    fichaTecnicaCompleta: sinal("ficha_ok", true),
    precoCompetitivo: sinal("preco_competitivo", true),
    estoqueDisponivel: estoque > 0,
    variacoesCorretas: sinal("variacoes_ok", true),
    tabelaMedidasAplicavel: tabelaAplicavel,
    tabelaMedidas: sinal("tabela_medidas", true),
    conversao,
    visitas,
  };

  const score = calcularScore(sinais);
  const abc = classificarABC(vendas, preco * vendas);
  const prioridade = classificarPrioridade(score, abc);

  const tipos: TipoProblema[] = [];
  if (!sinais.tituloOtimizado) tipos.push("titulo_ruim");
  if (!sinais.descricaoCompleta) tipos.push("descricao_incompleta");
  if (!sinais.imagensAdequadas) tipos.push("imagem_fraca");
  if (!sinais.fichaTecnicaCompleta) tipos.push("ficha_tecnica_incompleta");
  if (!sinais.precoCompetitivo) tipos.push("preco_nao_competitivo");
  if (!sinais.estoqueDisponivel) tipos.push("estoque_baixo");
  if (!sinais.variacoesCorretas) tipos.push("variacao_incorreta");
  if (sinais.tabelaMedidasAplicavel && !sinais.tabelaMedidas) tipos.push("falta_tabela_medidas");
  if (conversao < 1.2 && visitas > 100) tipos.push("baixa_conversao");
  if (visitas < 60) tipos.push("baixa_visibilidade");

  const resumo = tipos.slice(0, 3).map((t) => ROTULO_TIPO_PROBLEMA[t]);
  const agente = tipos.length > 0 ? AGENTE_POR_PROBLEMA[tipos[0]] : "Zion Checklist por Categoria";

  const base: BaseAuditoria = {
    anuncioId: null,
    produtoId: null,
    marketplace,
    linkAnuncio: val("link"),
    tituloAtual: titulo,
    categoria,
    preco,
    estoque,
    vendas,
    visitas,
    conversao,
    scoreQualidade: score,
    classificacaoAbc: abc,
    prioridade,
    statusAuditoria: "analisado",
    problemasEncontrados: resumo.join(", ") || "Nenhum problema crítico",
    oportunidades:
      abc === "A"
        ? "Campeão de vendas — otimização gera retorno rápido."
        : abc === "B"
          ? "Bom potencial — subir score aumenta conversão."
          : "Cauda longa — otimizar em lote com esforço mínimo.",
    proximaAcao:
      tipos.length > 0 ? SUGESTAO[tipos[0]] : "Revisão final antes de considerar otimizado.",
    agenteRecomendado: agente,
    responsavel: "",
  };

  return { base, tiposProblema: tipos };
}

export function analisarCsv(texto: string, marketplacePadrao: Marketplace): ResultadoAnalise {
  const vazio: ResultadoAnalise = {
    total: 0,
    colunasReconhecidas: [],
    colunasIgnoradas: [],
    faltandoObrigatorias: ["titulo", "preco"],
    amostra: [],
    linhas: [],
    coldStart: false,
  };
  const { headers, linhas: registros } = parseCsv(texto);
  if (headers.length === 0 || registros.length === 0) {
    return { ...vazio, erro: "Arquivo vazio ou sem linhas de dados." };
  }

  const cols = mapearColunas(headers);
  const reconhecidas = Object.keys(cols);
  const colunasIgnoradas = headers.filter((h) => !ALIASES[normalizarHeader(h)]);
  const faltandoObrigatorias = ["titulo", "preco"].filter((c) => !cols[c]);

  const linhas = registros.map((r) => mapearLinha(r, cols, marketplacePadrao));

  // Base cold-start: o ABC por vendas não separa nada — reprioriza por
  // potencial (estoque × score baixo) para a fila não ficar cega.
  const coldStart = ehBaseColdStart(linhas.map((l) => l.base));
  if (coldStart) {
    linhas.forEach((l) => {
      l.base.prioridade = classificarPrioridadeColdStart(l.base.scoreQualidade, {
        estoque: l.base.estoque,
      });
      l.base.oportunidades =
        "Base cold-start — priorizado por potencial (estoque × score), não por venda.";
    });
  }

  return {
    total: linhas.length,
    colunasReconhecidas: reconhecidas,
    colunasIgnoradas,
    faltandoObrigatorias,
    amostra: linhas.slice(0, 8),
    linhas,
    coldStart,
  };
}

// ---- Confirmação (grava importação + auditorias + problemas) ----

export interface ResumoImportacao {
  importacaoId: string;
  totalAuditorias: number;
  totalProblemas: number;
}

export async function confirmarImportacaoCsv(params: {
  clienteId: string;
  cliente: string;
  marketplace: Marketplace;
  nomeArquivo: string;
  linhas: LinhaAuditoria[];
}): Promise<ResumoImportacao> {
  const { clienteId, cliente, marketplace, nomeArquivo, linhas } = params;
  const hoje = new Date().toISOString().slice(0, 10);

  const importacao = await criarImportacao({
    clienteId,
    cliente,
    marketplace,
    nomeArquivo,
    origem: "csv",
    quantidadeAnuncios: linhas.length,
    quantidadeProcessada: linhas.length,
    status: "concluida",
    dataImportacao: hoje,
    responsavel: "",
    observacoes: `Importado do arquivo "${nomeArquivo}" (${linhas.length} anúncios).`,
  });

  const auditorias = linhas.map((l) => ({
    ...l.base,
    importacaoId: importacao.id,
    clienteId,
    cliente,
  }));
  const criadas = await criarAuditorias(auditorias);

  // Monta os problemas correlacionando pela ordem (preservada na criação em lote).
  const problemas: Omit<ProblemaAnuncio, "id">[] = [];
  criadas.forEach((aud, i) => {
    const tipos = linhas[i]?.tiposProblema ?? [];
    tipos.slice(0, 4).forEach((tipo) => {
      problemas.push({
        auditoriaId: aud.id,
        tipoProblema: tipo,
        gravidade: GRAVIDADE[tipo],
        descricao: `${ROTULO_TIPO_PROBLEMA[tipo]} identificado na importação.`,
        sugestaoCorrecao: SUGESTAO[tipo],
        agenteRecomendado: AGENTE_POR_PROBLEMA[tipo],
        status: "aberto",
      });
    });
  });
  await criarProblemas(problemas);

  return {
    importacaoId: importacao.id,
    totalAuditorias: criadas.length,
    totalProblemas: problemas.length,
  };
}

// ---- Template de exemplo para download ----

function campoCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function gerarTemplateCsv(): string {
  const headers = [...COLUNAS_METRICAS, ...COLUNAS_SINAIS];
  const ex1 = [
    "Fone Bluetooth TWS Pro Cancelamento de Ruído",
    "MLB1001", "Áudio > Fones", "199,90", "25", "120", "3400", "13.5",
    "https://produto.mercadolivre.com.br/MLB-1001", "Mercado Livre",
    "1", "1", "1", "0", "1", "1",
  ];
  const ex2 = [
    "camiseta",
    "MLB1002", "Moda > Camisetas", "49,90", "0", "5", "80", "",
    "", "Shopee",
    "0", "0", "0", "0", "1", "0",
  ];
  return [headers, ex1, ex2].map((l) => l.map(campoCsv).join(",")).join("\r\n");
}

export const COLUNAS_TEMPLATE = { metricas: COLUNAS_METRICAS, sinais: COLUNAS_SINAIS };
