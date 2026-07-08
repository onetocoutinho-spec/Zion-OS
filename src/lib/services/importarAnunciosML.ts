// Importar os anúncios JÁ cadastrados na conta do ML → base do sistema.
//
// Puxa os itens do vendedor (via /api/ml/importar-anuncios) e traz pro sistema,
// pra: (1) montar a base sem planilha, a partir do que já está no ar; e
// (2) não duplicar na publicação (cada anúncio já vem vinculado ao MLB).
//
// AGRUPAMENTO por família/título: no ML o mesmo modelo costuma virar vários
// MLBs (User Products por tamanho, ou anúncios repetidos com o mesmo título).
// Reunimos em UM produto com variações, mantendo 1 registro de anúncio por MLB
// — assim a vinculação SKU↔MLB do ERP continua por tamanho.
//
// SUBSTITUI: cada importação limpa a importação anterior do ML do cliente e
// reimporta tudo agrupado (sem depender de apagar via SQL, sem duplicar).

import { buscarCanal, atualizarRefreshToken } from "./canaisMarketplace";
import { criarProdutos, excluirProdutosImportadosML } from "./produtos";
import { criarVariantesBulk } from "./produtoVariantes";
import {
  criarAnunciosGeradosBulk,
  excluirAnunciosImportadosML,
} from "./anunciosGerados";
import { criarImagensBulk } from "./imagensProduto";
import type { AnuncioML } from "../marketplaces/mercadolivre";
import type { AnuncioGerado } from "../agentes/esteira";
import type { BaseProduto } from "./importacaoProdutos";
import type { ProdutoVariante, ImagemProduto } from "../types";

/** Máximo de fotos importadas por produto (o ML permite ~10-12 por anúncio). */
const MAX_FOTOS = 10;

export interface ResultadoImportacaoAnuncios {
  produtos: number;
  anuncios: number;
  variacoes: number;
  imagens: number;
  pulados: number;
  aviso?: string;
}

/** Um grupo vira 1 produto. */
type Grupo = AnuncioML[];

/** Quantas unidades de variação o grupo tem (soma de tamanhos/variações). */
function unidades(g: Grupo): number {
  return g.reduce((n, a) => n + (a.variacoes.length > 0 ? a.variacoes.length : 1), 0);
}

function normalizarTitulo(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Reúne os itens do mesmo modelo em um grupo (= 1 produto), em ordem de
 * confiança:
 *  1) `family_name` — o campo que o ML compartilha entre os itens da mesma
 *     família (ex.: mesmo chinelo em tamanhos/cores separados por MLB). É o
 *     sinal mais forte aqui.
 *  2) `user_product_id` COMPARTILHADO por 2+ itens (o ML costuma dar um id
 *     único por item, que sozinho não serve pra agrupar).
 *  3) título normalizado — fallback pra anúncios repetidos sem família.
 */
function agrupar(anuncios: AnuncioML[]): Grupo[] {
  const contFamilia = new Map<string, number>();
  for (const a of anuncios) {
    if (a.familyId) contFamilia.set(a.familyId, (contFamilia.get(a.familyId) ?? 0) + 1);
  }
  const chaveDe = (a: AnuncioML): string => {
    const fam = a.familyName.trim().toLowerCase();
    if (fam) return `fam:${fam}`;
    if (a.familyId && (contFamilia.get(a.familyId) ?? 0) > 1) return `fid:${a.familyId}`;
    const t = normalizarTitulo(a.titulo);
    return t ? `tit:${t}` : `mlb:${a.mlb}`;
  };
  const mapa = new Map<string, Grupo>();
  for (const a of anuncios) {
    const chave = chaveDe(a);
    const lista = mapa.get(chave) ?? [];
    lista.push(a);
    mapa.set(chave, lista);
  }
  return [...mapa.values()];
}

