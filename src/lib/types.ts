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
  /** A agência que opera a loja; `null` = loja sem agência (self-service). */
  agenciaId: string | null;
}

export type CadastroStatus = "Não iniciado" | "Em cadastro" | "Publicado" | "Com erro";

/**
 * Tipo do produto pai — determina se ele tem derivações (variantes) e como.
 * v1.7: modelagem universal de marketplace.
 */
export type TipoProduto = "simples" | "com_variacao" | "kit" | "combo" | "catalogo";

/** Item que compõe um kit/combo (produto da base ou item livre). */
export interface KitComponente {
  /** Referência opcional a um produto da base. */
  produtoId?: string;
  nome: string;
  sku?: string;
  quantidade: number;
  /** Item grátis/brinde incluso. */
  brinde?: boolean;
}

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
  /**
   * O vendedor paga o frete deste produto? undefined = não se sabe, e o
   * cálculo assume que paga (supor o contrário inflaria a margem).
   */
  vendedorPagaFrete?: boolean;
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
  /**
   * Id da categoria do Mercado Livre DECIDIDA para este produto ("MLB273770").
   *
   * Diferente de `categoriaMarketplaceSugerida`, que é rótulo em texto livre:
   * uma publica, a outra explica. Vazio = ninguém decidiu, e aí os obrigatórios
   * cobrados são um palpite — ver `obrigatoriosDoProduto`.
   */
  categoriaMl?: string;
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
  /**
   * Margem % no momento da importação — RETRATO, não valor vivo.
   * A fórmula vive só em `modules/pricing/domain/modeloPreco`; repeti-la aqui
   * foi o que fez este comentário e os prompts da IA ficarem para trás quando
   * as taxas reais do ML foram corrigidas. Ausente quando não é calculável.
   */
  margem?: number;
  /** Confiança do custo (fonte): alta | media | baixa. */
  confiancaCusto?: "alta" | "media" | "baixa" | "";
  /**
   * Override da tabela de medidas DESTE produto (texto). Quando preenchido,
   * vence a tabela da marca. Use só quando o produto foge do padrão.
   */
  tabelaMedidasOverride?: string;
  /** Componentes do kit/combo (quando tipoProduto = "kit" | "combo"). */
  componentes?: KitComponente[];
}

/** Uma linha de tabela de medidas: rótulo (numeração/tamanho) → valor (medida). */
export interface LinhaMedida {
  rotulo: string;
  valor: string;
}

