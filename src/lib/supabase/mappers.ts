// Mapeadores entre as linhas do banco (snake_case) e os tipos do app
// (camelCase). "paraApp" preenche também os nomes de exibição vindos dos
// joins; "paraBanco" converte apenas os campos presentes (suporta updates
// parciais) e descarta os campos de exibição.

import type {
  AgenteIA,
  Anuncio,
  AnuncioGeradoRegistro,
  AnuncioVariante,
  AuditoriaAnuncio,
  CategoriaTemplate,
  Cliente,
  ExecucaoAgente,
  ExecucaoLote,
  ImagemProduto,
  ImportacaoAnuncios,
  ItemFilaOtimizacao,
  Pendencia,
  PrecificacaoVariante,
  ProblemaAnuncio,
  Produto,
  ProdutoAtributo,
  ProdutoVariante,
  RegistroFinanceiro,
  Relatorio,
  Reuniao,
  Tarefa,
} from "../types";
import type {
  AgenteRow,
  AnuncioGeradoRow,
  AnuncioRow,
  AnuncioVarianteRow,
  AuditoriaAnuncioRow,
  CategoriaTemplateRow,
  ClienteRow,
  ExecucaoLoteRow,
  ExecucaoRow,
  FilaOtimizacaoRow,
  FinanceiroRow,
  ImagemProdutoRow,
  ImportacaoAnunciosRow,
  PendenciaRow,
  PrecificacaoVarianteRow,
  ProblemaAnuncioRow,
  ProdutoAtributoRow,
  ProdutoRow,
  ProdutoVarianteRow,
  RelatorioRow,
  ReuniaoRow,
  TarefaRow,
} from "./database.types";
import { resumoVariante } from "../variantes";

/** Resumo de variante a partir dos campos join no banco. */
function resumoVarianteRow(
  v?: {
    cor: string | null;
    tamanho: string | null;
    voltagem: string | null;
    sabor: string | null;
    aroma: string | null;
    modelo_variacao: string | null;
  } | null
): string {
  if (!v) return "—";
  return resumoVariante({
    cor: v.cor ?? "",
    tamanho: v.tamanho ?? "",
    voltagem: v.voltagem ?? "",
    sabor: v.sabor ?? "",
    aroma: v.aroma ?? "",
    modeloVariacao: v.modelo_variacao ?? "",
  });
}

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
    tipoProduto: (row.tipo_produto ?? "simples") as Produto["tipoProduto"],
    categoriaMarketplaceSugerida: row.categoria_marketplace_sugerida ?? "",
    descricaoBase: row.descricao_base ?? "",
    beneficios: row.beneficios ?? "",
    cuidados: row.cuidados ?? "",
    codErp: row.cod_erp ?? "",
    precoMinimo: row.preco_minimo != null ? Number(row.preco_minimo) : undefined,
    margem: row.margem != null ? Number(row.margem) : undefined,
    confiancaCusto: (row.confianca_custo ?? "") as Produto["confiancaCusto"],
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
  if (d.tipoProduto !== undefined) r.tipo_produto = d.tipoProduto;
  if (d.categoriaMarketplaceSugerida !== undefined)
    r.categoria_marketplace_sugerida = d.categoriaMarketplaceSugerida;
  if (d.descricaoBase !== undefined) r.descricao_base = d.descricaoBase;
  if (d.beneficios !== undefined) r.beneficios = d.beneficios;
  if (d.cuidados !== undefined) r.cuidados = d.cuidados;
  if (d.codErp !== undefined) r.cod_erp = d.codErp;
  if (d.precoMinimo !== undefined) r.preco_minimo = d.precoMinimo;
  if (d.margem !== undefined) r.margem = d.margem;
  if (d.confiancaCusto !== undefined) r.confianca_custo = d.confiancaCusto;
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
    categoriaMarketplace: row.categoria_marketplace ?? "",
    descricao: row.descricao ?? "",
    idExternoMarketplace: row.id_externo_marketplace ?? "",
    observacoes: row.observacoes ?? "",
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
  if (d.categoriaMarketplace !== undefined) r.categoria_marketplace = d.categoriaMarketplace;
  if (d.descricao !== undefined) r.descricao = d.descricao;
  if (d.idExternoMarketplace !== undefined) r.id_externo_marketplace = d.idExternoMarketplace;
  if (d.observacoes !== undefined) r.observacoes = d.observacoes;
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
    tipo: row.tipo === "IA" ? "IA" : "Simulada",
  };
}

