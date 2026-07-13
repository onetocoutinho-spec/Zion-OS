// Testes do agregado ProdutoMestre — puros, determinísticos (ids/timestamps fixos).
import { test } from "node:test";
import assert from "node:assert/strict";

import { ProdutoMestre, type DadosCriacaoProdutoMestre } from "./produto-mestre.ts";
import { Variante } from "./variante.ts";
import { Dinheiro } from "../shared/value-objects/dinheiro.ts";
import { SkuOrigem } from "../shared/value-objects/sku-origem.ts";
import { comoId } from "../shared/value-objects/identificador.ts";
import type {
  IdOrganizacao,
  IdCliente,
  IdOrigemProduto,
  IdProdutoMestre,
  IdVariante,
} from "../shared/value-objects/identificador.ts";
import type { Autor } from "./versao.ts";

const AGORA = "2026-07-13T00:00:00.000Z";
const AUTOR: Autor = { tipo: "humano", id: "user-1" };

function sku(v: string): SkuOrigem {
  const r = SkuOrigem.criar(v);
  if (!r.ok) throw new Error("sku de teste inválido");
  return r.valor;
}
function dinheiro(v: number): Dinheiro {
  const r = Dinheiro.criar(v);
  if (!r.ok) throw new Error("dinheiro de teste inválido");
  return r.valor;
}

const PM_ID = comoId<"produto_mestre">("pm-1") as IdProdutoMestre;

function baseRevenda(over: Partial<DadosCriacaoProdutoMestre> = {}): DadosCriacaoProdutoMestre {
  return {
    id: PM_ID,
    organizacaoId: comoId<"organizacao">("org-1") as IdOrganizacao,
    clienteId: comoId<"cliente">("cli-1") as IdCliente,
    origemProdutoId: comoId<"origem_produto">("ori-1") as IdOrigemProduto,
    origemInterna: false,
    catalogoId: null,
    modoOperacao: "revenda",
    skuOrigem: sku("TS-200"),
    ean: null,
    nome: "Fone TWS",
    agora: AGORA,
    ...over,
  };
}

function novaVariante(id: string, skuZion: string, preco: number): Variante {
  const r = Variante.criar({
    id: comoId<"variante">(id) as IdVariante,
    produtoMestreId: PM_ID,
    skuZion,
    skuOrigemVariacao: null,
    ean: null,
    cor: null,
    tamanho: null,
    precoVenda: dinheiro(preco),
  });
  if (!r.ok) throw new Error("variante de teste inválida");
  return r.valor;
}

// ---- criação / coerência 001 §5 ----

test("criarRascunho: revenda válida nasce em rascunho e emite produto_mestre.criado", () => {
  const r = ProdutoMestre.criarRascunho(baseRevenda());
  assert.ok(r.ok);
  if (r.ok) {
    const pm = r.valor;
    assert.equal(pm.status, "rascunho");
    assert.equal(pm.versaoAtual, 1);
    const eventos = pm.puxarEventos();
    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].tipo, "produto_mestre.criado");
    assert.equal(pm.puxarEventos().length, 0); // limpou após puxar
  }
});

test("criarRascunho: fabricação própria exige origem interna e catalogoId null", () => {
  const okFab = ProdutoMestre.criarRascunho(
    baseRevenda({ modoOperacao: "fabricacao_propria", origemInterna: true, catalogoId: null }),
  );
  assert.ok(okFab.ok);

  const semInterna = ProdutoMestre.criarRascunho(
    baseRevenda({ modoOperacao: "fabricacao_propria", origemInterna: false }),
  );
  assert.equal(semInterna.ok, false);
  if (!semInterna.ok) assert.equal(semInterna.erro.codigo, "modo_operacao_incoerente");

  const comCatalogo = ProdutoMestre.criarRascunho(
    baseRevenda({
      modoOperacao: "fabricacao_propria",
      origemInterna: true,
      catalogoId: comoId("cat-1"),
    }),
  );
  assert.equal(comCatalogo.ok, false);
});

test("criarRascunho: revenda com origem interna é incoerente", () => {
  const r = ProdutoMestre.criarRascunho(baseRevenda({ origemInterna: true }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro.codigo, "modo_operacao_incoerente");
});

test("criarRascunho: nome vazio é rejeitado", () => {
  const r = ProdutoMestre.criarRascunho(baseRevenda({ nome: "   " }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro.codigo, "campo_obrigatorio");
});

// ---- variantes: invariante de pertencimento ----

test("adicionarVariante: aceita variante do próprio Mestre; rejeita duplicada", () => {
  const pm = criar();
  const v = novaVariante("var-1", "SKU-1", 100);
  assert.equal(pm.adicionarVariante(v).ok, true);
  assert.equal(pm.variantes.length, 1);

  const dup = novaVariante("var-2", "SKU-1", 120); // mesmo skuZion
  const r = pm.adicionarVariante(dup);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro.codigo, "variante_duplicada");
});

test("adicionarVariante: rejeita variante de outro Produto Mestre", () => {
  const pm = criar();
  const outroId = comoId<"produto_mestre">("pm-outro") as IdProdutoMestre;
  const rv = Variante.criar({
    id: comoId<"variante">("var-x") as IdVariante,
    produtoMestreId: outroId,
    skuZion: "SKU-X",
    skuOrigemVariacao: null,
    ean: null,
    cor: null,
    tamanho: null,
    precoVenda: dinheiro(50),
  });
  assert.ok(rv.ok);
  if (rv.ok) {
    const r = pm.adicionarVariante(rv.valor);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.erro.codigo, "variante_nao_pertence");
  }
});

