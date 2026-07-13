// Testes do Zion Intake Engine — puros, com Ports fakes (sem infra).
import { test } from "node:test";
import assert from "node:assert/strict";

import { IntakeService } from "./services/intake-service.ts";
import { ConciliadorProduto } from "./conciliacao/conciliador-produto.ts";
import { validarProduto, ehValido } from "./validators/produto-validator.ts";
import type { DependenciasIntake } from "./engine/intake-engine.ts";
import type { ContextoIntake, ProdutoCanonicoIntake } from "./types/intake-command.ts";

import type { ProdutoMestreRepository } from "../ports/produto-mestre-repository.ts";
import { ProdutoMestre } from "../../domain/produto-mestre/produto-mestre.ts";
import type { IdCliente } from "../../domain/shared/value-objects/identificador.ts";
import type { SkuOrigem } from "../../domain/shared/value-objects/sku-origem.ts";

// Critério de aceite: fluxo real com o Magazord Connector (infra é OK em teste).
import { MagazordConnector } from "../../infrastructure/connectors/erp/magazord/magazord-connector.ts";
import type { MagazordApi } from "../../infrastructure/connectors/erp/magazord/magazord-api.ts";
import type {
  CategoriaMagazordRaw,
  ImagemMagazordRaw,
  ProdutoMagazordRaw,
  VariacaoMagazordRaw,
} from "../../infrastructure/connectors/erp/magazord/tipos-magazord.ts";
import type { ContextoConector } from "../../infrastructure/connectors/shared/tipos-conector.ts";

const AGORA = "2026-07-13T00:00:00.000Z";

class RepoFake implements ProdutoMestreRepository {
  readonly store = new Map<string, ProdutoMestre>();
  async salvar(pm: ProdutoMestre): Promise<void> {
    this.store.set(pm.id, pm);
  }
  async porId(id: string): Promise<ProdutoMestre | null> {
    return this.store.get(id) ?? null;
  }
  async porSkuOrigem(clienteId: IdCliente, skuOrigem: SkuOrigem): Promise<ProdutoMestre | null> {
    for (const pm of this.store.values()) {
      if (pm.clienteId === clienteId && pm.skuOrigem.valor === skuOrigem.valor) return pm;
    }
    return null;
  }
  async listarDoCliente(clienteId: IdCliente): Promise<ProdutoMestre[]> {
    return [...this.store.values()].filter((pm) => pm.clienteId === clienteId);
  }
}

function montar(): DependenciasIntake & { repo: RepoFake } {
  let seq = 0;
  return {
    repo: new RepoFake(),
    clock: { agora: () => AGORA },
    idGen: { novo: () => `id-${++seq}` },
  };
}

const CONTEXTO: ContextoIntake = {
  organizacaoId: "org-1",
  clienteId: "cli-1",
  origemProdutoId: "ori-1",
  origemInterna: false,
  catalogoId: null,
  modoOperacao: "revenda",
};

function produto(over: Partial<{ sku: string; ean: string | null; nome: string }> = {}): ProdutoCanonicoIntake {
  return {
    identidade: { skuOrigem: over.sku ?? "TS-200", ean: over.ean ?? null },
    nome: over.nome ?? "Fone TWS",
    marca: "TechSound",
    variantes: [],
  };
}

// ---- cenários de decisão ----

test("Produto novo → criar (com evento preparado, NÃO publicado)", async () => {
  const d = montar();
  const r = await new IntakeService(d).processarProduto({ ...CONTEXTO, produto: produto() });
  assert.equal(r.decisao, "criar");
  assert.equal(r.conciliadoPor, "nenhuma");
  assert.ok(r.produtoMestre);
  assert.equal(r.produtoMestre?.skuOrigem, "TS-200");
  // eventos PREPARADOS (não há publisher no Intake)
  assert.ok(r.eventos.some((e) => e.tipo === "produto_mestre.criado"));
  assert.equal(d.repo.store.size, 1);
});