function baseProdutoDoGrupo(g: Grupo): BaseProduto {
  const rep = g[0];
  const comVariacao = unidades(g) > 1;
  const estoque = g.reduce(
    (s, a) => s + (a.variacoes.length > 0 ? a.variacoes.reduce((x, v) => x + v.estoque, 0) : a.estoque),
    0
  );
  return {
    nome: rep.familyName || rep.titulo || "Anúncio do ML",
    marca: rep.marca,
    modelo: rep.modelo,
    categoria: rep.categoria,
    sku: comVariacao ? "" : rep.sku, // com variação, o SKU fica em cada variante
    cor: "",
    tamanho: "",
    custo: 0, // o ML não expõe o custo — o cliente completa depois
    precoVenda: rep.preco,
    estoque,
    marketplace: "Mercado Livre",
    statusCadastro: "Publicado",
    statusSeo: "Concluído",
    statusDescricao: "Concluído",
    statusImagens: "Concluído",
    statusPrecificacao: "Pendente",
    prioridade: "Média",
    observacoes: comVariacao
      ? `Importado do ML (${g.length} anúncio(s), ${unidades(g)} variação(ões)). Complete o custo para a margem.`
      : `Importado do ML (${rep.mlb}). Complete o custo para a margem.`,
    tipoProduto: comVariacao ? "com_variacao" : "simples",
    codErp: comVariacao ? undefined : rep.sku || undefined,
    confiancaCusto: "",
  };
}

/** Variante a partir de um MLB de tamanho (User Products). */
function varianteDeItem(produtoId: string, clienteId: string, a: AnuncioML): Omit<ProdutoVariante, "id"> {
  return {
    produtoId,
    clienteId,
    sku: a.sku,
    codigoInterno: "",
    ean: a.ean,
    cor: a.cor,
    tamanho: a.tamanho,
    voltagem: "",
    sabor: "",
    aroma: "",
    modeloVariacao: "",
    custo: 0,
    precoBase: a.preco,
    estoque: a.estoque,
    peso: 0,
    altura: 0,
    largura: 0,
    comprimento: 0,
    status: "Ativa",
    observacoes: a.mlb, // guarda o MLB deste tamanho
  };
}

/** Variante a partir da variação interna de um anúncio clássico. */
function varianteClassica(
  produtoId: string,
  clienteId: string,
  v: AnuncioML["variacoes"][number]
): Omit<ProdutoVariante, "id"> {
  return {
    produtoId,
    clienteId,
    sku: v.sku,
    codigoInterno: "",
    ean: v.ean,
    cor: v.cor,
    tamanho: v.tamanho,
    voltagem: "",
    sabor: "",
    aroma: "",
    modeloVariacao: "",
    custo: 0,
    precoBase: v.preco,
    estoque: v.estoque,
    peso: 0,
    altura: 0,
    largura: 0,
    comprimento: 0,
    status: "Ativa",
    observacoes: "",
  };
}

function anuncioGeradoDoML(a: AnuncioML): AnuncioGerado {
  const ficha = [
    { atributo: "Marca", valor: a.marca, obrigatorio: true },
    { atributo: "Modelo", valor: a.modelo, obrigatorio: true },
  ].filter((f) => f.valor);
  const variacoes =
    a.variacoes.length > 0
      ? a.variacoes.map((v) => ({
          cor: v.cor,
          tamanho: v.tamanho,
          sku: v.sku,
          ean: v.ean,
          estoque: String(v.estoque),
          preco: String(v.preco),
          obs: "",
        }))
      : a.cor || a.tamanho || a.sku
        ? [
            {
              cor: a.cor,
              tamanho: a.tamanho,
              sku: a.sku,
              ean: a.ean,
              estoque: String(a.estoque),
              preco: String(a.preco),
              obs: "",
            },
          ]
        : [];
  return {
    notaDiagnostico: 0,
    tituloOtimizado: a.titulo,
    palavrasChavePrincipais: [],
    palavrasChaveSecundarias: [],
    descricaoCompleta: "",
    descricaoCurta: "",
    fichaTecnica: ficha,
    tabelaMedidas: "",
    comoMedir: "",
    forma: "nao_aplicavel",
    variacoes,
    imagensSugeridas: [],
    faq: [],
    pendencias: [],
    vereditoA10: "aprovado",
    motivoVeredito: "Importado do Mercado Livre (já publicado).",
  };
}

