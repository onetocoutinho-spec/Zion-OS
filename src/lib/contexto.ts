// Monta blocos de contexto textual a partir dos dados cadastrados no sistema,
// para injetar nas execuções de Agentes IA. Funções puras: recebem as
// entidades já carregadas e devolvem texto estruturado em Markdown.

import { formatBRL, formatDate } from "./format";
import { montarTabelaMedidas } from "./data/tabelasMedidas";
import type { Anuncio, Cliente, Produto, ProdutoVariante, TabelaMedida } from "./types";

export function contextoDoCliente(c: Cliente): string {
  return [
    `## Cliente`,
    `- Empresa: ${c.empresa}`,
    `- Responsável: ${c.responsavel}`,
    `- Segmento: ${c.segmento}`,
    `- Marketplaces ativos: ${c.marketplaces.join(", ") || "nenhum"}`,
    `- Plano: ${c.plano} · Status: ${c.status} · Risco: ${c.risco}`,
    `- Cliente desde: ${formatDate(c.dataEntrada)}`,
    `- Próxima ação combinada: ${c.proximaAcao}`,
    c.observacoes ? `- Observações da equipe: ${c.observacoes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function contextoDoProduto(p: Produto): string {
  return [
    `## Produto`,
    `- Nome: ${p.nome}`,
    `- Marca/Modelo: ${p.marca} / ${p.modelo}`,
    `- Categoria: ${p.categoria}`,
    `- SKU: ${p.sku} · Variação: ${p.cor} / ${p.tamanho}`,
    `- Custo: ${formatBRL(p.custo)} · Preço de venda: ${formatBRL(p.precoVenda)} · Estoque: ${p.estoque} un.`,
    `- Marketplace: ${p.marketplace}`,
    `- Status: cadastro ${p.statusCadastro} · SEO ${p.statusSeo} · descrição ${p.statusDescricao} · imagens ${p.statusImagens} · precificação ${p.statusPrecificacao}`,
    `- Prioridade: ${p.prioridade}`,
    p.observacoes ? `- Observações da equipe: ${p.observacoes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Grade de variações (cor/tamanho/SKU/EAN/estoque/preço) já cadastradas. */
export function contextoDasVariacoes(vs: ProdutoVariante[]): string {
  if (vs.length === 0) return "";
  const linhas = vs.slice(0, 80).map((v) => {
    const partes = [
      v.cor ? `Cor: ${v.cor}` : null,
      v.tamanho ? `Tam: ${v.tamanho}` : null,
      v.sku ? `SKU: ${v.sku}` : null,
      v.ean ? `EAN: ${v.ean}` : null,
      `Estoque: ${v.estoque}`,
      v.precoBase ? `Preço: ${formatBRL(v.precoBase)}` : null,
    ].filter(Boolean);
    return `- ${partes.join(" · ")}`;
  });
  const extra = vs.length > 80 ? [`- …(+${vs.length - 80} variações)`] : [];
  return [
    `## Variações cadastradas (${vs.length})`,
    "Estas são as variações reais já cadastradas — use-as; não peça como pendência.",
    ...linhas,
    ...extra,
  ].join("\n");
}

export function contextoDoAnuncio(a: Anuncio): string {
  return [
    `## Anúncio`,
    `- Produto anunciado: ${a.produto}`,
    `- Marketplace: ${a.marketplace}`,
    a.link !== "—" ? `- Link: ${a.link}` : null,
    `- Título atual: ${a.tituloAtual}`,
    `- Título otimizado (proposto): ${a.tituloOtimizado}`,
    `- Esteira: SEO ${a.statusSeo} · descrição ${a.statusDescricao} · imagens ${a.statusImagens} · precificação ${a.statusPrecificacao} · concorrência ${a.statusConcorrencia} · revisão ${a.statusRevisao} · publicação ${a.statusPublicacao}`,
    `- Próxima ação: ${a.proximaAcao}`,
    `- Responsável na agência: ${a.responsavel}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface EntidadesContexto {
  cliente?: Cliente | null;
  produto?: Produto | null;
  anuncio?: Anuncio | null;
  variantes?: ProdutoVariante[] | null;
  /** Tabelas de medidas do cliente (por marca) — têm prioridade. */
  tabelasMedidas?: TabelaMedida[] | null;
}

/** Tabela de medidas (numeração → cm) resolvida por override/marca/padrão. */
export function contextoDaTabelaMedidas(
  produto: Produto,
  variantes: ProdutoVariante[],
  tabelasCliente: TabelaMedida[] = []
): string {
  const tamanhos = variantes.map((v) => v.tamanho).filter(Boolean);
  const r = montarTabelaMedidas({
    marca: produto.marca,
    tamanhos,
    override: produto.tabelaMedidasOverride,
    tabelasCliente,
  });
  if (r.fonte === "vazio" || !r.tabela) return "";
  const nota =
    r.fonte === "override"
      ? "(informada para este produto)"
      : r.fonte === "marca"
        ? r.oficial
          ? "(tabela oficial da marca)"
          : "(tabela da marca — referência, confirmar no modelo)"
        : "(referência padrão BR — confira antes de publicar)";
  return [
    `## Tabela de medidas ${nota}`,
    "Use ESTA tabela de medidas — não peça como pendência.",
    r.tabela,
    "",
    r.comoMedir,
  ].join("\n");
}

/** Junta as seções presentes num único bloco de contexto. */
export function montarContexto({
  cliente,
  produto,
  anuncio,
  variantes,
  tabelasMedidas,
}: EntidadesContexto): string {
  const vs = variantes ?? [];
  return [
    cliente ? contextoDoCliente(cliente) : null,
    produto ? contextoDoProduto(produto) : null,
    vs.length > 0 ? contextoDasVariacoes(vs) : null,
    produto ? contextoDaTabelaMedidas(produto, vs, tabelasMedidas ?? []) || null : null,
    anuncio ? contextoDoAnuncio(anuncio) : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Resumo curto do contexto para exibir na tela e gravar no histórico. */
export function resumoDoContexto({ cliente, produto, anuncio }: EntidadesContexto): string {
  return [cliente?.empresa, produto?.nome ?? anuncio?.produto]
    .filter(Boolean)
    .join(" · ");
}