test("Produto existente (mesmo SKU, conteúdo mudou) → atualizar", async () => {
  const d = montar();
  const svc = new IntakeService(d);
  await svc.processarProduto({ ...CONTEXTO, produto: produto({ nome: "Fone" }) });
  const r = await svc.processarProduto({ ...CONTEXTO, produto: produto({ nome: "Fone Pro" }) });
  assert.equal(r.decisao, "atualizar");
  assert.equal(r.conciliadoPor, "sku_origem");
  assert.equal(r.produtoMestre?.nome, "Fone Pro");
  assert.ok(r.eventos.some((e) => e.tipo === "produto_mestre.atualizado"));
});

test("Produto sem alteração → ignorar (idempotente, sem evento)", async () => {
  const d = montar();
  const svc = new IntakeService(d);
  await svc.processarProduto({ ...CONTEXTO, produto: produto({ nome: "Fone" }) });
  const r = await svc.processarProduto({ ...CONTEXTO, produto: produto({ nome: "Fone" }) });
  assert.equal(r.decisao, "ignorar");
  assert.equal(r.conciliadoPor, "sku_origem");
  assert.equal(r.eventos.length, 0);
});

test("SKU encontrado → conciliadoPor sku_origem", async () => {
  const d = montar();
  const svc = new IntakeService(d);
  await svc.processarProduto({ ...CONTEXTO, produto: produto({ sku: "ABC" }) });
  const r = await svc.processarProduto({ ...CONTEXTO, produto: produto({ sku: "ABC", nome: "novo" }) });
  assert.equal(r.conciliadoPor, "sku_origem");
});

test("EAN encontrado → concilia pela chave complementar", async () => {
  const d = montar();
  const svc = new IntakeService(d);
  // cria com SKU AAA + EAN válido
  await svc.processarProduto({ ...CONTEXTO, produto: produto({ sku: "AAA", ean: "7891234567895" }) });
  // outro SKU, mesmo EAN → casa por EAN
  const r = await svc.processarProduto({
    ...CONTEXTO,
    produto: produto({ sku: "BBB", ean: "7891234567895", nome: "outro" }),
  });
  assert.equal(r.conciliadoPor, "ean");
});

test("Produto inválido (sem nome) → invalido, nada persistido", async () => {
  const d = montar();
  const r = await new IntakeService(d).processarProduto({ ...CONTEXTO, produto: produto({ nome: "" }) });
  assert.equal(r.decisao, "invalido");
  assert.equal(d.repo.store.size, 0);
  assert.ok(r.motivos.some((m) => m.includes("nome")));
});

test("EAN malformado no novo → conversão barra (invalido)", async () => {
  const d = montar();
  const r = await new IntakeService(d).processarProduto({
    ...CONTEXTO,
    produto: produto({ ean: "123" }),
  });
  assert.equal(r.decisao, "invalido");
  assert.ok(r.motivos.some((m) => m.includes("conversao")));
});

test("Incoerência de modo (fabricação própria + origem externa) → invalido (domínio)", async () => {
  const d = montar();
  const r = await new IntakeService(d).processarProduto({
    ...CONTEXTO,
    modoOperacao: "fabricacao_propria",
    origemInterna: false,
    produto: produto(),
  });
  assert.equal(r.decisao, "invalido");
  assert.ok(r.motivos.some((m) => m.includes("dominio")));
});

// ---- conciliador direto (ramos defensivos) ----

test("Conciliador: SKU inválido → nenhuma (defesa)", async () => {
  const c = new ConciliadorProduto(new RepoFake());
  const r = await c.conciliar("cli-1", { skuOrigem: "", ean: null });
  assert.equal(r.chave, "nenhuma");
  assert.equal(r.existente, null);
});

test("validarProduto: sku e nome ausentes acumulam erros", () => {
  const erros = validarProduto({ identidade: { skuOrigem: " ", ean: null }, nome: "", variantes: [] });
  assert.equal(erros.length, 2);
});

test("ehValido reflete validarProduto", () => {
  assert.equal(ehValido(produto()), true);
  assert.equal(ehValido(produto({ nome: "" })), false);
});

