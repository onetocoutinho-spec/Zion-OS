// Testes de orquestração dos use cases — puros, com fakes dos Ports (sem infra).
import { test } from "node:test";
import assert from "node:assert/strict";

import { CriarProdutoMestreUseCase } from "./criar-produto-mestre.use-case.ts";
import { AtualizarProdutoMestreUseCase } from "./atualizar-produto-mestre.use-case.ts";
import { AdicionarVarianteUseCase } from "./adicionar-variante.use-case.ts";
import { AtualizarPrecoUseCase } from "./atualizar-preco.use-case.ts";
import { RegistrarEventosDeDominioUseCase } from "./registrar-eventos-de-dominio.use-case.ts";

import type { ProdutoMestreRepository } from "../ports/produto-mestre-repository.ts";
import type { EventPublisher } from "../ports/event-publisher.ts";
import type { Clock } from "../ports/clock.ts";
import type { IdGenerator } from "../ports/id-generator.ts";
import type { Logger } from "../ports/logger.ts";
import type { CriarProdutoMestreCommand } from "../commands/criar-produto-mestre.command.ts";

import { ProdutoMestre } from "../../domain/produto-mestre/produto-mestre.ts";
import type { IdProdutoMestre } from "../../domain/shared/value-objects/identificador.ts";
import type { EventoDominio } from "../../domain/shared/evento-dominio.ts";

// ---- fakes dos Ports (fixtures de teste) ----

class RepoFake implements ProdutoMestreRepository {
  private readonly store = new Map<string, ProdutoMestre>();
  async salvar(pm: ProdutoMestre): Promise<void> {
    this.store.set(pm.id, pm);
  }
  async porId(id: IdProdutoMestre): Promise<ProdutoMestre | null> {
    return this.store.get(id) ?? null;
  }
  async porSkuOrigem(): Promise<ProdutoMestre | null> {
    return null;
  }
  async listarDoCliente(): Promise<ProdutoMestre[]> {
    return [...this.store.values()];
  }
}

class PublisherFake implements EventPublisher {
  readonly eventos: EventoDominio[] = [];
  async publicar(eventos: ReadonlyArray<EventoDominio>): Promise<void> {
    this.eventos.push(...eventos);
  }
}

function montar() {
  let seq = 0;
  const repo = new RepoFake();
  const publisher = new PublisherFake();
  const logger: Logger = { info() {}, aviso() {}, erro() {} };
  const idGen: IdGenerator = { novo: () => `id-${++seq}` };
  const clock: Clock = { agora: () => "2026-07-13T00:00:00.000Z" };
  return { repo, publisher, logger, idGen, clock };
}

function comandoCriar(over: Partial<CriarProdutoMestreCommand> = {}): CriarProdutoMestreCommand {
  return {
    organizacaoId: "org-1",
    clienteId: "cli-1",
    origemProdutoId: "ori-1",
    origemInterna: false,
    catalogoId: null,
    modoOperacao: "revenda",
    skuOrigem: "TS-200",
    ean: null,
    nome: "Fone TWS",
    ...over,
  };
}

// ---- Criar ----

test("CriarProdutoMestre: cria rascunho, salva e publica produto_mestre.criado", async () => {
  const d = montar();
  const r = await new CriarProdutoMestreUseCase(d).executar(comandoCriar());
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.valor.status, "rascunho");
    assert.equal(r.valor.versaoAtual, 1);
    assert.equal(r.valor.id, "id-1");
    assert.equal(r.valor.skuOrigem, "TS-200");
  }
  assert.equal(d.publisher.eventos.length, 1);
  assert.equal(d.publisher.eventos[0].tipo, "produto_mestre.criado");
});

test("CriarProdutoMestre: incoerência de modo → erro de domínio; nada publicado", async () => {
  const d = montar();
  const r = await new CriarProdutoMestreUseCase(d).executar(
    comandoCriar({ modoOperacao: "fabricacao_propria", origemInterna: false }),
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.erro.origem, "dominio");
    assert.equal(r.erro.codigo, "modo_operacao_incoerente");
  }
  assert.equal(d.publisher.eventos.length, 0);
});

