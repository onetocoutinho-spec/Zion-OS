// Testes de extrairErro() — a tradutora do VEREDITO do Mercado Livre (PR-006).
//
// O ML devolve o detalhe da rejeição em DOIS formatos: `cause[]` (clássico) e
// `errors[]` (com message e cause[] aninhados). Estes testes provam que ambos
// produzem mensagens ESPECÍFICAS — o feedback do ambiente não é mais perdido.
// 100% puro: Response construída localmente, sem rede.
// Rodar: npx tsx --test src/lib/marketplaces/mercadolivre.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { extrairErro, medidasDoItem } from "./mercadolivre.ts";

function resposta(corpo: unknown, status = 400): Response {
  return new Response(JSON.stringify(corpo), { status });
}

test("formato clássico cause[]: mensagem + causas específicas", async () => {
  const msg = await extrairErro(
    resposta({
      message: "Validation error",
      cause: [
        { message: "attribute GTIN is required" },
        { message: "invalid category_id" },
      ],
    })
  );
  assert.equal(msg, "Validation error — attribute GTIN is required; invalid category_id");
});

test("formato errors[]: mensagens e causas aninhadas são extraídas", async () => {
  const msg = await extrairErro(
    resposta({
      message: "Chart validation errors found",
      errors: [
        {
          message: "row 3: FOOT_LENGTH out of range",
          cause: [{ message: "expected 20cm-35cm" }],
        },
        { message: "chart_name_unavailable" },
      ],
    })
  );
  assert.equal(
    msg,
    "Chart validation errors found — row 3: FOOT_LENGTH out of range; expected 20cm-35cm; chart_name_unavailable"
  );
});

test("os dois formatos juntos: tudo é preservado", async () => {
  const msg = await extrairErro(
    resposta({
      error: "bad_request",
      cause: [{ message: "causa clássica" }],
      errors: [{ message: "erro detalhado" }],
    })
  );
  assert.equal(msg, "bad_request — causa clássica; erro detalhado");
});

test("corpo sem detalhe → HTTP status como último recurso", async () => {
  assert.equal(await extrairErro(resposta({}, 403)), "HTTP 403");
  assert.equal(
    await extrairErro(new Response("não é json", { status: 500 })),
    "HTTP 500"
  );
});

// ── Medidas da embalagem vindas do item do ML ────────────────────────────────
//
// Até aqui a importação gravava peso e dimensões como ZERO, e zero significa
// "não sei" — o que deixava a precificação cega para o frete de todo produto
// importado. O ML tem o dado; era só ler.

test("lê shipping.dimensions no formato AxBxC,peso", () => {
  const m = medidasDoItem({ shipping: { dimensions: "30x20x10,1000" } });
  assert.deepEqual(m, { alturaCm: 30, larguraCm: 20, comprimentoCm: 10, pesoGramas: 1000 });
});

test("aceita dimensões com decimal e vírgula decimal", () => {
  const m = medidasDoItem({ shipping: { dimensions: "30,5x20x10,450" } });
  assert.equal(m.alturaCm, 30.5);
});

test("cai nos atributos PACKAGE_* quando não há shipping.dimensions", () => {
  const m = medidasDoItem({
    attributes: [
      { id: "PACKAGE_WEIGHT", value_name: "450 g" },
      { id: "PACKAGE_HEIGHT", value_name: "10 cm" },
      { id: "PACKAGE_WIDTH", value_name: "20 cm" },
      { id: "PACKAGE_LENGTH", value_name: "30 cm" },
    ],
  });
  assert.deepEqual(m, { pesoGramas: 450, alturaCm: 10, larguraCm: 20, comprimentoCm: 30 });
});

test("peso em kg é normalizado para gramas", () => {
  const m = medidasDoItem({ attributes: [{ id: "PACKAGE_WEIGHT", value_name: "0.45 kg" }] });
  assert.equal(m.pesoGramas, 450);
});

test("item sem nenhuma medida devolve zeros — que a precificação lê como pendência", () => {
  assert.deepEqual(medidasDoItem({}), {
    pesoGramas: 0,
    alturaCm: 0,
    larguraCm: 0,
    comprimentoCm: 0,
  });
});

test("dimensões malformadas não viram número inventado", () => {
  const m = medidasDoItem({ shipping: { dimensions: "sem medida aqui" } });
  assert.equal(m.pesoGramas, 0);
  assert.equal(m.alturaCm, 0);
});
