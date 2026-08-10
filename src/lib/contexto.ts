// Monta blocos de contexto textual a partir dos dados cadastrados no sistema,
// para injetar nas execuções de Agentes IA. Funções puras: recebem as
// entidades já carregadas e devolvem texto estruturado em Markdown.

import { formatBRL, formatDate } from "./format";
import { montarTabelaMedidas } from "../modules/catalog/domain/tabelasMedidas";
import type { Cliente, Produto, ProdutoVariante, TabelaMedida } from "./types";

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
    // `observacoes` NÃO entra: ela descreve o PROCESSO, não o produto.
    //
    // A importação grava ali "Complete o custo para a margem" e nunca mais
    // atualiza. Num produto com custo R$ 44,31 cadastrado, o contexto afirmava
    // o custo numa linha e mandava completá-lo três linhas abaixo — e a IA
    // acreditou na frase mais explícita, listando "Custo do produto" como
    // pendência. Pendência falsa trava a publicação para sempre.
    //
    // Mesma família do preço mínimo fantasma de R$ 1,77 e da leitura por MAX:
    // dado que foi verdade uma vez, não é mais, e ninguém o revisita.
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

/** Composição do kit/combo — para a IA descrever como conjunto. */
export function contextoDoKit(produto: Produto): string {
  const cs = produto.componentes ?? [];
  const ehKit = produto.tipoProduto === "kit" || produto.tipoProduto === "combo";
  if (!ehKit || cs.length === 0) return "";
  const linhas = cs.map(
    (c) =>
      `- ${c.quantidade}x ${c.nome}${c.sku ? ` (SKU ${c.sku})` : ""}${c.brinde ? " — BRINDE (grátis)" : ""}`
  );
  return [
    `## Kit / combo (${produto.tipoProduto})`,
    "Este anúncio é um CONJUNTO — descreva como kit, deixe claro tudo o que vem incluso e destaque o brinde, se houver. O preço é do kit inteiro.",
    ...linhas,
  ].join("\n");
}

export interface EntidadesContexto {
  cliente?: Cliente | null;
  /**
   * Quantas fotos o produto JÁ tem.
   *
   * A esteira pedia "imagens reais do produto" como pendência de um item com
   * 8 fotos cadastradas — porque ninguém lhe dizia que existiam. Pendência
   * falsa trava a publicação para sempre: publicar exige a lista vazia.
   */
  quantidadeFotos?: number | null;
  /**
   * O bloco de atributos obrigatórios do marketplace, já resolvido contra o
   * cadastro (`publication/domain/atributosDoMarketplace`).
   *
   * Sem ele o A10 inventava requisito: cobrava "antiderrapante", "vegano" e
   * "materiais reciclados" — medido na API do ML, NENHUM existe na categoria
   * de calçados — e não cobrava Gênero nem Tipo de calçado, que são
   * obrigatórios de verdade. Rigor no lugar errado trava a publicação, porque
   * publicar exige a lista de pendências vazia.
   */
  atributosObrigatorios?: string | null;
  produto?: Produto | null;
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
  variantes,
  tabelasMedidas,
  quantidadeFotos,
  atributosObrigatorios,
}: EntidadesContexto): string {
  const vs = variantes ?? [];
  return [
    cliente ? contextoDoCliente(cliente) : null,
    atributosObrigatorios && atributosObrigatorios.trim() ? atributosObrigatorios : null,
    typeof quantidadeFotos === "number"
      ? `FOTOS: ${quantidadeFotos} imagem(ns) já cadastrada(s) para este produto. ` +
        `NÃO liste "imagens do produto" como pendência quando houver ao menos uma.`
      : null,
    produto ? contextoDoProduto(produto) : null,
    produto ? contextoDoKit(produto) || null : null,
    vs.length > 0 ? contextoDasVariacoes(vs) : null,
    produto ? contextoDaTabelaMedidas(produto, vs, tabelasMedidas ?? []) || null : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Resumo curto do contexto para exibir na tela e gravar no histórico. */
export function resumoDoContexto({ cliente, produto }: EntidadesContexto): string {
  return [cliente?.empresa, produto?.nome]
    .filter(Boolean)
    .join(" · ");
}