export function execucaoParaBanco(d: Partial<ExecucaoAgente>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.agenteId !== undefined) r.agente_id = d.agenteId;
  if (d.dataHora !== undefined) r.data_hora = d.dataHora;
  if (d.contexto !== undefined) r.contexto = d.contexto;
  if (d.resultado !== undefined) r.resultado = d.resultado;
  if (d.tipo !== undefined) r.tipo = d.tipo;
  return r;
}

// ---- Reuniões ----

export function reuniaoParaApp(row: ReuniaoRow): Reuniao {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    cliente: row.clientes?.empresa ?? "—",
    titulo: row.titulo,
    dataHora: row.data_hora,
    pauta: row.pauta ?? "",
    status: row.status as Reuniao["status"],
  };
}

export function reuniaoParaBanco(d: Partial<Reuniao>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.titulo !== undefined) r.titulo = d.titulo;
  if (d.dataHora !== undefined) r.data_hora = d.dataHora || null;
  if (d.pauta !== undefined) r.pauta = d.pauta;
  if (d.status !== undefined) r.status = d.status;
  return r;
}

// ---- Pendências ----

export function pendenciaParaApp(row: PendenciaRow): Pendencia {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    cliente: row.clientes?.empresa ?? "—",
    tarefaId: row.tarefa_id,
    tarefa: row.tarefas?.tarefa ?? null,
    descricao: row.descricao,
    resolvida: row.resolvida,
  };
}

export function pendenciaParaBanco(d: Partial<Pendencia>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.tarefaId !== undefined) r.tarefa_id = d.tarefaId;
  if (d.descricao !== undefined) r.descricao = d.descricao;
  if (d.resolvida !== undefined) r.resolvida = d.resolvida;
  return r;
}

// ---- v1.7: Variantes de produto ----

export function varianteParaApp(row: ProdutoVarianteRow): ProdutoVariante {
  return {
    id: row.id,
    produtoId: row.produto_id,
    clienteId: row.cliente_id,
    produto: row.produtos?.nome ?? "",
    sku: row.sku ?? "",
    codigoInterno: row.codigo_interno ?? "",
    ean: row.ean ?? "",
    cor: row.cor ?? "",
    tamanho: row.tamanho ?? "",
    voltagem: row.voltagem ?? "",
    sabor: row.sabor ?? "",
    aroma: row.aroma ?? "",
    modeloVariacao: row.modelo_variacao ?? "",
    custo: Number(row.custo ?? 0),
    precoBase: Number(row.preco_base ?? 0),
    estoque: Number(row.estoque ?? 0),
    peso: Number(row.peso ?? 0),
    altura: Number(row.altura ?? 0),
    largura: Number(row.largura ?? 0),
    comprimento: Number(row.comprimento ?? 0),
    status: row.status as ProdutoVariante["status"],
    observacoes: row.observacoes ?? "",
  };
}

export function varianteParaBanco(d: Partial<ProdutoVariante>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.produtoId !== undefined) r.produto_id = d.produtoId;
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.sku !== undefined) r.sku = d.sku;
  if (d.codigoInterno !== undefined) r.codigo_interno = d.codigoInterno;
  if (d.ean !== undefined) r.ean = d.ean;
  if (d.cor !== undefined) r.cor = d.cor;
  if (d.tamanho !== undefined) r.tamanho = d.tamanho;
  if (d.voltagem !== undefined) r.voltagem = d.voltagem;
  if (d.sabor !== undefined) r.sabor = d.sabor;
  if (d.aroma !== undefined) r.aroma = d.aroma;
  if (d.modeloVariacao !== undefined) r.modelo_variacao = d.modeloVariacao;
  if (d.custo !== undefined) r.custo = d.custo;
  if (d.precoBase !== undefined) r.preco_base = d.precoBase;
  if (d.estoque !== undefined) r.estoque = d.estoque;
  if (d.peso !== undefined) r.peso = d.peso;
  if (d.altura !== undefined) r.altura = d.altura;
  if (d.largura !== undefined) r.largura = d.largura;
  if (d.comprimento !== undefined) r.comprimento = d.comprimento;
  if (d.status !== undefined) r.status = d.status;
  if (d.observacoes !== undefined) r.observacoes = d.observacoes;
  return r;
}

