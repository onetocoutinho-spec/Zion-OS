// Mapeadores entre as linhas do banco (snake_case) e os tipos do app
// (camelCase). "paraApp" preenche também os nomes de exibição vindos dos
// joins; "paraBanco" converte apenas os campos presentes (suporta updates
// parciais) e descarta os campos de exibição.

import type {
  AgenteIA,
  Anuncio,
  Cliente,
  ExecucaoAgente,
  Produto,
  RegistroFinanceiro,
  Relatorio,
  Tarefa,
} from "../types";
import type {
  AgenteRow,
  AnuncioRow,
  ClienteRow,
  ExecucaoRow,
  FinanceiroRow,
  ProdutoRow,
  RelatorioRow,
  TarefaRow,
} from "./database.types";

// ---- Clientes ----

export function clienteParaApp(row: ClienteRow): Cliente {
  return {
    id: row.id,
    empresa: row.empresa,
    responsavel: row.responsavel ?? "",
    segmento: row.segmento ?? "",
    marketplaces: (row.marketplaces ?? []) as Cliente["marketplaces"],
    plano: row.plano ?? "—",
    status: row.status as Cliente["status"],
    dataEntrada: row.data_entrada ?? "",
    proximaReuniao: row.proxima_reuniao,
    proximaAcao: row.proxima_acao ?? "",
    risco: row.risco as Cliente["risco"],
    observacoes: row.observacoes ?? "",
  };
}

export function clienteParaBanco(d: Partial<Cliente>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.empresa !== undefined) r.empresa = d.empresa;
  if (d.responsavel !== undefined) r.responsavel = d.responsavel;
  if (d.segmento !== undefined) r.segmento = d.segmento;
  if (d.marketplaces !== undefined) r.marketplaces = d.marketplaces;
  if (d.plano !== undefined) r.plano = d.plano;
  if (d.status !== undefined) r.status = d.status;
  if (d.dataEntrada !== undefined) r.data_entrada = d.dataEntrada || null;
  if (d.proximaReuniao !== undefined) r.proxima_reuniao = d.proximaReuniao || null;
  if (d.proximaAcao !== undefined) r.proxima_acao = d.proximaAcao;
  if (d.risco !== undefined) r.risco = d.risco;
  if (d.observacoes !== undefined) r.observacoes = d.observacoes;
  return r;
}

// ---- Produtos ----

export function produtoParaApp(row: ProdutoRow): Produto {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    cliente: row.clientes?.empresa ?? "—",
    nome: row.nome,
    marca: row.marca ?? "",
    modelo: row.modelo ?? "",
    categoria: row.categoria ?? "",
    sku: row.sku ?? "",
    cor: row.cor ?? "—",
    tamanho: row.tamanho ?? "—",
    custo: Number(row.custo ?? 0),
    precoVenda: Number(row.preco_venda ?? 0),
    estoque: Number(row.estoque ?? 0),
    marketplace: (row.marketplace ?? "Mercado Livre") as Produto["marketplace"],
    statusCadastro: row.status_cadastro as Produto["statusCadastro"],
    statusSeo: row.status_seo as Produto["statusSeo"],
    statusDescricao: row.status_descricao as Produto["statusDescricao"],
    statusImagens: row.status_imagens as Produto["statusImagens"],
    statusPrecificacao: row.status_precificacao as Produto["statusPrecificacao"],
    prioridade: row.prioridade as Produto["prioridade"],
    observacoes: row.observacoes ?? "",
  };
}

export function produtoParaBanco(d: Partial<Produto>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.nome !== undefined) r.nome = d.nome;
  if (d.marca !== undefined) r.marca = d.marca;
  if (d.modelo !== undefined) r.modelo = d.modelo;
  if (d.categoria !== undefined) r.categoria = d.categoria;
  if (d.sku !== undefined) r.sku = d.sku;
  if (d.cor !== undefined) r.cor = d.cor;
  if (d.tamanho !== undefined) r.tamanho = d.tamanho;
  if (d.custo !== undefined) r.custo = d.custo;
  if (d.precoVenda !== undefined) r.preco_venda = d.precoVenda;
  if (d.estoque !== undefined) r.estoque = d.estoque;
  if (d.marketplace !== undefined) r.marketplace = d.marketplace;
  if (d.statusCadastro !== undefined) r.status_cadastro = d.statusCadastro;
  if (d.statusSeo !== undefined) r.status_seo = d.statusSeo;
  if (d.statusDescricao !== undefined) r.status_descricao = d.statusDescricao;
  if (d.statusImagens !== undefined) r.status_imagens = d.statusImagens;
  if (d.statusPrecificacao !== undefined) r.status_precificacao = d.statusPrecificacao;
  if (d.prioridade !== undefined) r.prioridade = d.prioridade;
  if (d.observacoes !== undefined) r.observacoes = d.observacoes;
  return r;
}

