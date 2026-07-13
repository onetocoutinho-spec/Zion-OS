// Tradução Domain ↔ linha do banco (tabelas canônicas produto_mestre / 020 e
// produto_mestre_versao / 021). SOMENTE tradução — nenhuma regra de negócio,
// nenhuma decisão de domínio. A reconstrução usa ProdutoMestre.reconstituir
// (reidratação sem eventos).
//
// Gaps conhecidos (documentados no PR): o agregado NÃO modela `origem_tipo`
// (derivado de `origemInterna`, denormalização lossy), `erp_sku` nem `seo` — o
// mapper grava default/null nessas colunas. `variante` não tem tabela nas
// 017–021 (o Intake produz mestres sem variantes), então variantes não são
// persistidas aqui.

import type { LinhaDb } from "../shared/supabase-context.ts";
import { ProdutoMestre } from "../../../../domain/produto-mestre/produto-mestre.ts";
import { SkuOrigem } from "../../../../domain/shared/value-objects/sku-origem.ts";
import { Ean } from "../../../../domain/shared/value-objects/ean.ts";
import { comoId } from "../../../../domain/shared/value-objects/identificador.ts";
import { ehModoOperacao } from "../../../../domain/produto-mestre/modo-operacao.ts";
import type { StatusProdutoMestre } from "../../../../domain/produto-mestre/estados.ts";
import type {
  Autor,
  CampoDiff,
  ProdutoMestreVersao,
  TipoAutor,
} from "../../../../domain/produto-mestre/versao.ts";

// ---- Domain → banco ----

export function paraLinha(pm: ProdutoMestre): LinhaDb {
  return {
    id: pm.id,
    organizacao_id: pm.organizacaoId,
    cliente_id: pm.clienteId,
    origem_produto_id: pm.origemProdutoId,
    // Denormalização derivada: o agregado só modela `origemInterna` (bool).
    origem_tipo: pm.origemInterna ? "marca_propria" : "fornecedor",
    catalogo_id: pm.catalogoId,
    modo_operacao: pm.modoOperacao,
    sku_origem: pm.skuOrigem.valor,
    ean: pm.ean ? pm.ean.valor : null,
    erp_sku: null, // agregado não modela erp_sku (gap conhecido)
    nome: pm.nome,
    marca: pm.marca,
    modelo: pm.modelo,
    categoria_zion: pm.categoriaZion,
    descricao_base: pm.descricaoBase,
    seo: {}, // agregado não modela seo
    status: pm.status,
    versao_atual: pm.versaoAtual,
  };
}

export function paraLinhasVersao(pm: ProdutoMestre): LinhaDb[] {
  return pm.versoes.map((v) => ({
    produto_mestre_id: pm.id,
    organizacao_id: pm.organizacaoId,
    cliente_id: pm.clienteId,
    versao: v.versao,
    snapshot: v.snapshot,
    diff: v.diff,
    autor_tipo: v.autor.tipo,
    autor_id: v.autor.id,
    agente_codigo: v.autor.agenteCodigo ?? null,
    confianca: v.autor.confianca ?? null,
  }));
}

// ---- banco → Domain ----

function opcional(valor: unknown): string | null {
  return valor === null || valor === undefined ? null : String(valor);
}

function versaoParaDominio(linha: LinhaDb): ProdutoMestreVersao {
  const autor: Autor = {
    tipo: String(linha.autor_tipo) as TipoAutor,
    id: String(linha.autor_id ?? ""),
    agenteCodigo: linha.agente_codigo != null ? String(linha.agente_codigo) : undefined,
    confianca: linha.confianca != null ? Number(linha.confianca) : undefined,
  };
  return {
    versao: Number(linha.versao),
    snapshot: (linha.snapshot as Record<string, unknown>) ?? {},
    diff: (linha.diff as CampoDiff[]) ?? [],
    autor,
    occurred_at: String(linha.created_at ?? ""),
  };
}

export function paraDominio(linha: LinhaDb, linhasVersao: ReadonlyArray<LinhaDb> = []): ProdutoMestre {
  const rSku = SkuOrigem.criar(String(linha.sku_origem ?? ""));
  if (!rSku.ok) {
    throw new Error(`produto_mestre.sku_origem inválido no banco: ${rSku.erro.message}`);
  }

  let ean: Ean | null = null;
  if (linha.ean != null && String(linha.ean).trim() !== "") {
    const rEan = Ean.criar(String(linha.ean));
    if (!rEan.ok) throw new Error(`produto_mestre.ean inválido no banco: ${rEan.erro.message}`);
    ean = rEan.valor;
  }

  const modo = String(linha.modo_operacao);
  if (!ehModoOperacao(modo)) {
    throw new Error(`produto_mestre.modo_operacao inválido no banco: ${modo}`);
  }

  const versoes = linhasVersao.map(versaoParaDominio).sort((a, b) => a.versao - b.versao);

  return ProdutoMestre.reconstituir({
    id: comoId<"produto_mestre">(String(linha.id)),
    organizacaoId: comoId<"organizacao">(String(linha.organizacao_id)),
    clienteId: comoId<"cliente">(String(linha.cliente_id)),
    origemProdutoId: comoId<"origem_produto">(String(linha.origem_produto_id)),
    catalogoId: linha.catalogo_id != null ? comoId<"catalogo">(String(linha.catalogo_id)) : null,
    modoOperacao: modo,
    skuOrigem: rSku.valor,
    ean,
    nome: String(linha.nome ?? ""),
    marca: opcional(linha.marca),
    modelo: opcional(linha.modelo),
    categoriaZion: opcional(linha.categoria_zion),
    descricaoBase: opcional(linha.descricao_base),
    // A tabela garante o domínio de valores (CHECK status); aqui só traduzimos.
    status: String(linha.status) as StatusProdutoMestre,
    versaoAtual: Number(linha.versao_atual ?? 1),
    criadoEm: String(linha.created_at ?? ""),
    atualizadoEm: String(linha.updated_at ?? ""),
    versoes,
  });
}