// ---- v1.7: Atributos de produto ----

export function atributoParaApp(row: ProdutoAtributoRow): ProdutoAtributo {
  return {
    id: row.id,
    produtoId: row.produto_id,
    nomeAtributo: row.nome_atributo,
    valorAtributo: row.valor_atributo ?? "",
    tipoAtributo: row.tipo_atributo as ProdutoAtributo["tipoAtributo"],
    obrigatorio: row.obrigatorio,
    origem: row.origem as ProdutoAtributo["origem"],
  };
}

export function atributoParaBanco(d: Partial<ProdutoAtributo>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.produtoId !== undefined) r.produto_id = d.produtoId;
  if (d.nomeAtributo !== undefined) r.nome_atributo = d.nomeAtributo;
  if (d.valorAtributo !== undefined) r.valor_atributo = d.valorAtributo;
  if (d.tipoAtributo !== undefined) r.tipo_atributo = d.tipoAtributo;
  if (d.obrigatorio !== undefined) r.obrigatorio = d.obrigatorio;
  if (d.origem !== undefined) r.origem = d.origem;
  return r;
}

// ---- v1.7: Templates de categoria ----

export function templateParaApp(row: CategoriaTemplateRow): CategoriaTemplate {
  return {
    id: row.id,
    categoriaZion: row.categoria_zion,
    marketplace: row.marketplace as CategoriaTemplate["marketplace"],
    nomeTemplate: row.nome_template,
    descricao: row.descricao ?? "",
    camposObrigatorios: row.campos_obrigatorios ?? [],
    camposRecomendados: row.campos_recomendados ?? [],
    atributosMarketplace: row.atributos_marketplace ?? [],
    regrasVariacao: row.regras_variacao ?? "",
    checklistCategoria: row.checklist_categoria ?? [],
    agentesRecomendados: row.agentes_recomendados ?? [],
  };
}

export function templateParaBanco(d: Partial<CategoriaTemplate>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.categoriaZion !== undefined) r.categoria_zion = d.categoriaZion;
  if (d.marketplace !== undefined) r.marketplace = d.marketplace;
  if (d.nomeTemplate !== undefined) r.nome_template = d.nomeTemplate;
  if (d.descricao !== undefined) r.descricao = d.descricao;
  if (d.camposObrigatorios !== undefined) r.campos_obrigatorios = d.camposObrigatorios;
  if (d.camposRecomendados !== undefined) r.campos_recomendados = d.camposRecomendados;
  if (d.atributosMarketplace !== undefined) r.atributos_marketplace = d.atributosMarketplace;
  if (d.regrasVariacao !== undefined) r.regras_variacao = d.regrasVariacao;
  if (d.checklistCategoria !== undefined) r.checklist_categoria = d.checklistCategoria;
  if (d.agentesRecomendados !== undefined) r.agentes_recomendados = d.agentesRecomendados;
  return r;
}

// ---- v1.7: Variantes vinculadas a anúncio ----

export function anuncioVarianteParaApp(row: AnuncioVarianteRow): AnuncioVariante {
  return {
    id: row.id,
    anuncioId: row.anuncio_id,
    produtoId: row.produto_id,
    varianteId: row.variante_id,
    clienteId: row.cliente_id,
    skuEnviado: row.sku_enviado ?? "",
    precoEnviado: Number(row.preco_enviado ?? 0),
    estoqueEnviado: Number(row.estoque_enviado ?? 0),
    statusEnvio: row.status_envio as AnuncioVariante["statusEnvio"],
    idVariacaoMarketplace: row.id_variacao_marketplace ?? "",
    observacoes: row.observacoes ?? "",
    varianteResumo: resumoVarianteRow(row.produto_variantes),
  };
}

export function anuncioVarianteParaBanco(d: Partial<AnuncioVariante>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.anuncioId !== undefined) r.anuncio_id = d.anuncioId;
  if (d.produtoId !== undefined) r.produto_id = d.produtoId;
  if (d.varianteId !== undefined) r.variante_id = d.varianteId;
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.skuEnviado !== undefined) r.sku_enviado = d.skuEnviado;
  if (d.precoEnviado !== undefined) r.preco_enviado = d.precoEnviado;
  if (d.estoqueEnviado !== undefined) r.estoque_enviado = d.estoqueEnviado;
  if (d.statusEnvio !== undefined) r.status_envio = d.statusEnvio;
  if (d.idVariacaoMarketplace !== undefined) r.id_variacao_marketplace = d.idVariacaoMarketplace;
  if (d.observacoes !== undefined) r.observacoes = d.observacoes;
  return r;
}

