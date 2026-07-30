import test from "node:test";
import assert from "node:assert/strict";

import {
  aceitarFato,
  centavosParaReais,
  CAMPOS_CRITICOS,
  ehCritico,
  escreverDinheiro,
  lerDinheiroEmCentavos,
  lerIdentificador,
} from "./fatosDoCadastro";

// ---- DINHEIRO: as duas armadilhas que custam caro ----

test('"47,80" é quarenta e sete e oitenta — não 4780', () => {
  // Ler a vírgula como nada multiplicaria o custo por cem.
  assert.equal(lerDinheiroEmCentavos("47,80"), 4780);
  assert.equal(centavosParaReais(4780), 47.8);
});

test('"1.249,90" é mil duzentos e quarenta e nove — não 1,24990', () => {
  // O ponto é milhar quando há vírgula. Tratá-lo como decimal deixaria o custo
  // mil vezes menor, e um preço mínimo abaixo do que se paga.
  assert.equal(lerDinheiroEmCentavos("1.249,90"), 124990);
});

test("R$ e espaços não atrapalham", () => {
  assert.equal(lerDinheiroEmCentavos("R$ 47,80"), 4780);
  assert.equal(lerDinheiroEmCentavos("  R$47,80  "), 4780);
  assert.equal(lerDinheiroEmCentavos("R$ 1.249,90"), 124990);
});

test('"47.80" (ponto decimal de teclado) também vale', () => {
  assert.equal(lerDinheiroEmCentavos("47.80"), 4780);
});

test('"1.249" sem vírgula é MILHAR, não 1,249', () => {
  // Grupos de três depois do ponto: separador de milhar, como se escreve no
  // Brasil.
  assert.equal(lerDinheiroEmCentavos("1.249"), 124900);
  assert.equal(lerDinheiroEmCentavos("12.500"), 1250000);
});

test('"1.2" é AMBÍGUO e recusado — dinheiro não se adivinha', () => {
  // R$ 1,20 ou R$ 12,00? A diferença é dez vezes e nenhuma leitura tem
  // evidência a favor. Eu tinha escrito um teste afirmando 120; o caso mostrou
  // que a resposta certa é não responder.
  assert.equal(lerDinheiroEmCentavos("1.2"), null);
  assert.equal(lerDinheiroEmCentavos("47.8"), null);
  assert.equal(lerDinheiroEmCentavos("1.2345"), null);
});

test("inteiro simples", () => {
  assert.equal(lerDinheiroEmCentavos("48"), 4800);
  assert.equal(lerDinheiroEmCentavos("0,50"), 50);
});

test("lixo e negativo são recusados, não convertidos", () => {
  for (const ruim of ["", "   ", "abc", "R$", "-47,80", "quarenta"]) {
    assert.equal(lerDinheiroEmCentavos(ruim), null, ruim);
  }
});

test("centavos são INTEIROS — float binário não representa dinheiro", () => {
  // `0.1 + 0.2 !== 0.3`. Custo é a base de lucro, margem e piso.
  const c = lerDinheiroEmCentavos("47,80");
  assert.ok(Number.isInteger(c));
  // 47.80 * 100 dá 4779.999... em ponto flutuante; o arredondamento fecha isso.
  assert.equal(c, 4780);
});

test("escrever devolve o formato que a pessoa confirma", () => {
  assert.equal(escreverDinheiro(4780), "R$ 47,80");
  assert.equal(escreverDinheiro(124990), "R$ 1249,90");
  assert.equal(escreverDinheiro(50), "R$ 0,50");
});

// ---- IDENTIFICADORES ----

test("SKU com zero inicial atravessa intacto", () => {
  // 473 SKUs desta base começam com zero.
  assert.equal(lerIdentificador("01040533"), "01040533");
  assert.equal(lerIdentificador("  01040533  "), "01040533");
  assert.notEqual(lerIdentificador("01040533"), "1040533");
});

test("EAN continua string de 13", () => {
  assert.equal(lerIdentificador("7900350512518"), "7900350512518");
  assert.equal(typeof lerIdentificador("7900350512518"), "string");
});

test("identificador vazio é null, não string vazia", () => {
  assert.equal(lerIdentificador(""), null);
  assert.equal(lerIdentificador("   "), null);
});

// ---- PROCEDÊNCIA ----

test("os campos críticos são dinheiro, identificadores e peso", () => {
  assert.deepEqual([...CAMPOS_CRITICOS].sort(), [
    "custo",
    "ean",
    "pesoGramas",
    "precoVenda",
    "sku",
  ]);
  assert.equal(ehCritico("custo"), true);
  assert.equal(ehCritico("sku"), true);
  assert.equal(ehCritico("nome"), false);
  assert.equal(ehCritico("marca"), false);
});

test("INFERÊNCIA NÃO VIRA FATO em campo crítico", () => {
  // A esteira já gerou SKU e cor plausíveis e falsos. Custo, SKU, EAN e peso ou
  // vêm de quem sabe, ou ficam vazios.
  for (const campo of CAMPOS_CRITICOS) {
    const r = aceitarFato(campo, "qualquer coisa", "inferido");
    assert.equal(r.aceito, false, campo);
    assert.match(r.motivo, /dado sensível/);
  }
});

test("inferência é aceita em campo NÃO crítico", () => {
  // "Papete" deduzido do nome é útil e reversível. Custo deduzido, não.
  const r = aceitarFato("categoria", "Calçados", "inferido");
  assert.equal(r.aceito, true);
  assert.equal(r.fato.procedencia, "inferido");
});

test("informado é aceito em qualquer campo, inclusive crítico", () => {
  const r = aceitarFato("custo", 4780, "informado");
  assert.equal(r.aceito, true);
  assert.equal(r.fato.valor, 4780);
  assert.equal(r.fato.procedencia, "informado");
});

test("catálogo e derivado valem para crítico — não são opinião", () => {
  // Ler do registro que existe, ou calcular deterministicamente, não é deduzir.
  assert.equal(aceitarFato("custo", 4780, "catalogo").aceito, true);
  assert.equal(aceitarFato("pesoGramas", 420, "derivado").aceito, true);
});

test("valor vazio é recusado mesmo quando informado", () => {
  // Campo não informado NÃO aparece como fato. Ele volta para a fila de
  // perguntas em vez de ocupar o lugar com nada.
  assert.equal(aceitarFato("nome", "", "informado").aceito, false);
  assert.equal(aceitarFato("custo", null, "informado").aceito, false);
  assert.equal(aceitarFato("sku", undefined, "informado").aceito, false);
});

test("a procedência sobrevive ao fato", () => {
  // É ela que permite responder depois "de onde veio esse custo?".
  const r = aceitarFato("marca", "Modare", "informado");
  assert.equal(r.aceito, true);
  assert.deepEqual(r.fato, { valor: "Modare", procedencia: "informado" });
});
