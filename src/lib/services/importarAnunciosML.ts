// Importar os anúncios JÁ cadastrados na conta do ML → base do sistema.
//
// Puxa os itens do vendedor (via /api/ml/importar-anuncios), cria os produtos
// + variações e registra cada anúncio como "publicado" (com o MLB), pra:
//   1) montar a base sem planilha, a partir do que já está no ar;
//   2) não duplicar na hora de publicar (já vem vinculado ao MLB).
// Idempotente: pula os anúncios cujo MLB já foi importado.

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
  importados: number;
  variacoes: number;
  pulados: number;
  aviso?: string;
}

function baseProdutoDoAnuncio(a: AnuncioML, cliente: string): BaseProduto {
  const temVar = a.variacoes.length > 0;
  const estoque = temVar ? a.variacoes.reduce((s, v) => s + v.estoque, 0) : a.estoque;
  return {
    nome: a.titulo || "Anúncio do ML",
    marca: a.marca,
    modelo: a.modelo,
    categoria: a.categoria,
    sku: a.sku,
    cor: "",
    tamanho: "",
    custo: 0, // o ML não expõe o custo — o cliente completa depois
    precoVenda: a.preco,
    estoque,
    marketplace: "Mercado Livre",
    statusCadastro: "Publicado",
    statusSeo: "Concluído",
    statusDescricao: "Concluído",
    statusImagens: "Concluído",
    statusPrecificacao: "Pendente",
    prioridade: "Média",
    observacoes: `Importado do Mercado Livre (${a.mlb}). Complete o custo para calcular a margem.`,
    tipoProduto: temVar ? "com_variacao" : "simples",
    codErp: a.sku || undefined,
    confiancaCusto: "",
  };
}

function anuncioGeradoDoML(a: AnuncioML): AnuncioGerado {
  const ficha = [
    { atributo: "Marca", valor: a.marca, obrigatorio: true },
    { atributo: "Modelo", valor: a.modelo, obrigatorio: true },
  ].filter((f) => f.valor);
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
    variacoes: a.variacoes.map((v) => ({
      cor: v.cor,
      tamanho: v.tamanho,
      sku: v.sku,
      ean: v.ean,
      estoque: String(v.estoque),
      preco: String(v.preco),
      obs: "",
    })),
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
    return { importados: 0, variacoes: 0, pulados: 0, aviso: "Cliente não conectado ao Mercado Livre." };
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
    return { importados: 0, variacoes: 0, pulados: 0, aviso: dados.erro ?? "Falha ao importar anúncios." };
  }

  const anuncios = (dados.anuncios ?? []).filter((a) => a.mlb);

  // Anti-duplicidade: pula os MLBs já importados.
  const existentes = await listarAnunciosGeradosDoCliente(clienteId);
  const jaTem = new Set(existentes.map((e) => e.mlItemId).filter(Boolean));
  const novos = anuncios.filter((a) => !jaTem.has(a.mlb));
  const pulados = anuncios.length - novos.length;

  if (novos.length === 0) return { importados: 0, variacoes: 0, pulados };

  // 1) Produtos (ordem preservada).
  const produtos = novos.map((a) => ({ ...baseProdutoDoAnuncio(a, cliente), clienteId, cliente }));
  const criados = await criarProdutos(produtos);

  // 2) Variações.
  const variantes: Omit<ProdutoVariante, "id">[] = [];
  criados.forEach((prod, i) => {
    novos[i].variacoes.forEach((v) => {
      variantes.push({
        produtoId: prod.id,
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
      });
    });
  });
  if (variantes.length > 0) await criarVariantesBulk(variantes);

  // 3) Anúncios gerados marcados como publicados (com o MLB) — em lote.
  const agora = new Date().toISOString();
  await criarAnunciosGeradosBulk(
    criados.map((prod, i) => ({
      clienteId,
      cliente,
      produtoId: prod.id,
      produto: prod.nome,
      auditoriaId: null,
      marketplace: "Mercado Livre",
      origem: "esteira" as const,
      tipoExecucao: "Simulada" as const,
      notaDiagnostico: 0,
      vereditoA10: "aprovado" as const,
      qtdPendencias: 0,
      anuncio: anuncioGeradoDoML(novos[i]),
      status: "publicado" as const,
      aprovadoPor: "Mercado Livre",
      aprovadoEm: agora,
      criadoEm: agora,
      observacoes: "Importado do Mercado Livre.",
      mlItemId: novos[i].mlb,
      mlPermalink: novos[i].permalink,
    }))
  );

  return { importados: criados.length, variacoes: variantes.length, pulados };
}
