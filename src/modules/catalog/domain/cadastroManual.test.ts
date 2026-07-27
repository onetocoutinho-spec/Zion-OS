// Testes do cadastro manual (D).
//
// O que se prova: o lojista consegue cadastrar sabendo só o que ele sabe, os
// erros aparecem todos de uma vez, e o produto que sai daqui é indistinguível
// de um importado por CSV.
// Rodar: npx tsx --test src/modules/catalog/domain/cadastroManual.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  RASCUNHO_VAZIO,
  paraNumero,
  validarRascunho,
  avisoDePreco,
  montarProduto,
  type RascunhoProduto,
} from "./cadastroManual.ts";

const completo: RascunhoProduto = {
  ...RASCUNHO_VAZIO,
  nome: "Chinelo Slide Feminino",
  sku: "CHN-001",
  precoVenda: "89,90",
  custo: "22,50",
  estoque: "40",
  marca: "Zaxy",
  categoria: "Calçados",
  cor: "Preto",
  tamanho: "37",
};

// ── Leitura de número ────────────────────────────────────────────────────────

test("aceita o preço como o lojista digita", () => {
  assert.equal(paraNumero("89,90"), 89.9);
  assert.equal(paraNumero("89.90"), 89.9);
  assert.equal(paraNumero("R$ 1.234,56"), 1234.56);
  assert.equal(paraNumero("1234.56"), 1234.56);
  assert.equal(paraNumero(""), 0);
  assert.equal(paraNumero("abc"), 0);
});

// ── Validação ────────────────────────────────────────────────────────────────

test("rascunho completo passa", () => {
  assert.deepEqual(validarRascunho(completo), []);
});

test("nome, SKU e preço são obrigatórios — e aparecem JUNTOS", () => {
  // Um erro por vez, salvando e errando de novo, é o jeito de perder alguém.
  const problemas = validarRascunho(RASCUNHO_VAZIO);
  assert.deepEqual(problemas.map((p) => p.campo).sort(), ["nome", "precoVenda", "sku"]);
});

test("preço zero não é preço", () => {
  const p = validarRascunho({ ...completo, precoVenda: "0" });
  assert.equal(p.length, 1);
  assert.equal(p[0].campo, "precoVenda");
});

test("SKU repetido BLOQUEIA — quebraria a conciliação com o ERP", () => {
  const p = validarRascunho(completo, ["OUTRO-1", "chn-001"]);
  assert.equal(p.length, 1);
  assert.equal(p[0].campo, "sku");
  assert.match(p[0].texto, /CHN-001/);
});

test("SKU repetido é comparado sem diferenciar maiúsculas nem espaços", () => {
  assert.equal(validarRascunho(completo, ["  CHN-001  "]).length, 1);
});

test("custo e estoque são opcionais, mas não podem ser negativos", () => {
  assert.deepEqual(validarRascunho({ ...completo, custo: "", estoque: "" }), []);
  assert.equal(validarRascunho({ ...completo, custo: "-5" })[0].campo, "custo");
  assert.equal(validarRascunho({ ...completo, estoque: "-1" })[0].campo, "estoque");
});

// ── Aviso de preço (não bloqueio) ────────────────────────────────────────────

test("preço abaixo do piso do lojista AVISA, não bloqueia", () => {
  // Vender no prejuízo pode ser estratégia. Quem decide é quem vende — mas
  // ninguém decide o que não vê.
  const barato = { ...completo, precoVenda: "30,00" };
  assert.deepEqual(validarRascunho(barato), []); // não bloqueia
  const aviso = avisoDePreco(barato, 5);
  assert.ok(aviso);
  assert.ok(aviso.precoMinimo > 30);
});

test("o MESMO preço avisa ou não conforme a margem que o lojista escolheu", () => {
  // custo 22,50 → piso 36,38 com margem 5%; piso 59,13 com margem 30%.
  // A R$ 55 o preço é folgado para um lojista e apertado para o outro.
  const p = { ...completo, precoVenda: "55,00", custo: "22,50" };
  assert.equal(avisoDePreco(p, 5), null, "com margem 5% o preço passa");
  const exigente = avisoDePreco(p, 30);
  assert.ok(exigente, "com margem 30% o preço fica abaixo do piso");
  assert.ok(exigente.precoMinimo > 55);
  assert.ok(exigente.margemAtual < 30);
});

test("preço acima do piso não gera aviso", () => {
  assert.equal(avisoDePreco({ ...completo, precoVenda: "500,00" }, 5), null);
});

test("sem custo não há o que comparar — nenhum aviso inventado", () => {
  assert.equal(avisoDePreco({ ...completo, custo: "" }, 5), null);
});

// ── Montagem ─────────────────────────────────────────────────────────────────

test("monta o produto com o que o lojista digitou", () => {
  const p = montarProduto(completo, "cli-1", "Chinelaria");
  assert.equal(p.nome, "Chinelo Slide Feminino");
  assert.equal(p.sku, "CHN-001");
  assert.equal(p.precoVenda, 89.9);
  assert.equal(p.custo, 22.5);
  assert.equal(p.estoque, 40);
  assert.equal(p.clienteId, "cli-1");
  assert.equal(p.cliente, "Chinelaria");
  assert.equal(p.marketplace, "Mercado Livre");
});

test("os defaults operacionais são os MESMOS da importação por CSV", () => {
  // Um produto cadastrado à mão e um importado precisam se comportar igual na
  // esteira, nas auditorias e nos filtros — divergir criaria duas classes.
  const p = montarProduto(completo, "cli-1", "Chinelaria");
  assert.equal(p.statusCadastro, "Não iniciado");
  assert.equal(p.statusSeo, "Pendente");
  assert.equal(p.statusDescricao, "Pendente");
  assert.equal(p.statusImagens, "Pendente");
  assert.equal(p.statusPrecificacao, "Pendente");
  assert.equal(p.prioridade, "Média");
});

test("custo digitado pelo próprio lojista tem confiança alta", () => {
  assert.equal(montarProduto(completo, "c", "n").confiancaCusto, "alta");
  // sem custo não se afirma confiança nenhuma
  assert.equal(montarProduto({ ...completo, custo: "" }, "c", "n").confiancaCusto, "");
});

test("o preço mínimo gravado usa a margem do lojista, não um piso fixo", () => {
  const com5 = montarProduto(completo, "c", "n", 5).precoMinimo!;
  const com25 = montarProduto(completo, "c", "n", 25).precoMinimo!;
  assert.ok(com25 > com5, `${com25} > ${com5}`);
});

test("espaços em volta não viram parte do dado", () => {
  const p = montarProduto({ ...completo, nome: "  Chinelo  ", sku: " CHN-9 " }, "c", "n");
  assert.equal(p.nome, "Chinelo");
  assert.equal(p.sku, "CHN-9");
});

test("estoque fracionado vira inteiro, e nunca negativo", () => {
  assert.equal(montarProduto({ ...completo, estoque: "12,7" }, "c", "n").estoque, 13);
  assert.equal(montarProduto({ ...completo, estoque: "-4" }, "c", "n").estoque, 0);
});