// ---- Anúncios ----

export function anuncioParaApp(row: AnuncioRow): Anuncio {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    cliente: row.clientes?.empresa ?? "—",
    produtoId: row.produto_id,
    produto: row.produtos?.nome ?? "—",
    marketplace: (row.marketplace ?? "Mercado Livre") as Anuncio["marketplace"],
    link: row.link ?? "—",
    tituloAtual: row.titulo_atual ?? "—",
    tituloOtimizado: row.titulo_otimizado ?? "",
    statusSeo: row.status_seo as Anuncio["statusSeo"],
    statusDescricao: row.status_descricao as Anuncio["statusDescricao"],
    statusImagens: row.status_imagens as Anuncio["statusImagens"],
    statusPrecificacao: row.status_precificacao as Anuncio["statusPrecificacao"],
    statusConcorrencia: row.status_concorrencia as Anuncio["statusConcorrencia"],
    statusRevisao: row.status_revisao as Anuncio["statusRevisao"],
    statusPublicacao: row.status_publicacao as Anuncio["statusPublicacao"],
    proximaAcao: row.proxima_acao ?? "",
    responsavel: row.responsavel ?? "",
  };
}

export function anuncioParaBanco(d: Partial<Anuncio>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.produtoId !== undefined) r.produto_id = d.produtoId;
  if (d.marketplace !== undefined) r.marketplace = d.marketplace;
  if (d.link !== undefined) r.link = d.link;
  if (d.tituloAtual !== undefined) r.titulo_atual = d.tituloAtual;
  if (d.tituloOtimizado !== undefined) r.titulo_otimizado = d.tituloOtimizado;
  if (d.statusSeo !== undefined) r.status_seo = d.statusSeo;
  if (d.statusDescricao !== undefined) r.status_descricao = d.statusDescricao;
  if (d.statusImagens !== undefined) r.status_imagens = d.statusImagens;
  if (d.statusPrecificacao !== undefined) r.status_precificacao = d.statusPrecificacao;
  if (d.statusConcorrencia !== undefined) r.status_concorrencia = d.statusConcorrencia;
  if (d.statusRevisao !== undefined) r.status_revisao = d.statusRevisao;
  if (d.statusPublicacao !== undefined) r.status_publicacao = d.statusPublicacao;
  if (d.proximaAcao !== undefined) r.proxima_acao = d.proximaAcao;
  if (d.responsavel !== undefined) r.responsavel = d.responsavel;
  return r;
}

// ---- Agentes ----

export function agenteParaApp(row: AgenteRow): AgenteIA {
  return {
    id: row.id,
    nome: row.nome,
    area: row.area as AgenteIA["area"],
    objetivo: row.objetivo ?? "",
    quandoUsar: row.quando_usar ?? "",
    entradaNecessaria: row.entrada_necessaria ?? "",
    saidaEsperada: row.saida_esperada ?? "",
    promptResumido: row.prompt_resumido ?? "",
    statusImplantacao: row.status_implantacao as AgenteIA["statusImplantacao"],
    frequenciaUso: row.frequencia_uso as AgenteIA["frequenciaUso"],
    agentesConectados: row.agentes_conectados ?? [],
  };
}

export function agenteParaBanco(d: Partial<AgenteIA>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.nome !== undefined) r.nome = d.nome;
  if (d.area !== undefined) r.area = d.area;
  if (d.objetivo !== undefined) r.objetivo = d.objetivo;
  if (d.quandoUsar !== undefined) r.quando_usar = d.quandoUsar;
  if (d.entradaNecessaria !== undefined) r.entrada_necessaria = d.entradaNecessaria;
  if (d.saidaEsperada !== undefined) r.saida_esperada = d.saidaEsperada;
  if (d.promptResumido !== undefined) r.prompt_resumido = d.promptResumido;
  if (d.statusImplantacao !== undefined) r.status_implantacao = d.statusImplantacao;
  if (d.frequenciaUso !== undefined) r.frequencia_uso = d.frequenciaUso;
  if (d.agentesConectados !== undefined) r.agentes_conectados = d.agentesConectados;
  return r;
}

// ---- Tarefas ----

export function tarefaParaApp(row: TarefaRow): Tarefa {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    cliente: row.clientes?.empresa ?? "—",
    produtoId: row.produto_id,
    produto: row.produtos?.nome ?? null,
    anuncioId: row.anuncio_id,
    anuncio: row.anuncios?.produtos?.nome ?? null,
    agenteId: row.agente_id,
    agenteRelacionado: row.agentes?.nome ?? null,
    area: row.area ?? "Agência",
    tarefa: row.tarefa,
    responsavel: row.responsavel ?? "",
    prioridade: row.prioridade as Tarefa["prioridade"],
    status: row.status as Tarefa["status"],
    prazo: row.prazo ?? "",
    proximaAcao: row.proxima_acao ?? "",
    observacoes: row.observacoes ?? "",
  };
}

