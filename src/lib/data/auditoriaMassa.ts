import {
  calcularScore,
  classificarABC,
  classificarPrioridade,
  AGENTE_POR_PROBLEMA,
  ROTULO_TIPO_PROBLEMA,
  type SinaisQualidade,
} from "../auditoria";
import type {
  AuditoriaAnuncio,
  ExecucaoLote,
  GravidadeProblema,
  ImportacaoAnuncios,
  ItemFilaOtimizacao,
  Marketplace,
  ProblemaAnuncio,
  TipoAcaoFila,
  TipoProblema,
} from "../types";

// ============================================================
// Seed da Auditoria em Massa.
//
// Gera 50 auditorias REPRESENTATIVAS de uma base de ~1.000 anúncios do
// cliente MegaShop Brasil (cli-10). Números gerados de forma determinística
// (pseudo-aleatória por índice) para ficarem estáveis entre recarregamentos,
// e leves (50 registros, não 1.000).
// ============================================================

const CLIENTE_ID = "cli-10";
const CLIENTE_NOME = "MegaShop Brasil";
const IMPORTACAO_ID = "imp-01";
const TOTAL_REPRESENTADO = 1000;
const AMOSTRA = 50;

// Gerador pseudo-aleatório determinístico (mulberry32)
function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIAS = [
  "Áudio > Fones",
  "Casa > Cozinha",
  "Eletrônicos > Acessórios",
  "Calçados > Tênis",
  "Beleza > Cuidados",
  "Esporte > Suplementos",
  "Ferramentas > Elétricas",
  "Moda > Camisetas",
];
const MARKETPLACES: Marketplace[] = ["Mercado Livre", "Shopee", "Amazon"];
const RESPONSAVEIS = ["Camila", "Lucas", "Amanda", "Rafael"];

const GRAVIDADE_PROBLEMA: Record<TipoProblema, GravidadeProblema> = {
  titulo_ruim: "alta",
  descricao_incompleta: "media",
  imagem_fraca: "alta",
  ficha_tecnica_incompleta: "critica",
  preco_nao_competitivo: "alta",
  estoque_baixo: "media",
  variacao_incorreta: "alta",
  falta_tabela_medidas: "media",
  categoria_errada: "critica",
  baixa_conversao: "alta",
  baixa_visibilidade: "media",
  risco_reputacao: "critica",
};

const SUGESTAO: Record<TipoProblema, string> = {
  titulo_ruim: "Reescrever o título com palavras-chave de maior busca (até 60 caracteres).",
  descricao_incompleta: "Completar a descrição com benefícios, uso e ficha técnica.",
  imagem_fraca: "Refazer a foto principal (fundo branco) e adicionar lifestyle.",
  ficha_tecnica_incompleta: "Preencher os atributos obrigatórios da categoria.",
  preco_nao_competitivo: "Reprecificar comparando com os 5 principais concorrentes.",
  estoque_baixo: "Repor estoque ou pausar o anúncio para não perder reputação.",
  variacao_incorreta: "Corrigir as variações e vincular SKUs corretos.",
  falta_tabela_medidas: "Adicionar a tabela de medidas na descrição.",
  categoria_errada: "Mover para a categoria correta do marketplace.",
  baixa_conversao: "Revisar título, imagens e preço para melhorar a conversão.",
  baixa_visibilidade: "Otimizar SEO e avaliar campanha de ads.",
  risco_reputacao: "Tratar causa de reclamações/atrasos antes de escalar.",
};

const problemas: ProblemaAnuncio[] = [];
const auditorias: AuditoriaAnuncio[] = [];
const fila: ItemFilaOtimizacao[] = [];

for (let i = 0; i < AMOSTRA; i++) {
  const r = rng(1000 + i * 7);
  const categoria = CATEGORIAS[Math.floor(r() * CATEGORIAS.length)];
  const marketplace = MARKETPLACES[Math.floor(r() * MARKETPLACES.length)];
  const ehCalcadoOuRoupa = categoria.includes("Calçados") || categoria.includes("Moda");

  const preco = Math.round((20 + r() * 480) * 100) / 100;
  const vendas = Math.floor(r() * 90);
  const visitas = Math.floor(20 + r() * 900);
  const conversao = visitas > 0 ? Math.round((vendas / visitas) * 1000) / 10 : 0;

  // Sinais de qualidade (probabilidade de estar OK)
  const ok = (p: number) => r() < p;
  const sinais: SinaisQualidade = {
    tituloOtimizado: ok(0.55),
    descricaoCompleta: ok(0.5),
    imagensAdequadas: ok(0.5),
    fichaTecnicaCompleta: ok(0.45),
    precoCompetitivo: ok(0.6),
    estoqueDisponivel: vendas === 0 ? ok(0.4) : ok(0.85),
    variacoesCorretas: ok(0.7),
    tabelaMedidasAplicavel: ehCalcadoOuRoupa,
    tabelaMedidas: ok(0.4),
    conversao,
    visitas,
  };

  const score = calcularScore(sinais);
  const receita = preco * vendas;
  const abc = classificarABC(vendas, receita);
  const prioridade = classificarPrioridade(score, abc);

  // Deriva problemas a partir dos sinais ausentes
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

  const auditoriaId = `aud-${String(i + 1).padStart(3, "0")}`;
  const numero = String(i + 1).padStart(4, "0");

  const tiposResumo = tipos.slice(0, 3).map((t) => ROTULO_TIPO_PROBLEMA[t]);
  const agenteRecomendado =
    tipos.length > 0 ? AGENTE_POR_PROBLEMA[tipos[0]] : "Zion Checklist por Categoria";

  auditorias.push({
    id: auditoriaId,
    importacaoId: IMPORTACAO_ID,
    clienteId: CLIENTE_ID,
    cliente: CLIENTE_NOME,
    anuncioId: null,
    produtoId: null,
    marketplace,
    linkAnuncio: `https://produto.mercadolivre.com.br/MLB-${1000000 + i}`,
    tituloAtual: `${categoria.split(">").pop()!.trim()} MegaShop ${numero}`,
    categoria,
    preco,
    estoque: sinais.estoqueDisponivel ? Math.floor(5 + r() * 200) : Math.floor(r() * 4),
    vendas,
    visitas,
    conversao,
    scoreQualidade: score,
    classificacaoAbc: abc,
    prioridade,
    statusAuditoria: "analisado",
    problemasEncontrados: tiposResumo.join(", ") || "Nenhum problema crítico",
    oportunidades:
      abc === "A"
        ? "Campeão de vendas — otimização gera retorno rápido."
        : abc === "B"
          ? "Bom potencial — subir score aumenta conversão."
          : "Cauda longa — otimizar em lote com esforço mínimo.",
    proximaAcao:
      tipos.length > 0 ? SUGESTAO[tipos[0]] : "Revisão final antes de considerar otimizado.",
    agenteRecomendado,
    responsavel: RESPONSAVEIS[i % RESPONSAVEIS.length],
  });

  // Problemas detalhados (até 4 por anúncio)
  tipos.slice(0, 4).forEach((tipo, j) => {
    problemas.push({
      id: `prb-${auditoriaId}-${j + 1}`,
      auditoriaId,
      tipoProblema: tipo,
      gravidade: GRAVIDADE_PROBLEMA[tipo],
      descricao: `${ROTULO_TIPO_PROBLEMA[tipo]} identificado na auditoria automática.`,
      sugestaoCorrecao: SUGESTAO[tipo],
      agenteRecomendado: AGENTE_POR_PROBLEMA[tipo],
      status: "aberto",
    });
  });
}