// ---- v1.7: Precificação por variante ----

export function precificacaoParaApp(row: PrecificacaoVarianteRow): PrecificacaoVariante {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    produtoId: row.produto_id,
    varianteId: row.variante_id,
    marketplace: row.marketplace as PrecificacaoVariante["marketplace"],
    custoProduto: Number(row.custo_produto ?? 0),
    embalagem: Number(row.embalagem ?? 0),
    impostoPercentual: Number(row.imposto_percentual ?? 0),
    taxaMarketplacePercentual: Number(row.taxa_marketplace_percentual ?? 0),
    taxaFixa: Number(row.taxa_fixa ?? 0),
    comissaoGestorPercentual: Number(row.comissao_gestor_percentual ?? 0),
    outrosCustos: Number(row.outros_custos ?? 0),
    precoVenda: Number(row.preco_venda ?? 0),
    lucroBruto: Number(row.lucro_bruto ?? 0),
    lucroLiquido: Number(row.lucro_liquido ?? 0),
    margemLiquidaPercentual: Number(row.margem_liquida_percentual ?? 0),
    precoMinimo: Number(row.preco_minimo ?? 0),
    statusMargem: row.status_margem as PrecificacaoVariante["statusMargem"],
    observacoes: row.observacoes ?? "",
    varianteResumo: resumoVarianteRow(row.produto_variantes),
  };
}

export function precificacaoParaBanco(
  d: Partial<PrecificacaoVariante>
): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.produtoId !== undefined) r.produto_id = d.produtoId;
  if (d.varianteId !== undefined) r.variante_id = d.varianteId;
  if (d.marketplace !== undefined) r.marketplace = d.marketplace;
  if (d.custoProduto !== undefined) r.custo_produto = d.custoProduto;
  if (d.embalagem !== undefined) r.embalagem = d.embalagem;
  if (d.impostoPercentual !== undefined) r.imposto_percentual = d.impostoPercentual;
  if (d.taxaMarketplacePercentual !== undefined)
    r.taxa_marketplace_percentual = d.taxaMarketplacePercentual;
  if (d.taxaFixa !== undefined) r.taxa_fixa = d.taxaFixa;
  if (d.comissaoGestorPercentual !== undefined)
    r.comissao_gestor_percentual = d.comissaoGestorPercentual;
  if (d.outrosCustos !== undefined) r.outros_custos = d.outrosCustos;
  if (d.precoVenda !== undefined) r.preco_venda = d.precoVenda;
  if (d.lucroBruto !== undefined) r.lucro_bruto = d.lucroBruto;
  if (d.lucroLiquido !== undefined) r.lucro_liquido = d.lucroLiquido;
  if (d.margemLiquidaPercentual !== undefined)
    r.margem_liquida_percentual = d.margemLiquidaPercentual;
  if (d.precoMinimo !== undefined) r.preco_minimo = d.precoMinimo;
  if (d.statusMargem !== undefined) r.status_margem = d.statusMargem;
  if (d.observacoes !== undefined) r.observacoes = d.observacoes;
  return r;
}

// ---- v1.7: Imagens de produto ----

export function imagemParaApp(row: ImagemProdutoRow): ImagemProduto {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    produtoId: row.produto_id,
    varianteId: row.variante_id,
    anuncioId: row.anuncio_id,
    tipoImagem: row.tipo_imagem as ImagemProduto["tipoImagem"],
    url: row.url ?? "",
    status: row.status as ImagemProduto["status"],
    observacoes: row.observacoes ?? "",
  };
}

export function imagemParaBanco(d: Partial<ImagemProduto>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.produtoId !== undefined) r.produto_id = d.produtoId;
  if (d.varianteId !== undefined) r.variante_id = d.varianteId;
  if (d.anuncioId !== undefined) r.anuncio_id = d.anuncioId;
  if (d.tipoImagem !== undefined) r.tipo_imagem = d.tipoImagem;
  if (d.url !== undefined) r.url = d.url;
  if (d.status !== undefined) r.status = d.status;
  if (d.observacoes !== undefined) r.observacoes = d.observacoes;
  return r;
}

