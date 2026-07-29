// Testes do MagazordConnector — puros, com MagazordApi fake (sem rede).
import { test } from "node:test";
import assert from "node:assert/strict";

import { MagazordConnector } from "./magazord-connector.ts";
import type { MagazordApi } from "./magazord-api.ts";
import type {
  CategoriaMagazordRaw,
  ImagemMagazordRaw,
  ProdutoMagazordRaw,
  VariacaoMagazordRaw,
} from "./tipos-magazord.ts";
import type { ContextoConector } from "../../shared/tipos-conector.ts";
import { chaveIdempotencia } from "../../shared/operacao.ts";

// Prova de compatibilidade com a Application (não a altera; só importa tipos).
import type { CriarProdutoMestreCommand } from "../../../../application/commands/criar-produto-mestre.command.ts";
import { paraDadosCriacao } from "../../../../application/mappers/produto-mestre-mapper.ts";

const PRODUTO: ProdutoMagazordRaw = {
  id: 1,
  codigo: "MZ-001",
  skuFornecedor: "FORN-9",
  ean: "7891234567895",
  nome: "Fone TWS",
  marca: "TechSound",
  modelo: "TS-200",
  descricao: "Fone bluetooth",
  categoria: { id: 10, nome: "Fones", caminho: "Áudio > Fones" },
  variacoes: [{ id: 2, codigo: "MZ-001-P", cor: "Preto", tamanho: "U" }],
  imagens: [{ url: "http://img/1.jpg", principal: true }],
};

class ApiFake implements MagazordApi {
  async buscarProduto(id: string): Promise<ProdutoMagazordRaw | null> {
    return id === "1" ? PRODUTO : null;
  }
  async listarProdutos(): Promise<ProdutoMagazordRaw[]> {
    return [PRODUTO];
  }
  async buscarVariacoes(): Promise<VariacaoMagazordRaw[]> {
    return PRODUTO.variacoes ? [...PRODUTO.variacoes] : [];
  }
  async buscarImagens(): Promise<ImagemMagazordRaw[]> {
    return PRODUTO.imagens ? [...PRODUTO.imagens] : [];
  }
  async listarCategorias(): Promise<CategoriaMagazordRaw[]> {
    return [{ id: 10, nome: "Fones", caminho: "Áudio > Fones" }];
  }
}

function montar() {
  return { api: new ApiFake(), relogio: { agora: () => "2026-07-13T00:00:00.000Z" } };
}

function ctx(): ContextoConector {
  return {
    organizacaoId: "org",
    clienteId: "cli",
    contaExterna: "loja-magazord",
    credencial: { estrategia: "api_key", ref: "cofre://magazord/1" },
  };
}

test("metadados: ERP magazord, capacidades read-only", () => {
  const m = new MagazordConnector(montar()).metadados();
  assert.equal(m.tipo, "erp");
  assert.equal(m.provedor, "magazord");
  assert.equal(m.capacidades.has("sincronizar"), true);
  assert.equal(m.capacidades.has("aplicar"), false);
});

test("lerProduto: converte para o DTO canônico do SDK", async () => {
  const r = await new MagazordConnector(montar()).lerProduto(ctx(), "1");
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.valor.identidade.skuOrigem, "FORN-9");
    assert.equal(r.valor.identidade.erpSku, "MZ-001");
    assert.equal(r.valor.nome, "Fone TWS");
    assert.equal(r.valor.categoriaZion, "Áudio > Fones");
    assert.equal(r.valor.variantes.length, 1);
  }
});

test("lerProduto: inexistente → erro permanente", async () => {
  const r = await new MagazordConnector(montar()).lerProduto(ctx(), "999");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro.codigo, "nao_encontrado");
});

test("listarProdutos / lerVariacoes / lerImagens / lerCategorias", async () => {
  const c = new MagazordConnector(montar());
  const prods = await c.listarProdutos(ctx());
  assert.ok(prods.ok && prods.valor.length === 1);

  const vars = await c.lerVariacoes(ctx(), "1");
  assert.ok(vars.ok && vars.valor.length === 1);
  if (vars.ok) assert.equal(vars.valor[0].precoVenda, undefined); // sem preço (read-only)

  const imgs = await c.lerImagens(ctx(), "1");
  assert.ok(imgs.ok && imgs.valor[0].principal === true);

  const cats = await c.lerCategorias(ctx());
  assert.ok(cats.ok && cats.valor[0].id === "10");
});

test("aplicar: rejeitado como read-only (sem escrita)", async () => {
  const op = { tipo: "publicar" as const, idempotencyKey: chaveIdempotencia(["x"]), payload: {} };
  const r = await new MagazordConnector(montar()).aplicar(ctx(), op);
  assert.equal(r.ok, false);
  assert.equal(r.erro?.codigo, "read_only");
});

test("config inválida NÃO executa (falha segura)", async () => {
  const c = new MagazordConnector(montar());
  const semRef = await c.lerProduto(
    { ...ctx(), credencial: { estrategia: "api_key", ref: "" } },
    "1",
  );
  assert.equal(semRef.ok, false);
  if (!semRef.ok) assert.equal(semRef.erro.codigo, "credencial_ausente");

  const estrategiaErrada = await c.testarConexao({
    ...ctx(),
    credencial: { estrategia: "oauth2", ref: "x" },
  });
  assert.equal(estrategiaErrada.ok, false);
  if (!estrategiaErrada.ok) assert.equal(estrategiaErrada.erro.codigo, "estrategia_invalida");
});

test("testarConexao ok; sincronizar devolve resumo de leitura", async () => {
  const c = new MagazordConnector(montar());
  const saude = await c.testarConexao(ctx());
  assert.ok(saude.ok && saude.valor.ok === true);

  const sync = await c.sincronizar(ctx(), { modo: "completo" });
  assert.ok(sync.ok && sync.valor.lidos === 1);
});

test("CRITÉRIO DE ACEITE: Magazord → canônico → Application (CriarProdutoMestreCommand → domínio)", async () => {
  const r = await new MagazordConnector(montar()).lerProduto(ctx(), "1");
  assert.ok(r.ok);
  if (!r.ok) return;
  const p = r.valor;

  const comando: CriarProdutoMestreCommand = {
    organizacaoId: "org",
    clienteId: "cli",
    origemProdutoId: "ori",
    origemInterna: false,
    catalogoId: null,
    modoOperacao: "revenda",
    skuOrigem: p.identidade.skuOrigem,
    ean: p.identidade.ean,
    nome: p.nome,
    marca: p.marca,
    modelo: p.modelo,
    categoriaZion: p.categoriaZion,
    descricaoBase: p.descricaoBase,
  };

  // A Application aceita e converte para o domínio sem perda — compatibilidade total.
  const dados = paraDadosCriacao(comando, "pm-1", "2026-07-13T00:00:00.000Z");
  assert.ok(dados.ok, dados.ok ? "" : dados.erro.message);
  if (dados.ok) {
    assert.equal(dados.valor.skuOrigem.valor, "FORN-9");
    assert.equal(dados.valor.nome, "Fone TWS");
  }
});
