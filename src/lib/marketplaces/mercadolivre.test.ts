// Testes de extrairErro() — a tradutora do VEREDITO do Mercado Livre (PR-006).
//
// O ML devolve o detalhe da rejeição em DOIS formatos: `cause[]` (clássico) e
// `errors[]` (com message e cause[] aninhados). Estes testes provam que ambos
// produzem mensagens ESPECÍFICAS — o feedback do ambiente não é mais perdido.
// 100% puro: Response construída localmente, sem rede.
// Rodar: npx tsx --test src/lib/marketplaces/mercadolivre.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { extrairErro } from "./mercadolivre.ts";

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