// Fila de otimização: os itens críticos e de alta prioridade viram fila
const ACAO_POR_PRIORIDADE: Record<string, TipoAcaoFila> = {
  critica: "otimizar_completo",
  alta: "revisar_titulo",
};
auditorias
  .filter((a) => a.prioridade === "critica" || a.prioridade === "alta")
  .slice(0, 12)
  .forEach((a, i) => {
    fila.push({
      id: `fila-${String(i + 1).padStart(2, "0")}`,
      clienteId: CLIENTE_ID,
      cliente: CLIENTE_NOME,
      auditoriaId: a.id,
      anuncioId: a.anuncioId,
      prioridade: a.prioridade,
      tipoAcao: ACAO_POR_PRIORIDADE[a.prioridade] ?? "revisar_titulo",
      agenteResponsavel: a.agenteRecomendado,
      responsavelHumano: a.responsavel,
      status: i < 2 ? "em_andamento" : "pendente",
      prazo: "2026-07-15",
      resultadoEsperado:
        a.prioridade === "critica"
          ? "Anúncio de alto valor recuperado (score > 75)."
          : "Título e SEO otimizados para subir visibilidade.",
      observacoes: "",
      tituloAnuncio: a.tituloAtual,
    });
  });

export const importacoesAnuncios: ImportacaoAnuncios[] = [
  {
    id: IMPORTACAO_ID,
    clienteId: CLIENTE_ID,
    cliente: CLIENTE_NOME,
    marketplace: "Mercado Livre",
    nomeArquivo: "megashop_anuncios_ml.csv",
    origem: "csv",
    quantidadeAnuncios: TOTAL_REPRESENTADO,
    quantidadeProcessada: TOTAL_REPRESENTADO,
    status: "concluida",
    dataImportacao: "2026-06-26",
    responsavel: "Lucas",
    observacoes: `Base de ${TOTAL_REPRESENTADO} anúncios. ${AMOSTRA} registros representativos carregados no Zion OS para a demonstração.`,
  },
  {
    id: "imp-02",
    clienteId: CLIENTE_ID,
    cliente: CLIENTE_NOME,
    marketplace: "Shopee",
    nomeArquivo: "megashop_shopee.xlsx",
    origem: "planilha",
    quantidadeAnuncios: 340,
    quantidadeProcessada: 0,
    status: "aguardando_processamento",
    dataImportacao: "2026-07-03",
    responsavel: "Amanda",
    observacoes: "Aguardando processamento da auditoria.",
  },
];

export const auditoriasAnuncios = auditorias;
export const problemasAnuncio = problemas;
export const filaOtimizacao = fila;

export const execucoesLote: ExecucaoLote[] = [
  {
    id: "exl-01",
    clienteId: CLIENTE_ID,
    cliente: CLIENTE_NOME,
    agenteId: "agt-23",
    agente: "Zion Score de Qualidade",
    tipoExecucao: "auditoria_seo",
    quantidadeItens: AMOSTRA,
    status: "concluida",
    entradaResumo: `${AMOSTRA} anúncios da importação ${IMPORTACAO_ID}`,
    saidaResumo: "Score calculado, ABC e prioridade classificados para todos.",
    erros: "",
    responsavel: "Lucas",
  },
  {
    id: "exl-02",
    clienteId: CLIENTE_ID,
    cliente: CLIENTE_NOME,
    agenteId: "agt-04",
    agente: "Zion SEO ML",
    tipoExecucao: "geracao_titulo",
    quantidadeItens: 12,
    status: "processando",
    entradaResumo: "12 anúncios críticos/alta prioridade da fila",
    saidaResumo: "Gerando títulos otimizados…",
    erros: "",
    responsavel: "Camila",
  },
];
