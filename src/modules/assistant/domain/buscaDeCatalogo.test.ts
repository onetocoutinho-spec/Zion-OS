import test from "node:test";
import assert from "node:assert/strict";

import {
  classificar,
  comoAchado,
  LIMITE_DE_CANDIDATOS,
  paraOModelo,
  pareceEan,
  pareceModelo,
  tentativasPara,
  type LinhaEncontrada,
} from "./buscaDeCatalogo";

/** Linhas com a forma REAL desta base — SKU com zero inicial, EAN de 13. */
const VARIANTE: LinhaEncontrada = {
  produtoId: "p1",
  nome: "Babuche Molekinha Arco Iris 22591.408",
  marca: "Molekinha",
  modelo: "22591.408",
  varianteId: "v1",
  sku: "01040533",
  ean: "7900350512518",
  cor: "Branco",
  tamanho: "33/34",
};

const PRODUTO: LinhaEncontrada = {
  produtoId: "p1",
  nome: "Babuche Molekinha Arco Iris 22591.408",
  marca: "Molekinha",
  modelo: "22591.408",
};

// ---- FORMATO, não identidade ----

test("13, 12 e 8 dígitos parecem EAN; o resto não", () => {
  assert.equal(pareceEan("7900350512518"), true);
  assert.equal(pareceEan("790035051251"), true);
  assert.equal(pareceEan("79003505"), true);
  assert.equal(pareceEan("01040533"), true, "8 dígitos: vale tentar");
  assert.equal(pareceEan("22591.408"), false);
  assert.equal(pareceEan("Havaianas"), false);
});

test("o modelo desta base tem a forma 22591.408", () => {
  assert.equal(pareceModelo("22591.408"), true);
  assert.equal(pareceModelo("7178.102"), true);
  assert.equal(pareceModelo("6510.133"), true);
  assert.equal(pareceModelo("7900350512518"), false);
  assert.equal(pareceModelo("Modare"), false);
});

// ---- ESTRATÉGIA ----

test("campo explícito faz UMA tentativa, na coluna real", () => {
  // `referencia` na linguagem do lojista mapeia para `produtos.modelo`. Não
  // existe coluna `referencia` neste banco.
  assert.deepEqual(tentativasPara("7178.102", "referencia"), [
    { coluna: "modelo", modo: "exato", termo: "7178.102", casamento: "modelo_exato" },
  ]);
  assert.equal(tentativasPara("01040533", "sku")[0].coluna, "sku");
  assert.equal(tentativasPara("7900350512518", "ean")[0].coluna, "ean");
  assert.equal(tentativasPara("Havaianas", "nome")[0].coluna, "nome");
});

test("auto tenta EAN antes de SKU quando o formato é de EAN de 13", () => {
  const t = tentativasPara("7900350512518", "auto");
  assert.equal(t[0].coluna, "ean");
  assert.ok(t.some((x) => x.coluna === "sku"));
});

test("auto tenta modelo quando a forma é de modelo", () => {
  const t = tentativasPara("7178.102", "auto");
  assert.equal(t[0].coluna, "modelo");
});

test("auto SEMPRE termina em busca textual — a mais fraca, por último", () => {
  for (const termo of ["01040533", "7178.102", "Havaianas Top", "7900350512518"]) {
    const t = tentativasPara(termo, "auto");
    assert.equal(t[t.length - 1].coluna, "nome", termo);
    assert.equal(t[t.length - 1].casamento, "candidato_textual", termo);
  }
});

test("termo com espaço não tenta identificador exato", () => {
  // "Havaianas Top" não é SKU nem modelo. Tentar igualdade ali é ruído.
  const t = tentativasPara("Havaianas Top", "auto");
  assert.equal(t.some((x) => x.modo === "exato"), false);
});

test("termo vazio não produz tentativa nenhuma", () => {
  assert.deepEqual(tentativasPara("", "auto"), []);
  assert.deepEqual(tentativasPara("   ", "auto"), []);
});

test("O TERMO NUNCA É CONVERTIDO — 473 SKUs desta base começam com zero", () => {
  // `Number("01040533")` viraria 1040533, que não existe no banco.
  for (const campo of ["auto", "sku", "ean"] as const) {
    for (const t of tentativasPara("01040533", campo)) {
      assert.equal(t.termo, "01040533", `${campo} perdeu o zero`);
      assert.equal(typeof t.termo, "string");
    }
  }
});

test("EAN com zero inicial atravessa intacto", () => {
  const t = tentativasPara("0123456789012", "ean");
  assert.equal(t[0].termo, "0123456789012");
  assert.notEqual(t[0].termo, "123456789012");
});

// ---- DESFECHO ----

test("UM resultado: encontrado", () => {
  const r = classificar([VARIANTE], "sku_exato", "01040533");
  assert.equal(r.desfecho, "encontrado");
  assert.equal(r.total, 1);
  assert.equal(r.achado.casamento, "sku_exato");
});