export async function importarAnunciosDoCliente(
  clienteId: string,
  cliente: string
): Promise<ResultadoImportacaoAnuncios> {
  const canal = await buscarCanal(clienteId, "Mercado Livre");
  if (!canal?.refreshToken) {
    return { produtos: 0, anuncios: 0, variacoes: 0, imagens: 0, pulados: 0, aviso: "Cliente não conectado ao Mercado Livre." };
  }

  const resposta = await fetch("/api/ml/importar-anuncios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: canal.refreshToken, sellerId: canal.sellerId }),
  });
  const dados = (await resposta.json()) as {
    anuncios?: AnuncioML[];
    refreshToken?: string;
    erro?: string;
  };
  if (dados.refreshToken) await atualizarRefreshToken(clienteId, dados.refreshToken, "Mercado Livre");
  if (!resposta.ok) {
    return { produtos: 0, anuncios: 0, variacoes: 0, imagens: 0, pulados: 0, aviso: dados.erro ?? "Falha ao importar anúncios." };
  }

  const anuncios = (dados.anuncios ?? []).filter((a) => a.mlb);
  if (anuncios.length === 0) {
    return { produtos: 0, anuncios: 0, variacoes: 0, imagens: 0, pulados: 0, aviso: "Nenhum anúncio encontrado na conta." };
  }

  // SUBSTITUI: apaga a importação anterior do ML (anúncios + produtos, com as
  // variações em cascata) antes de reimportar — evita duplicar e não depende
  // de limpar via SQL. Só mexe no que foi importado do ML.
  await excluirAnunciosImportadosML(clienteId);
  await excluirProdutosImportadosML(clienteId);

  // Agrupa por família/título → 1 produto por grupo.
  const grupos = agrupar(anuncios);

  // 1) Produtos (ordem preservada).
  const criados = await criarProdutos(
    grupos.map((g) => ({ ...baseProdutoDoGrupo(g), clienteId, cliente }))
  );

  // 2) Variações (por tamanho na família; internas no clássico).
  const variantes: Omit<ProdutoVariante, "id">[] = [];
  criados.forEach((prod, gi) => {
    const g = grupos[gi];
    if (unidades(g) <= 1) return; // produto simples, sem variação
    for (const a of g) {
      if (a.variacoes.length > 0) {
        a.variacoes.forEach((v) => variantes.push(varianteClassica(prod.id, clienteId, v)));
      } else {
        variantes.push(varianteDeItem(prod.id, clienteId, a));
      }
    }
  });
  if (variantes.length > 0) await criarVariantesBulk(variantes);

  // 3) Anúncios: 1 por MLB (mantém SKU↔MLB pro ERP), apontando ao produto do grupo.
  const agora = new Date().toISOString();
  const anunciosPayload = criados.flatMap((prod, gi) =>
    grupos[gi].map((a) => ({
      clienteId,
      cliente,
      produtoId: prod.id,
      produto: prod.nome,
      auditoriaId: null,
      marketplace: "Mercado Livre" as const,
      origem: "esteira" as const,
      tipoExecucao: "Simulada" as const,
      notaDiagnostico: 0,
      vereditoA10: "aprovado" as const,
      qtdPendencias: 0,
      anuncio: anuncioGeradoDoML(a),
      status: "publicado" as const,
      aprovadoPor: "Mercado Livre",
      aprovadoEm: agora,
      criadoEm: agora,
      observacoes: "Importado do Mercado Livre.",
      mlItemId: a.mlb,
      mlPermalink: a.permalink,
    }))
  );
  await criarAnunciosGeradosBulk(anunciosPayload);

  // 4) Imagens: as fotos reais do ML viram imagens do produto (prontas pro
  //    Estúdio IA). Capa = Principal; as demais Secundárias; dedup por URL.
  const imagens: Omit<ImagemProduto, "id">[] = [];
  criados.forEach((prod, gi) => {
    const urls = [...new Set(grupos[gi].flatMap((a) => a.fotos))].slice(0, MAX_FOTOS);
    urls.forEach((url, i) => {
      imagens.push({
        clienteId,
        produtoId: prod.id,
        varianteId: null,
        anuncioId: null,
        tipoImagem: i === 0 ? "Principal" : "Secundária",
        url,
        status: "Aprovada", // é a foto real que já está no anúncio
        observacoes: "Importada do Mercado Livre.",
      });
    });
  });
  if (imagens.length > 0) await criarImagensBulk(imagens);

  return {
    produtos: criados.length,
    anuncios: anunciosPayload.length,
    variacoes: variantes.length,
    imagens: imagens.length,
    pulados: 0,
  };
}