// ---- v1.8: Importações de anúncios ----

export function importacaoParaApp(row: ImportacaoAnunciosRow): ImportacaoAnuncios {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    cliente: row.clientes?.empresa ?? "—",
    marketplace: (row.marketplace ?? "Mercado Livre") as ImportacaoAnuncios["marketplace"],
    nomeArquivo: row.nome_arquivo ?? "",
    origem: row.origem as ImportacaoAnuncios["origem"],
    quantidadeAnuncios: Number(row.quantidade_anuncios ?? 0),
    quantidadeProcessada: Number(row.quantidade_processada ?? 0),
    status: row.status as ImportacaoAnuncios["status"],
    dataImportacao: row.data_importacao ?? "",
    responsavel: row.responsavel ?? "",
    observacoes: row.observacoes ?? "",
  };
}

export function importacaoParaBanco(d: Partial<ImportacaoAnuncios>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.marketplace !== undefined) r.marketplace = d.marketplace;
  if (d.nomeArquivo !== undefined) r.nome_arquivo = d.nomeArquivo;
  if (d.origem !== undefined) r.origem = d.origem;
  if (d.quantidadeAnuncios !== undefined) r.quantidade_anuncios = d.quantidadeAnuncios;
  if (d.quantidadeProcessada !== undefined) r.quantidade_processada = d.quantidadeProcessada;
  if (d.status !== undefined) r.status = d.status;
  if (d.dataImportacao !== undefined) r.data_importacao = d.dataImportacao || null;
  if (d.responsavel !== undefined) r.responsavel = d.responsavel;
  if (d.observacoes !== undefined) r.observacoes = d.observacoes;
  return r;
}

// ---- v1.8: Auditorias de anúncios ----

export function auditoriaParaApp(row: AuditoriaAnuncioRow): AuditoriaAnuncio {
  return {
    id: row.id,
    importacaoId: row.importacao_id,
    clienteId: row.cliente_id,
    cliente: row.clientes?.empresa ?? "—",
    anuncioId: row.anuncio_id,
    produtoId: row.produto_id,
    marketplace: (row.marketplace ?? "Mercado Livre") as AuditoriaAnuncio["marketplace"],
    linkAnuncio: row.link_anuncio ?? "",
    tituloAtual: row.titulo_atual ?? "",
    categoria: row.categoria ?? "",
    preco: Number(row.preco ?? 0),
    estoque: Number(row.estoque ?? 0),
    vendas: Number(row.vendas ?? 0),
    visitas: Number(row.visitas ?? 0),
    conversao: Number(row.conversao ?? 0),
    scoreQualidade: Number(row.score_qualidade ?? 0),
    classificacaoAbc: row.classificacao_abc as AuditoriaAnuncio["classificacaoAbc"],
    prioridade: row.prioridade as AuditoriaAnuncio["prioridade"],
    statusAuditoria: row.status_auditoria as AuditoriaAnuncio["statusAuditoria"],
    problemasEncontrados: row.problemas_encontrados ?? "",
    oportunidades: row.oportunidades ?? "",
    proximaAcao: row.proxima_acao ?? "",
    agenteRecomendado: row.agente_recomendado ?? "",
    responsavel: row.responsavel ?? "",
  };
}

