// Testes do mapper de anticorrupção — puros.
import { test } from "node:test";
import assert from "node:assert/strict";

import { paraDadosCriacao, paraDTO } from "./produto-mestre-mapper.ts";
import { ProdutoMestre } from "../../domain/produto-mestre/produto-mestre.ts";
import type { CriarProdutoMestreCommand } from "../commands/criar-produto-mestre.command.ts";

const cmd: CriarProdutoMestreCommand = {
  organizacaoId: "org",
  clienteId: "cli",
  origemProdutoId: "ori",
  origemInterna: false,
  catalogoId: null,
  modoOperacao: "revenda",
  skuOrigem: "ts-200",
  ean: null,
  nome: "Fone",
};

test("paraDadosCriacao: normaliza o SKU (VO) e carrega o id", () => {
  const r = paraDadosCriacao(cmd, "pm-1", "t0");
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.valor.skuOrigem.valor, "TS-200");
    assert.equal(r.valor.id, "pm-1");
    assert.equal(r.valor.modoOperacao, "revenda");
  }
});

test("paraDadosCriacao: modo inválido → falha (sem regra de negócio, só forma)", () => {
  const r = paraDadosCriacao({ ...cmd, modoOperacao: "xpto" }, "pm-1", "t0");
  assert.equal(r.ok, false);
});

test("paraDadosCriacao: SKU vazio → falha de VO", () => {
  const r = paraDadosCriacao({ ...cmd, skuOrigem: "  " }, "pm-1", "t0");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro.codigo, "sku_origem_invalido");
});

test("paraDTO: Domínio → DTO expõe conteúdo, status e SKU normalizado", () => {
  const dados = paraDadosCriacao(cmd, "pm-1", "t0");
  assert.ok(dados.ok);
  if (!dados.ok) return;
  const pm = ProdutoMestre.criarRascunho(dados.valor);
  assert.ok(pm.ok);
  if (!pm.ok) return;
  const dto = paraDTO(pm.valor);
  assert.equal(dto.skuOrigem, "TS-200");
  assert.equal(dto.status, "rascunho");
  assert.equal(dto.nome, "Fone");
  assert.equal(dto.versaoAtual, 1);
  assert.equal(dto.variantes.length, 0);
});
