// Anti-corruption layer: converte DTO Canônico ↔ Domínio.
//
// REGRA: nenhuma regra de negócio aqui. O mapper só faz conversão estrutural e
// constrói Value Objects (que validam forma — SKU/EAN/dinheiro). Toda invariante
// e coerência (modo × origem/catálogo, versionamento, transições) fica no domínio
// (ProdutoMestre/Variante). A conversão pode falhar (VO inválido) → devolve o
// Result do domínio, que o use case envolve como erro de aplicação.

import type { Result } from "../../domain/shared/resultado.ts";
import { ok, falha } from "../../domain/shared/resultado.ts";
import { erroDominio } from "../../domain/shared/erros-dominio.ts";
import { SkuOrigem } from "../../domain/shared/value-objects/sku-origem.ts";
import { Ean } from "../../domain/shared/value-objects/ean.ts";
import { Dinheiro } from "../../domain/shared/value-objects/dinheiro.ts";
import { comoId } from "../../domain/shared/value-objects/identificador.ts";
import { ehModoOperacao } from "../../domain/produto-mestre/modo-operacao.ts";
import type { DadosCriacaoProdutoMestre, ProdutoMestre } from "../../domain/produto-mestre/produto-mestre.ts";
import type { DadosVariante, Variante } from "../../domain/produto-mestre/variante.ts";

import type { CriarProdutoMestreCommand } from "../commands/criar-produto-mestre.command.ts";
import type { AdicionarVarianteCommand } from "../commands/adicionar-variante.command.ts";
import type { ProdutoMestreDTO, VarianteDTO } from "../dto/produto-mestre-dto.ts";

/** Constrói um Ean opcional (vazio/null → sem EAN, que é complementar). */
function eanOpcional(bruto: string | null | undefined): Result<Ean | null> {
  if (bruto === null || bruto === undefined || bruto.trim() === "") return ok(null);
  const r = Ean.criar(bruto);
  if (!r.ok) return falha(r.erro);
  return ok(r.valor);
}

// ---- DTO → Domínio ----

export function paraDadosCriacao(
  cmd: CriarProdutoMestreCommand,
  id: string,
  agora: string,
): Result<DadosCriacaoProdutoMestre> {
  const rSku = SkuOrigem.criar(cmd.skuOrigem);
  if (!rSku.ok) return falha(rSku.erro);

  const rEan = eanOpcional(cmd.ean);
  if (!rEan.ok) return falha(rEan.erro);

  const modo = cmd.modoOperacao;
  if (!ehModoOperacao(modo)) {
    return falha(erroDominio("modo_operacao_incoerente", "modo_operacao inválido."));
  }

  return ok({
    id: comoId<"produto_mestre">(id),
    organizacaoId: comoId<"organizacao">(cmd.organizacaoId),
    clienteId: comoId<"cliente">(cmd.clienteId),
    origemProdutoId: comoId<"origem_produto">(cmd.origemProdutoId),
    origemInterna: cmd.origemInterna,
    catalogoId: cmd.catalogoId ? comoId<"catalogo">(cmd.catalogoId) : null,
    modoOperacao: modo,
    skuOrigem: rSku.valor,
    ean: rEan.valor,
    nome: cmd.nome,
    marca: cmd.marca ?? null,
    modelo: cmd.modelo ?? null,
    categoriaZion: cmd.categoriaZion ?? null,
    descricaoBase: cmd.descricaoBase ?? null,
    agora,
  });
}

export function paraDadosVariante(
  cmd: AdicionarVarianteCommand,
  id: string,
): Result<DadosVariante> {
  let skuOrigemVariacao: SkuOrigem | null = null;
  if (cmd.skuOrigemVariacao !== null && cmd.skuOrigemVariacao.trim() !== "") {
    const r = SkuOrigem.criar(cmd.skuOrigemVariacao);
    if (!r.ok) return falha(r.erro);
    skuOrigemVariacao = r.valor;
  }

  const rEan = eanOpcional(cmd.ean);
  if (!rEan.ok) return falha(rEan.erro);

  const rPreco = Dinheiro.criar(cmd.precoVenda);
  if (!rPreco.ok) return falha(rPreco.erro);

  return ok({
    id: comoId<"variante">(id),
    produtoMestreId: comoId<"produto_mestre">(cmd.produtoMestreId),
    skuZion: cmd.skuZion,
    skuOrigemVariacao,
    ean: rEan.valor,
    cor: cmd.cor,
    tamanho: cmd.tamanho,
    precoVenda: rPreco.valor,
  });
}

// ---- Domínio → DTO ----

export function varianteParaDTO(v: Variante): VarianteDTO {
  const custo = v.custoErp;
  return {
    id: v.id,
    skuZion: v.skuZion,
    skuOrigemVariacao: v.skuOrigemVariacao ? v.skuOrigemVariacao.valor : null,
    ean: v.ean ? v.ean.valor : null,
    cor: v.cor,
    tamanho: v.tamanho,
    precoVenda: v.precoVenda.valor,
    estoqueErp: v.estoqueErp,
    custoErp: custo ? custo.valor : null,
  };
}

export function paraDTO(pm: ProdutoMestre): ProdutoMestreDTO {
  return {
    id: pm.id,
    organizacaoId: pm.organizacaoId,
    clienteId: pm.clienteId,
    origemProdutoId: pm.origemProdutoId,
    origemInterna: pm.origemInterna,
    catalogoId: pm.catalogoId,
    modoOperacao: pm.modoOperacao,
    skuOrigem: pm.skuOrigem.valor,
    ean: pm.ean ? pm.ean.valor : null,
    nome: pm.nome,
    marca: pm.marca,
    modelo: pm.modelo,
    categoriaZion: pm.categoriaZion,
    descricaoBase: pm.descricaoBase,
    status: pm.status,
    versaoAtual: pm.versaoAtual,
    variantes: pm.variantes.map(varianteParaDTO),
  };
}
