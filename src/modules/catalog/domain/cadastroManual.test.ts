// Testes do cadastro manual (D).
//
// O que se prova: o lojista consegue cadastrar sabendo só o que ele sabe, os
// erros aparecem todos de uma vez, e o produto que sai daqui é indistinguível
// de um importado por CSV.
// Rodar: npx tsx --test src/modules/catalog/domain/cadastroManual.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { TAXAS_PADRAO } from "../../pricing/domain/modeloPreco.ts";
import {
  RASCUNHO_VAZIO,
  paraNumero,
  validarRascunho,
  avisoDePreco,
  montarProduto,
  embalagemDoRascunho,
  type RascunhoProduto,
} from "./cadastroManual.ts";

/** Caixa de chinelo medida: sem isto o envio (e o piso) não são calculáveis. */
const REAL = {
  ...TAXAS_PADRAO,
  embalagem: { pesoGramas: 400, alturaCm: 10, larguraCm: 20, comprimentoCm: 30 },
};

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
  const aviso = avisoDePreco(barato, 5, REAL);
  assert.ok(aviso);
  assert.ok(aviso.precoMinimo > 30);
});

test("SEM o peso da embalagem não há aviso — e isso é deliberado", () => {
  // O custo de envio do ML depende do peso cobrável. Sem ele, acusar "preço
  // baixo" seria assustar por dado que falta a NÓS, não ao lojista.
  const barato = { ...completo, precoVenda: "30,00" };
  assert.equal(avisoDePreco(barato, 5), null);
});

test("o MESMO preço avisa ou não conforme a margem que o lojista escolheu", () => {
  // A R$ 55 o preço é folgado para quem exige 5% e apertado para quem exige 30%.
  const p = { ...completo, precoVenda: "55,00", custo: "22,50" };
  assert.equal(avisoDePreco(p, 5, REAL), null, "com margem 5% o preço passa");
  const exigente = avisoDePreco(p, 30, REAL);
  assert.ok(exigente, "com margem 30% o preço fica abaixo do piso");
  assert.ok(exigente.precoMinimo > 55);
  assert.ok(exigente.margemAtual < 30);
});

test("preço acima do piso não gera aviso", () => {
  assert.equal(avisoDePreco({ ...completo, precoVenda: "500,00" }, 5, REAL), null);
});

test("sem custo não há o que comparar — nenhum aviso inventado", () => {
  assert.equal(avisoDePreco({ ...completo, custo: "" }, 5, REAL), null);
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
  const com5 = montarProduto(completo, "c", "n", 5, REAL).precoMinimo!;
  const com25 = montarProduto(completo, "c", "n", 25, REAL).precoMinimo!;
  assert.ok(com25 > com5, `${com25} > ${com5}`);
});

test("sem peso, o produto nasce sem preço mínimo gravado — campo ausente, não zero", () => {
  const p = montarProduto(completo, "c", "n", 5);
  assert.equal(p.precoMinimo, undefined);
  assert.equal(p.margem, undefined);
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

// ── Medidas da embalagem ─────────────────────────────────────────────────────

test("as medidas digitadas viram a embalagem do cálculo", () => {
  const e = embalagemDoRascunho({
    ...completo,
    pesoGramas: "400",
    alturaCm: "10",
    larguraCm: "20",
    comprimentoCm: "30",
  });
  assert.deepEqual(e, { pesoGramas: 400, alturaCm: 10, larguraCm: 20, comprimentoCm: 30 });
});

test("sem nenhuma medida a embalagem é null — o envio vira pendência", () => {
  assert.equal(embalagemDoRascunho(completo), null);
});

test("só o peso já serve — dimensão ausente não anula a medida", () => {
  const e = embalagemDoRascunho({ ...completo, pesoGramas: "350" });
  assert.ok(e);
  assert.equal(e.pesoGramas, 350);
});

test("com as medidas no rascunho, o aviso de preço volta a funcionar", () => {
  // Sem medidas não há como calcular o envio, e o aviso fica em silêncio.
  // Com elas, o piso passa a existir — sem precisar do modelo de fora.
  const medido = {
    ...completo,
    precoVenda: "30,00",
    pesoGramas: "400",
    alturaCm: "10",
    larguraCm: "20",
    comprimentoCm: "30",
  };
  assert.equal(avisoDePreco({ ...completo, precoVenda: "30,00" }, 5), null, "sem medidas: silêncio");
  const aviso = avisoDePreco(medido, 5);
  assert.ok(aviso, "com medidas: o piso existe e o preço baixo é acusado");
  assert.ok(aviso.precoMinimo > 30);
});

test("o produto montado grava o preço mínimo quando há medidas", () => {
  const medido = { ...completo, pesoGramas: "400", alturaCm: "10", larguraCm: "20", comprimentoCm: "30" };
  const p = montarProduto(medido, "c", "n", 5);
  assert.ok(typeof p.precoMinimo === "number" && p.precoMinimo > 0);
  assert.ok(typeof p.margem === "number");
});