export function auditoriaParaBanco(d: Partial<AuditoriaAnuncio>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.importacaoId !== undefined) r.importacao_id = d.importacaoId;
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.anuncioId !== undefined) r.anuncio_id = d.anuncioId;
  if (d.produtoId !== undefined) r.produto_id = d.produtoId;
  if (d.marketplace !== undefined) r.marketplace = d.marketplace;
  if (d.linkAnuncio !== undefined) r.link_anuncio = d.linkAnuncio;
  if (d.tituloAtual !== undefined) r.titulo_atual = d.tituloAtual;
  if (d.categoria !== undefined) r.categoria = d.categoria;
  if (d.preco !== undefined) r.preco = d.preco;
  if (d.estoque !== undefined) r.estoque = d.estoque;
  if (d.vendas !== undefined) r.vendas = d.vendas;
  if (d.visitas !== undefined) r.visitas = d.visitas;
  if (d.conversao !== undefined) r.conversao = d.conversao;
  if (d.scoreQualidade !== undefined) r.score_qualidade = d.scoreQualidade;
  if (d.classificacaoAbc !== undefined) r.classificacao_abc = d.classificacaoAbc;
  if (d.prioridade !== undefined) r.prioridade = d.prioridade;
  if (d.statusAuditoria !== undefined) r.status_auditoria = d.statusAuditoria;
  if (d.problemasEncontrados !== undefined) r.problemas_encontrados = d.problemasEncontrados;
  if (d.oportunidades !== undefined) r.oportunidades = d.oportunidades;
  if (d.proximaAcao !== undefined) r.proxima_acao = d.proximaAcao;
  if (d.agenteRecomendado !== undefined) r.agente_recomendado = d.agenteRecomendado;
  if (d.responsavel !== undefined) r.responsavel = d.responsavel;
  return r;
}

// ---- v1.8: Problemas de anúncio ----

export function problemaParaApp(row: ProblemaAnuncioRow): ProblemaAnuncio {
  return {
    id: row.id,
    auditoriaId: row.auditoria_id,
    tipoProblema: row.tipo_problema as ProblemaAnuncio["tipoProblema"],
    gravidade: row.gravidade as ProblemaAnuncio["gravidade"],
    descricao: row.descricao ?? "",
    sugestaoCorrecao: row.sugestao_correcao ?? "",
    agenteRecomendado: row.agente_recomendado ?? "",
    status: row.status as ProblemaAnuncio["status"],
  };
}

export function problemaParaBanco(d: Partial<ProblemaAnuncio>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.auditoriaId !== undefined) r.auditoria_id = d.auditoriaId;
  if (d.tipoProblema !== undefined) r.tipo_problema = d.tipoProblema;
  if (d.gravidade !== undefined) r.gravidade = d.gravidade;
  if (d.descricao !== undefined) r.descricao = d.descricao;
  if (d.sugestaoCorrecao !== undefined) r.sugestao_correcao = d.sugestaoCorrecao;
  if (d.agenteRecomendado !== undefined) r.agente_recomendado = d.agenteRecomendado;
  if (d.status !== undefined) r.status = d.status;
  return r;
}

// ---- v1.8: Fila de otimização ----

export function filaParaApp(row: FilaOtimizacaoRow): ItemFilaOtimizacao {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    cliente: row.clientes?.empresa ?? "—",
    auditoriaId: row.auditoria_id,
    anuncioId: row.anuncio_id,
    prioridade: row.prioridade as ItemFilaOtimizacao["prioridade"],
    tipoAcao: row.tipo_acao as ItemFilaOtimizacao["tipoAcao"],
    agenteResponsavel: row.agente_responsavel ?? "",
    responsavelHumano: row.responsavel_humano ?? "",
    status: row.status as ItemFilaOtimizacao["status"],
    prazo: row.prazo ?? "",
    resultadoEsperado: row.resultado_esperado ?? "",
    observacoes: row.observacoes ?? "",
    tituloAnuncio: row.auditorias_anuncios?.titulo_atual ?? "",
  };
}

export function filaParaBanco(d: Partial<ItemFilaOtimizacao>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.auditoriaId !== undefined) r.auditoria_id = d.auditoriaId;
  if (d.anuncioId !== undefined) r.anuncio_id = d.anuncioId;
  if (d.prioridade !== undefined) r.prioridade = d.prioridade;
  if (d.tipoAcao !== undefined) r.tipo_acao = d.tipoAcao;
  if (d.agenteResponsavel !== undefined) r.agente_responsavel = d.agenteResponsavel;
  if (d.responsavelHumano !== undefined) r.responsavel_humano = d.responsavelHumano;
  if (d.status !== undefined) r.status = d.status;
  if (d.prazo !== undefined) r.prazo = d.prazo || null;
  if (d.resultadoEsperado !== undefined) r.resultado_esperado = d.resultadoEsperado;
  if (d.observacoes !== undefined) r.observacoes = d.observacoes;
  return r;
}

// ---- v1.8: Execuções em lote ----