test("SKU EXATO DUPLICADO é AMBÍGUO — 117 casos reais nesta base", () => {
  // Busca exata não significa identidade única. Pegar o primeiro aqui
  // reproduziria o incidente de matching.
  const r = classificar([VARIANTE, { ...VARIANTE, varianteId: "v2", tamanho: "35/36" }], "sku_exato", "01040533");
  assert.equal(r.desfecho, "ambiguo");
  assert.equal(r.total, 2);
  assert.match(r.mensagem, /eu não escolho por você/);
});

test("EAN duplicado também é ambíguo — 112 casos reais", () => {
  const r = classificar([VARIANTE, { ...VARIANTE, varianteId: "v2" }], "ean_exato", "7900350512518");
  assert.equal(r.desfecho, "ambiguo");
});

test("modelo repetido é ambíguo — 2 casos reais", () => {
  const r = classificar([PRODUTO, { ...PRODUTO, produtoId: "p2" }], "modelo_exato", "22591.408");
  assert.equal(r.desfecho, "ambiguo");
});

test("nada encontrado diz isso, sem inventar", () => {
  const r = classificar([], "sku_exato", "XPTO");
  assert.equal(r.desfecho, "nada");
  assert.match(r.mensagem, /Não encontrei nada com "XPTO"/);
});

test("candidatos são cortados no limite, mas o TOTAL é o real", () => {
  // Um modelo com 84 variantes devolve 8 e o total. Mandar 84 objetos ao modelo
  // estouraria o contexto sem ajudar ninguém a decidir.
  const muitas = Array.from({ length: 84 }, (_, i) => ({ ...VARIANTE, varianteId: `v${i}` }));
  const r = classificar(muitas, "modelo_exato", "22591.408");
  assert.equal(r.desfecho, "ambiguo");
  assert.equal(r.candidatos.length, LIMITE_DE_CANDIDATOS);
  assert.equal(r.total, 84);
  assert.match(r.mensagem, /84 resultados/);
});

// ---- PRODUTO vs VARIANTE ----

test("SKU e EAN resolvem na VARIANTE; modelo e nome, no PRODUTO", () => {
  assert.equal(comoAchado(VARIANTE, "sku_exato").tipo, "variante");
  assert.equal(comoAchado(VARIANTE, "ean_exato").tipo, "variante");
  assert.equal(comoAchado(PRODUTO, "modelo_exato").tipo, "produto");
  assert.equal(comoAchado(PRODUTO, "candidato_textual").tipo, "produto");
});

test("casamento de variante SEM varianteId cai para produto", () => {
  // Sem o id da variante não há variante para apontar. Chamar de variante
  // deixaria a próxima etapa sem alvo.
  assert.equal(comoAchado(PRODUTO, "sku_exato").tipo, "produto");
});

// ---- O QUE O MODELO RECEBE ----

test("o modelo recebe o CASAMENTO — para não tratar semelhança como identidade", () => {
  const r = paraOModelo(classificar([VARIANTE], "candidato_textual", "molekinha")) as Record<string, unknown>;
  const a = r.achado as Record<string, unknown>;
  assert.equal(a.casamento, "candidato_textual");
});

test("ambíguo manda AVISO explícito para o modelo não escolher", () => {
  const r = paraOModelo(
    classificar([VARIANTE, { ...VARIANTE, varianteId: "v2" }], "sku_exato", "01040533")
  ) as Record<string, unknown>;
  assert.match(String(r.aviso), /PERGUNTE ao lojista/);
  assert.equal(r.total, 2);
});

test("a saída usa REFERENCIA na linguagem do lojista, mapeada de modelo", () => {
  const r = paraOModelo(classificar([VARIANTE], "sku_exato", "x")) as Record<string, unknown>;
  const a = r.achado as Record<string, unknown>;
  assert.equal(a.referencia, "22591.408");
  assert.equal("modelo" in a, false);
});

test("a saída é enxuta — sem campo nulo e sem metadata técnica", () => {
  const semNada: LinhaEncontrada = { produtoId: "p9", nome: "X", marca: null, modelo: null };
  const r = paraOModelo(classificar([semNada], "candidato_textual", "x")) as Record<string, unknown>;
  const a = r.achado as Record<string, unknown>;
  assert.deepEqual(Object.keys(a).sort(), ["casamento", "nome", "produtoId", "tipo"]);
});

test("o EAN atravessa como STRING até a saída", () => {
  const r = paraOModelo(classificar([VARIANTE], "ean_exato", "7900350512518")) as Record<string, unknown>;
  const a = r.achado as Record<string, unknown>;
  assert.equal(a.ean, "7900350512518");
  assert.equal(typeof a.ean, "string");
});

test("SKU com zero inicial chega intacto na saída", () => {
  const r = paraOModelo(classificar([VARIANTE], "sku_exato", "01040533")) as Record<string, unknown>;
  const a = r.achado as Record<string, unknown>;
  assert.equal(a.sku, "01040533");
});