export function tarefaParaBanco(d: Partial<Tarefa>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.produtoId !== undefined) r.produto_id = d.produtoId;
  if (d.anuncioId !== undefined) r.anuncio_id = d.anuncioId;
  if (d.agenteId !== undefined) r.agente_id = d.agenteId;
  if (d.area !== undefined) r.area = d.area;
  if (d.tarefa !== undefined) r.tarefa = d.tarefa;
  if (d.responsavel !== undefined) r.responsavel = d.responsavel;
  if (d.prioridade !== undefined) r.prioridade = d.prioridade;
  if (d.status !== undefined) r.status = d.status;
  if (d.prazo !== undefined) r.prazo = d.prazo || null;
  if (d.proximaAcao !== undefined) r.proxima_acao = d.proximaAcao;
  if (d.observacoes !== undefined) r.observacoes = d.observacoes;
  return r;
}

// ---- Relatórios ----

export function relatorioParaApp(row: RelatorioRow): Relatorio {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    cliente: row.clientes?.empresa ?? "—",
    periodo: row.periodo,
    oQueFoiFeito: row.o_que_foi_feito ?? "",
    produtosTrabalhados: Number(row.produtos_trabalhados ?? 0),
    anunciosRevisados: Number(row.anuncios_revisados ?? 0),
    problemasEncontrados: row.problemas_encontrados ?? "—",
    oportunidades: row.oportunidades ?? "—",
    pendencias: row.pendencias ?? "—",
    proximasAcoes: row.proximas_acoes ?? "",
    status: row.status as Relatorio["status"],
  };
}

export function relatorioParaBanco(d: Partial<Relatorio>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.periodo !== undefined) r.periodo = d.periodo;
  if (d.oQueFoiFeito !== undefined) r.o_que_foi_feito = d.oQueFoiFeito;
  if (d.produtosTrabalhados !== undefined) r.produtos_trabalhados = d.produtosTrabalhados;
  if (d.anunciosRevisados !== undefined) r.anuncios_revisados = d.anunciosRevisados;
  if (d.problemasEncontrados !== undefined) r.problemas_encontrados = d.problemasEncontrados;
  if (d.oportunidades !== undefined) r.oportunidades = d.oportunidades;
  if (d.pendencias !== undefined) r.pendencias = d.pendencias;
  if (d.proximasAcoes !== undefined) r.proximas_acoes = d.proximasAcoes;
  if (d.status !== undefined) r.status = d.status;
  return r;
}

// ---- Financeiro ----

export function financeiroParaApp(row: FinanceiroRow): RegistroFinanceiro {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    cliente: row.clientes?.empresa ?? "—",
    plano: row.plano ?? "—",
    valorMensal: Number(row.valor_mensal ?? 0),
    dataVencimento: row.data_vencimento ?? "",
    statusPagamento: row.status_pagamento as RegistroFinanceiro["statusPagamento"],
    servicosExtras: row.servicos_extras ?? "—",
    custoOperacional: Number(row.custo_operacional ?? 0),
    lucroEstimado: Number(row.lucro_estimado ?? 0),
    observacoes: row.observacoes ?? "",
  };
}

export function financeiroParaBanco(
  d: Partial<RegistroFinanceiro>
): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.plano !== undefined) r.plano = d.plano;
  if (d.valorMensal !== undefined) r.valor_mensal = d.valorMensal;
  if (d.dataVencimento !== undefined) r.data_vencimento = d.dataVencimento || null;
  if (d.statusPagamento !== undefined) r.status_pagamento = d.statusPagamento;
  if (d.servicosExtras !== undefined) r.servicos_extras = d.servicosExtras;
  if (d.custoOperacional !== undefined) r.custo_operacional = d.custoOperacional;
  if (d.lucroEstimado !== undefined) r.lucro_estimado = d.lucroEstimado;
  if (d.observacoes !== undefined) r.observacoes = d.observacoes;
  return r;
}

// ---- Execuções de agentes ----

export function execucaoParaApp(row: ExecucaoRow): ExecucaoAgente {
  return {
    id: row.id,
    agenteId: row.agente_id,
    agente: row.agentes?.nome ?? "—",
    dataHora: row.data_hora,
    contexto: row.contexto ?? "",
    resultado: row.resultado ?? "",
  };
}

export function execucaoParaBanco(d: Partial<ExecucaoAgente>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.agenteId !== undefined) r.agente_id = d.agenteId;
  if (d.dataHora !== undefined) r.data_hora = d.dataHora;
  if (d.contexto !== undefined) r.contexto = d.contexto;
  if (d.resultado !== undefined) r.resultado = d.resultado;
  return r;
}