export function execucaoLoteParaApp(row: ExecucaoLoteRow): ExecucaoLote {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    cliente: row.clientes?.empresa ?? "—",
    agenteId: row.agente_id,
    agente: row.agentes?.nome ?? "—",
    tipoExecucao: row.tipo_execucao as ExecucaoLote["tipoExecucao"],
    quantidadeItens: Number(row.quantidade_itens ?? 0),
    status: row.status as ExecucaoLote["status"],
    entradaResumo: row.entrada_resumo ?? "",
    saidaResumo: row.saida_resumo ?? "",
    erros: row.erros ?? "",
    responsavel: row.responsavel ?? "",
  };
}

export function execucaoLoteParaBanco(d: Partial<ExecucaoLote>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.agenteId !== undefined) r.agente_id = d.agenteId;
  if (d.tipoExecucao !== undefined) r.tipo_execucao = d.tipoExecucao;
  if (d.quantidadeItens !== undefined) r.quantidade_itens = d.quantidadeItens;
  if (d.status !== undefined) r.status = d.status;
  if (d.entradaResumo !== undefined) r.entrada_resumo = d.entradaResumo;
  if (d.saidaResumo !== undefined) r.saida_resumo = d.saidaResumo;
  if (d.erros !== undefined) r.erros = d.erros;
  if (d.responsavel !== undefined) r.responsavel = d.responsavel;
  return r;
}

// ---- v1.9: Anúncios gerados pela Esteira ----

export function anuncioGeradoParaApp(row: AnuncioGeradoRow): AnuncioGeradoRegistro {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    cliente: row.clientes?.empresa ?? "—",
    produtoId: row.produto_id,
    produto: row.produtos?.nome ?? null,
    auditoriaId: row.auditoria_id,
    marketplace: (row.marketplace ?? "Mercado Livre") as AnuncioGeradoRegistro["marketplace"],
    origem: (row.origem ?? "esteira") as AnuncioGeradoRegistro["origem"],
    tipoExecucao: (row.tipo_execucao ?? "Simulada") as AnuncioGeradoRegistro["tipoExecucao"],
    notaDiagnostico: Number(row.nota_diagnostico ?? 0),
    vereditoA10: (row.veredito_a10 ?? "reprovado") as AnuncioGeradoRegistro["vereditoA10"],
    qtdPendencias: Number(row.qtd_pendencias ?? 0),
    anuncio: (row.anuncio ?? {}) as AnuncioGeradoRegistro["anuncio"],
    status: (row.status ?? "rascunho") as AnuncioGeradoRegistro["status"],
    aprovadoPor: row.aprovado_por ?? "",
    aprovadoEm: row.aprovado_em,
    criadoEm: row.created_at ?? new Date().toISOString(),
    observacoes: row.observacoes ?? "",
    mlItemId: row.ml_item_id ?? null,
    mlPermalink: row.ml_permalink ?? null,
  };
}

export function anuncioGeradoParaBanco(
  d: Partial<AnuncioGeradoRegistro>
): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.clienteId !== undefined) r.cliente_id = d.clienteId;
  if (d.produtoId !== undefined) r.produto_id = d.produtoId;
  if (d.auditoriaId !== undefined) r.auditoria_id = d.auditoriaId;
  if (d.marketplace !== undefined) r.marketplace = d.marketplace;
  if (d.origem !== undefined) r.origem = d.origem;
  if (d.tipoExecucao !== undefined) r.tipo_execucao = d.tipoExecucao;
  if (d.notaDiagnostico !== undefined) r.nota_diagnostico = d.notaDiagnostico;
  if (d.vereditoA10 !== undefined) r.veredito_a10 = d.vereditoA10;
  if (d.qtdPendencias !== undefined) r.qtd_pendencias = d.qtdPendencias;
  if (d.anuncio !== undefined) r.anuncio = d.anuncio;
  if (d.status !== undefined) r.status = d.status;
  if (d.aprovadoPor !== undefined) r.aprovado_por = d.aprovadoPor;
  if (d.aprovadoEm !== undefined) r.aprovado_em = d.aprovadoEm;
  if (d.observacoes !== undefined) r.observacoes = d.observacoes;
  if (d.mlItemId !== undefined) r.ml_item_id = d.mlItemId;
  if (d.mlPermalink !== undefined) r.ml_permalink = d.mlPermalink;
  // criadoEm fica por conta do created_at (default now() no banco)
  return r;
}