test("Relatório: lote com atualização e sem-alteração (todos os campos do patch)", async () => {
  const d = montar();
  const svc = new IntakeService(d);
  await svc.processarLote({
    ...CONTEXTO,
    produtos: [produto({ sku: "S1", nome: "A" }), produto({ sku: "S2", nome: "B" })],
  });
  const rep = await svc.processarLote({
    ...CONTEXTO,
    produtos: [
      // S1 alterado, exercitando todos os ramos de construirPatch
      {
        identidade: { skuOrigem: "S1", ean: null },
        nome: "A2",
        marca: "M",
        modelo: "MOD",
        categoriaZion: "CAT",
        descricaoBase: "DESC",
        variantes: [],
      },
      produto({ sku: "S2", nome: "B" }), // igual → ignorar
    ],
  });
  assert.equal(rep.resumo.atualizados, 1);
  assert.equal(rep.resumo.ignorados, 1);
});

// ---- lote: relatório + SKU duplicado ----

test("Relatório de conciliação + SKU duplicado no lote", async () => {
  const d = montar();
  const svc = new IntakeService(d);
  const rep = await svc.processarLote({
    ...CONTEXTO,
    produtos: [
      produto({ sku: "S1", nome: "Fone" }),
      produto({ sku: "S1", nome: "Fone duplicado" }), // duplicado no lote
      produto({ sku: "S2", nome: "Mouse" }),
      produto({ sku: "", nome: "sem sku" }), // inválido
    ],
  });
  assert.equal(rep.resumo.total, 4);
  assert.equal(rep.resumo.novos, 2);
  assert.equal(rep.resumo.duplicados, 1);
  assert.equal(rep.resumo.invalidos, 1);
  // eventos preparados = 2 criações (não publicados)
  assert.equal(rep.eventosPreparados.length, 2);
  assert.ok(rep.eventosPreparados.every((e) => e.tipo === "produto_mestre.criado"));
});

// ---- CRITÉRIO DE ACEITE: Magazord → Produto Canônico → Intake → Produto Mestre ----

const PRODUTO_MZ: ProdutoMagazordRaw = {
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

class MagazordApiFake implements MagazordApi {
  async buscarProduto(id: string): Promise<ProdutoMagazordRaw | null> {
    return id === "1" ? PRODUTO_MZ : null;
  }
  async listarProdutos(): Promise<ProdutoMagazordRaw[]> {
    return [PRODUTO_MZ];
  }
  async buscarVariacoes(): Promise<VariacaoMagazordRaw[]> {
    return PRODUTO_MZ.variacoes ? [...PRODUTO_MZ.variacoes] : [];
  }
  async buscarImagens(): Promise<ImagemMagazordRaw[]> {
    return PRODUTO_MZ.imagens ? [...PRODUTO_MZ.imagens] : [];
  }
  async listarCategorias(): Promise<CategoriaMagazordRaw[]> {
    return [{ id: 10, nome: "Fones", caminho: "Áudio > Fones" }];
  }
}

test("ACEITE: Magazord Connector → Produto Canônico → Zion Intake → Produto Mestre", async () => {
  // 1. Magazord Connector produz o Produto Canônico (SDK).
  const conector = new MagazordConnector({
    api: new MagazordApiFake(),
    relogio: { agora: () => AGORA },
  });
  const ctxConector: ContextoConector = {
    organizacaoId: "org-1",
    clienteId: "cli-1",
    contaExterna: "loja",
    credencial: { estrategia: "api_key", ref: "cofre://magazord/1" },
  };
  const lido = await conector.lerProduto(ctxConector, "1");
  assert.ok(lido.ok);
  if (!lido.ok) return;

  // 2. O canônico do SDK flui direto para o Intake (compatibilidade estrutural).
  const d = montar();
  const item = await new IntakeService(d).processarProduto({ ...CONTEXTO, produto: lido.valor });

  // 3. Vira Produto Mestre — sem qualquer dependência de infraestrutura no Intake.
  assert.equal(item.decisao, "criar");
  assert.ok(item.produtoMestre);
  assert.equal(item.produtoMestre?.skuOrigem, "FORN-9");
  assert.equal(item.produtoMestre?.status, "rascunho");
  assert.ok(item.eventos.some((e) => e.tipo === "produto_mestre.criado"));
});
