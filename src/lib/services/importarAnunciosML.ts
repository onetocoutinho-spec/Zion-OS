// Importar os anúncios JÁ cadastrados na conta do ML → base do sistema.
//
// Puxa os itens do vendedor (via /api/ml/importar-anuncios) e traz pro sistema,
// pra: (1) montar a base sem planilha, a partir do que já está no ar; e
// (2) não duplicar na publicação (cada anúncio já vem vinculado ao MLB).
//
// AGRUPAMENTO por família (modelo User Products, ex.: chinelo): no ML cada
// TAMANHO é um MLB separado. Aqui reunimos os itens da mesma família
// (user_product_id / family_name) em UM produto com variações de tamanho,
// mas mantemos 1 registro de anúncio por MLB — assim a vinculação SKU↔MLB
// do ERP continua por tamanho.
//
// Idempotente: pula os MLBs já importados.

import { buscarCanal, atualizarRefreshToken } from "./canaisMarketplace";
import { criarProdutos } from "./produtos";
import { criarVariantesBulk } from "./produtoVariantes";
import {
  criarAnunciosGeradosBulk,
  listarAnunciosGeradosDoCliente,
} from "./anunciosGerados";
import type { AnuncioML } from "../marketplaces/mercadolivre";
import type { AnuncioGerado } from "../agentes/esteira";
import type { BaseProduto } from "./importacaoProdutos";
import type { ProdutoVariante } from "../types";

export interface ResultadoImportacaoAnuncios {
  produtos: number;
  anuncios: number;
  variacoes: number;
  pulados: number;
  aviso?: string;
}

/** Um grupo vira 1 produto. Família = vários MLBs (User Products); senão = 1 MLB. */
type Grupo = AnuncioML[];

/** É família (produto com variações de tamanho vindas de MLBs separados)? */
function ehFamilia(g: Grupo): boolean {
  const rep = g[0];
  return g.length > 1 || (rep.variacoes.length === 0 && Boolean(rep.familyId || rep.familyName));
}

/** Reúne os itens por família (ou por MLB, quando não há família). */
function agrupar(anuncios: AnuncioML[]): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const a of anuncios) {
    const chave =
      a.variacoes.length === 0 && (a.familyId || a.familyName)
        ? `fam:${a.familyId || a.familyName.toLowerCase()}`
        : `mlb:${a.mlb}`;
    const lista = mapa.get(chave) ?? [];
    lista.push(a);
    mapa.set(chave, lista);
  }
  return [...mapa.values()];
}

function baseProdutoDoGrupo(g: Grupo): BaseProduto {
  const rep = g[0];
  const familia = ehFamilia(g);
  const classica = rep.variacoes.length > 0;
  const comVariacao = familia || classica;
  const estoque = familia
    ? g.reduce((s, a) => s + a.estoque, 0)
    : classica
      ? rep.variacoes.reduce((s, v) => s + v.estoque, 0)
      : rep.estoque;
  return {
    nome: (familia ? rep.familyName || rep.titulo : rep.titulo) || "Anúncio do ML",
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
    observacoes: familia
      ? `Importado do ML (família com ${g.length} tamanho(s)). Complete o custo para a margem.`
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
    return { produtos: 0, anuncios: 0, variacoes: 0, pulados: 0, aviso: "Cliente não conectado ao Mercado Livre." };
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
    return { produtos: 0, anuncios: 0, variacoes: 0, pulados: 0, aviso: dados.erro ?? "Falha ao importar anúncios." };
  }

  const anuncios = (dados.anuncios ?? []).filter((a) => a.mlb);

  // Anti-duplicidade: pula os MLBs já importados.
  const existentes = await listarAnunciosGeradosDoCliente(clienteId);
  const jaTem = new Set(existentes.map((e) => e.mlItemId).filter(Boolean));
  const novos = anuncios.filter((a) => !jaTem.has(a.mlb));
  const pulados = anuncios.length - novos.length;

  if (novos.length === 0) return { produtos: 0, anuncios: 0, variacoes: 0, pulados };

  // Agrupa por família → 1 produto por grupo.
  const grupos = agrupar(novos);

  // 1) Produtos (ordem preservada).
  const criados = await criarProdutos(
    grupos.map((g) => ({ ...baseProdutoDoGrupo(g), clienteId, cliente }))
  );

  // 2) Variações (por tamanho na família; internas no clássico).
  const variantes: Omit<ProdutoVariante, "id">[] = [];
  criados.forEach((prod, gi) => {
    const g = grupos[gi];
    const rep = g[0];
    if (rep.variacoes.length > 0) {
      rep.variacoes.forEach((v) => variantes.push(varianteClassica(prod.id, clienteId, v)));
    } else if (ehFamilia(g)) {
      g.forEach((a) => variantes.push(varianteDeItem(prod.id, clienteId, a)));
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

  return {
    produtos: criados.length,
    anuncios: anunciosPayload.length,
    variacoes: variantes.length,
    pulados,
  };
}