test("CriarProdutoMestre: EAN inválido → erro de domínio na conversão", async () => {
  const d = montar();
  const r = await new CriarProdutoMestreUseCase(d).executar(comandoCriar({ ean: "123" }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro.codigo, "ean_invalido");
});

// ---- Atualizar (conteúdo) ----

test("AtualizarProdutoMestre: não encontrado → erro de aplicação", async () => {
  const d = montar();
  const r = await new AtualizarProdutoMestreUseCase(d).executar({
    produtoMestreId: "inexistente",
    patch: { nome: "x" },
    autor: { tipo: "humano", id: "u1" },
  });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.erro.origem, "aplicacao");
    assert.equal(r.erro.codigo, "nao_encontrado");
  }
});

test("AtualizarProdutoMestre: edita conteúdo, versiona e publica atualizado", async () => {
  const d = montar();
  const rc = await new CriarProdutoMestreUseCase(d).executar(comandoCriar());
  const pmId = rc.ok ? rc.valor.id : "";
  d.publisher.eventos.length = 0;

  const r = await new AtualizarProdutoMestreUseCase(d).executar({
    produtoMestreId: pmId,
    patch: { nome: "Fone Pro", marca: "TechSound" },
    autor: { tipo: "humano", id: "u1" },
  });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.valor.nome, "Fone Pro");
    assert.equal(r.valor.marca, "TechSound");
    assert.equal(r.valor.versaoAtual, 2);
  }
  assert.ok(d.publisher.eventos.some((e) => e.tipo === "produto_mestre.atualizado"));
});

// ---- Fluxo: adicionar variante + atualizar preço ----

test("fluxo: criar → adicionar variante → atualizar preço (Zion é dona)", async () => {
  const d = montar();
  const rc = await new CriarProdutoMestreUseCase(d).executar(comandoCriar());
  const pmId = rc.ok ? rc.valor.id : "";

  const rv = await new AdicionarVarianteUseCase(d).executar({
    produtoMestreId: pmId,
    skuZion: "SKU-1",
    skuOrigemVariacao: null,
    ean: null,
    cor: "Preto",
    tamanho: null,
    precoVenda: 100,
  });
  assert.ok(rv.ok);
  assert.equal(rv.ok ? rv.valor.variantes.length : 0, 1);
  const varId = rv.ok ? rv.valor.variantes[0].id : "";

  d.publisher.eventos.length = 0;
  const rp = await new AtualizarPrecoUseCase(d).executar({
    produtoMestreId: pmId,
    varianteId: varId,
    precoVenda: 150,
    autor: { tipo: "humano", id: "u1" },
  });
  assert.ok(rp.ok);
  if (rp.ok) {
    assert.equal(rp.valor.variantes[0].precoVenda, 150);
    assert.ok(rp.valor.versaoAtual >= 2);
  }
  assert.ok(d.publisher.eventos.some((e) => e.tipo === "variante.atualizada"));
});

test("AdicionarVariante: produto inexistente → erro de aplicação", async () => {
  const d = montar();
  const r = await new AdicionarVarianteUseCase(d).executar({
    produtoMestreId: "nao-existe",
    skuZion: "SKU-1",
    skuOrigemVariacao: null,
    ean: null,
    cor: null,
    tamanho: null,
    precoVenda: 10,
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro.codigo, "nao_encontrado");
});

// ---- Registrar Eventos de Domínio ----

test("RegistrarEventosDeDominio: entrega eventos ao publisher", async () => {
  const d = montar();
  const evento: EventoDominio = {
    tipo: "produto_mestre.criado",
    versao_schema: 1,
    chave_particao: "pm-1",
    occurred_at: "2026-07-13T00:00:00.000Z",
    payload: {},
  };
  await new RegistrarEventosDeDominioUseCase(d).executar([evento]);
  assert.equal(d.publisher.eventos.length, 1);
});

test("RegistrarEventosDeDominio: lista vazia é no-op (não publica)", async () => {
  const d = montar();
  await new RegistrarEventosDeDominioUseCase(d).executar([]);
  assert.equal(d.publisher.eventos.length, 0);
});
