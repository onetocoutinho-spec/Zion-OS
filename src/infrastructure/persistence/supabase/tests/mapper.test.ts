// Testes do DB mapper — puros (Domain ↔ linha do banco).
import { test } from "node:test";
import assert from "node:assert/strict";

import { paraDominio, paraLinha, paraLinhasVersao } from "../mappers/produto-mestre-db-mapper.ts";
import type { LinhaDb } from "../shared/supabase-context.ts";
import { ProdutoMestre } from "../../../../domain/produto-mestre/produto-mestre.ts";
import { SkuOrigem } from "../../../../domain/shared/value-objects/sku-origem.ts";
import { comoId } from "../../../../domain/shared/value-objects/identificador.ts";
import type {
  IdCliente,
  IdOrganizacao,
  IdOrigemProduto,
  IdProdutoMestre,
} from "../../../../domain/shared/value-objects/identificador.ts";
import type { Autor } from "../../../../domain/produto-mestre/versao.ts";

const AGORA = "2026-07-13T00:00:00.000Z";
const AUTOR: Autor = { tipo: "agente", id: "zion-intake" };

function sku(v: string): SkuOrigem {
  const r = SkuOrigem.criar(v);
  if (!r.ok) throw new Error("sku de teste inválido");
  return r.valor;
}

function criarPM(): ProdutoMestre {
  const r = ProdutoMestre.criarRascunho({
    id: comoId<"produto_mestre">("pm-1") as IdProdutoMestre,
    organizacaoId: comoId<"organizacao">("org-1") as IdOrganizacao,
    clienteId: comoId<"cliente">("cli-1") as IdCliente,
    origemProdutoId: comoId<"origem_produto">("ori-1") as IdOrigemProduto,
    origemInterna: false,
    catalogoId: null,
    modoOperacao: "revenda",
    skuOrigem: sku("TS-200"),
    ean: null,
    nome: "Fone TWS",
    marca: "TechSound",
    agora: AGORA,
  });
  if (!r.ok) throw new Error("falha ao criar PM de teste");
  return r.valor;
}

/** Simula os defaults do banco (created_at/updated_at) sobre a linha do mapper. */
function comoLinhaBanco(linha: LinhaDb): LinhaDb {
  return { ...linha, created_at: AGORA, updated_at: AGORA };
}

test("paraLinha: mapeia colunas canônicas (snake_case) e denormalizações", () => {
  const linha = paraLinha(criarPM());
  assert.equal(linha.id, "pm-1");
  assert.equal(linha.organizacao_id, "org-1");
  assert.equal(linha.cliente_id, "cli-1");
  assert.equal(linha.origem_produto_id, "ori-1");
  assert.equal(linha.sku_origem, "TS-200");
  assert.equal(linha.modo_operacao, "revenda");
  assert.equal(linha.origem_tipo, "fornecedor"); // derivado de origemInterna=false
  assert.equal(linha.status, "rascunho");
  assert.equal(linha.versao_atual, 1);
});

test("round-trip: paraLinha → paraDominio preserva a identidade e o conteúdo", () => {
  const original = criarPM();
  const linha = comoLinhaBanco(paraLinha(original));
  const restaurado = paraDominio(linha, []);

  assert.equal(restaurado.id, original.id);
  assert.equal(restaurado.organizacaoId, original.organizacaoId);
  assert.equal(restaurado.clienteId, original.clienteId);
  assert.equal(restaurado.origemProdutoId, original.origemProdutoId);
  assert.equal(restaurado.skuOrigem.valor, original.skuOrigem.valor);
  assert.equal(restaurado.modoOperacao, original.modoOperacao);
  assert.equal(restaurado.nome, original.nome);
  assert.equal(restaurado.marca, original.marca);
  assert.equal(restaurado.status, original.status);
  assert.equal(restaurado.versaoAtual, original.versaoAtual);
});

test("reidratação NÃO emite eventos (é leitura, não criação)", () => {
  const linha = comoLinhaBanco(paraLinha(criarPM()));
  const restaurado = paraDominio(linha, []);
  assert.equal(restaurado.puxarEventos().length, 0);
});

test("versões: paraLinhasVersao → paraDominio restaura histórico e versaoAtual", () => {
  const pm = criarPM();
  pm.editarConteudo({ nome: "Fone TWS Pro" }, AUTOR, AGORA); // → versão 2 + 1 histórico
  assert.equal(pm.versaoAtual, 2);

  const linha = comoLinhaBanco(paraLinha(pm));
  const linhasVersao = paraLinhasVersao(pm).map((l) => ({ ...l, created_at: AGORA }));
  assert.equal(linhasVersao.length, 1);

  const restaurado = paraDominio(linha, linhasVersao);
  assert.equal(restaurado.versaoAtual, 2);
  assert.equal(restaurado.versoes.length, 1);
  assert.equal(restaurado.versoes[0].versao, 2);
  assert.equal(restaurado.nome, "Fone TWS Pro");
});