/** Tabela de medidas gerenciada pelo cliente (por marca ou avulsa). */
export interface TabelaMedida {
  id: string;
  clienteId: string;
  nome: string;
  /** Quando preenchida, aplica a todos os produtos desta marca. */
  marca: string;
  comoMedir: string;
  linhas: LinhaMedida[];
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
  /**
   * O tenant. Obrigatório desde a migração 049 — ver o `.sql` para o porquê.
   *
   * Esta era a ÚNICA tabela do catálogo sem escopo de cliente, e por isso o
   * enriquecimento a partir do ML batia em RLS quando disparado pela lojista:
   * ela alcançava a tela e não podia escrever; a equipe podia escrever e não
   * alcançava a tela.
   */
  clienteId: string;
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
  /**
   * Dimensão em pixels, medida NO UPLOAD (migração 075).
   *
   * `null` = não medimos, nunca "não tem". As fotos anteriores a 11/08/2026
   * nasceram sem medida, e tratá-las como zero faria toda a base parecer
   * inválida.
   *
   * Medir aqui, no arquivo que a lojista escolheu, também evita a armadilha do
   * CDN: a `url` guardada aponta para a variante de 500px do Mercado Livre, e
   * medi-la diria "nenhuma foto serve" sobre originais de 1200.
   */
  largura: number | null;
  altura: number | null;
  /**
   * A cor desta foto, na MESMA string de `produto_variantes.cor` (migração 076).
   *
   * `null` = não sabemos de que cor é — NUNCA "serve para todas". Os anúncios
   * desta base são um por cor e tamanho, e usar foto de cor desconhecida numa
   * variante colorida troca uma infração de foto por uma de "o anúncio não
   * corresponde ao produto" — a categoria com que o ML já pausou 25 anúncios
   * desta conta.
   */
  cor: string | null;
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

/**
 * O estado do anúncio NO MARKETPLACE — a palavra dele, sem tradução.
 *
 * `active | paused | under_review | closed | inactive` no ML. Guardamos
 * verbatim porque normalizar exigiria um mapa nosso, e no dia em que o ML
 * criar um estado novo o mapa o engoliria em silêncio. A tradução para a
 * lojista acontece na tela, onde errar é visível.
 *
 * `null` significa NÃO SABEMOS — nunca "está no ar".
 */
export type StatusMarketplace = string;

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
  // ---- Fase 3: publicação no marketplace ----
  /**
   * A categoria do item NO MERCADO LIVRE — migração 056.
   *
   * `null` = nunca lida. É ela que permite pedir a tarifa exata; sem ela o ML
   * devolve `null` e a precificação cai na tabela, que erra por categoria.
   */
  categoriaMl?: string | null;
  /** ID do item no Mercado Livre (ex.: MLB123...), após publicar. */
  mlItemId?: string | null;
  /** Link público do anúncio no ML. */
  mlPermalink?: string | null;
  /**
   * O estado NO MARKETPLACE, na palavra dele. Eixo INDEPENDENTE de `status`.
   *
   * `status` é a esteira do Zion (rascunho → aprovado → publicado); este é o
   * ML. Um anúncio pode ser `publicado` aqui e `paused` lá ao mesmo tempo — as
   * duas afirmações são verdadeiras e nenhuma substitui a outra.
   *
   * Existe porque o importador gravava `status: "publicado"` fixo. Medido em
   * 2026-08-01: 104 dos 511 anúncios que o Zion dizia publicados não estavam
   * no ar — 52 em revisão, 38 pausados, 12 encerrados, 2 inativos.
   *
   * `null` = não sabemos. Nunca "está no ar".
   */
  statusMarketplace?: StatusMarketplace | null;
  /**
   * Quando aprendemos esse estado.
   *
   * Um estado sem data parece atual e não é: "paused" lido há três semanas é
   * palpite vestido de fato.
   */
  statusMarketplaceEm?: string | null;
  /**
   * POR QUE o anúncio não está no ar — a palavra do ML (`forbidden`,
   * `waiting_for_patch`, `out_of_stock`). Migração 051.
   *
   * Foi este campo que revelou 6 infrações de propriedade intelectual que
   * ninguém sabia existirem. Até a 051 ele era medido a cada leitura e
   * descartado — sumia num F5.
   *
   * `null` = não sabemos. Lista vazia = o ML leu e não apontou nada.
   */
  subStatusMarketplace?: string[] | null;
  /** O tamanho REAL da capa, como o ML declara em `max_size`. */
  fotoCapaMaxSize?: string | null;
  /**
   * O estoque NO MARKETPLACE — não o do ERP.
   *
   * É ele que ordena o trabalho: 802 peças paradas vêm antes de 3. O estoque
   * do ERP não serve, porque o que interessa é o que está parado NA VITRINE.
   */
  estoqueMarketplace?: number | null;
  /**
   * 074 — o que o ML já dizia e a importação descartava.
   *
   * `tipoAnuncioMl` vem CRU (`gold_pro`/`gold_special`). A tradução para
   * Premium/Clássico é decisão de domínio e mora em `custosML`: guardar já
   * traduzido faria um tipo novo do ML virar "clássico" em silêncio.
   *
   * `null` em todos = não lido. Nunca zero, nunca false por omissão — a mesma
   * regra de `statusMarketplace`.
   */
  tipoAnuncioMl?: string | null;
  criadoEmMl?: string | null;
  atualizadoEmMl?: string | null;
  vendidosMl?: number | null;
  saudeMl?: number | null;
  doCatalogoMl?: boolean | null;
  temDescricaoMl?: boolean | null;
}