// ---- preço de venda (Zion) versiona ----

test("definirPrecoVendaVariante: muda preço, versiona e emite variante.atualizada", () => {
  const pm = criar();
  pm.adicionarVariante(novaVariante("var-1", "SKU-1", 100));
  pm.puxarEventos(); // limpa o criado

  const r = pm.definirPrecoVendaVariante(
    comoId<"variante">("var-1") as IdVariante,
    dinheiro(150),
    AUTOR,
    AGORA,
  );
  assert.ok(r.ok);
  assert.equal(pm.versaoAtual, 2);
  assert.equal(pm.variantes[0].precoVenda.valor, 150);
  const tipos = pm.puxarEventos().map((e) => e.tipo);
  assert.ok(tipos.includes("variante.atualizada"));
});

test("definirPrecoVendaVariante: variante inexistente falha", () => {
  const pm = criar();
  const r = pm.definirPrecoVendaVariante(
    comoId<"variante">("nao-existe") as IdVariante,
    dinheiro(10),
    AUTOR,
    AGORA,
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro.codigo, "variante_inexistente");
});

// ---- espelho ERP (read-only, 001 §7) ----

test("aplicarEspelhoErp: reflete estoque/custo, emite estoque.espelhado, NÃO versiona", () => {
  const pm = criar();
  pm.adicionarVariante(novaVariante("var-1", "SKU-1", 100));
  pm.puxarEventos();
  const versaoAntes = pm.versaoAtual;

  const r = pm.aplicarEspelhoErp(comoId<"variante">("var-1") as IdVariante, 42, dinheiro(30), AGORA);
  assert.ok(r.ok);
  assert.equal(pm.variantes[0].estoqueErp, 42);
  assert.equal(pm.variantes[0].custoErp?.valor, 30);
  assert.equal(pm.versaoAtual, versaoAntes); // espelho do ERP não é versão de conteúdo Zion
  assert.equal(pm.puxarEventos()[0].tipo, "estoque.espelhado");
});

test("aplicarEspelhoErp: estoque negativo/fracionário é rejeitado", () => {
  const pm = criar();
  pm.adicionarVariante(novaVariante("var-1", "SKU-1", 100));
  const id = comoId<"variante">("var-1") as IdVariante;
  assert.equal(pm.aplicarEspelhoErp(id, -1, dinheiro(30), AGORA).ok, false);
  assert.equal(pm.aplicarEspelhoErp(id, 1.5, dinheiro(30), AGORA).ok, false);
});

// ---- edição de conteúdo versiona (001 §8) e F4 ----

test("editarConteudo: gera versão com diff e emite produto_mestre.atualizado", () => {
  const pm = criar();
  pm.puxarEventos();
  const r = pm.editarConteudo({ nome: "Fone TWS Pro", marca: "TechSound" }, AUTOR, AGORA);
  assert.ok(r.ok);
  assert.equal(pm.versaoAtual, 2);
  assert.equal(pm.nome, "Fone TWS Pro");
  const versoes = pm.versoes;
  assert.equal(versoes.length, 1);
  const campos = versoes[0].diff.map((d) => d.campo);
  assert.ok(campos.includes("nome") && campos.includes("marca"));
  assert.equal(pm.puxarEventos()[0].tipo, "produto_mestre.atualizado");
});

test("editarConteudo: sem mudança real não versiona nem emite", () => {
  const pm = criar();
  pm.puxarEventos();
  const r = pm.editarConteudo({ nome: "Fone TWS" }, AUTOR, AGORA); // igual ao atual
  assert.ok(r.ok);
  assert.equal(pm.versaoAtual, 1);
  assert.equal(pm.puxarEventos().length, 0);
});

test("editarConteudo: item aprovado volta para pendente_aprovacao (F4)", () => {
  const pm = criar();
  pm.enriquecer(AGORA);
  pm.enviarParaAprovacao(AGORA);
  pm.aprovar(AGORA);
  assert.equal(pm.status, "aprovado");
  pm.editarConteudo({ descricaoBase: "nova descrição" }, AUTOR, AGORA);
  assert.equal(pm.status, "pendente_aprovacao");
});

// ---- transições ----

test("transição inválida é barrada com erro tipado", () => {
  const pm = criar();
  const r = pm.marcarPublicado(AGORA); // rascunho → publicado (inválido)
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro.codigo, "transicao_invalida");
});

function criar(): ProdutoMestre {
  const r = ProdutoMestre.criarRascunho(baseRevenda());
  if (!r.ok) throw new Error("falha ao criar PM de teste");
  return r.valor;
}
