// O cliente da OpenAI — a parte PURA: a leitura da resposta, o parser SSE, o
// mapa de esforço e a tradução de erro. Sem rede e sem chave.
//
// 23/08/2026: "quero utilizar somente o ChatGPT".

import test from "node:test";
import assert from "node:assert/strict";
import { ErroDaOpenAI, erroLegivelDaOpenAI, erroTransitorio, esforcoDaOpenAI, eventosSse, lerResposta } from "./openai";

test("lerResposta: texto, chamadas de função e uso (com cache) saem do output cru", () => {
  const r = lerResposta({
    id: "resp_1",
    model: "gpt-5-2025-08-07",
    status: "completed",
    output: [
      { type: "reasoning" },
      { type: "message", content: [{ type: "output_text", text: "Achei " }, { type: "output_text", text: "3." }] },
      { type: "function_call", call_id: "call_a", name: "achar_produto", arguments: '{"termo":"chinelo"}' },
      { type: "function_call", call_id: "call_b", name: "pendencias", arguments: "não é json" },
    ],
    usage: { input_tokens: 6200, output_tokens: 40, total_tokens: 6240, input_tokens_details: { cached_tokens: 6000 } },
  });
  assert.equal(r.texto, "Achei 3.");
  assert.deepEqual(r.chamadas, [
    { id: "call_a", nome: "achar_produto", args: { termo: "chinelo" } },
    { id: "call_b", nome: "pendencias", args: {} },
  ]);
  assert.deepEqual(r.uso, { entrada: 6200, saida: 40, total: 6240, lidosDoCache: 6000 });
  assert.equal(r.recusa, null);
  assert.equal(r.motivoIncompleta, null);
});

test("lerResposta: recusa e resposta incompleta não viram texto bom", () => {
  const recusada = lerResposta({ output: [{ type: "message", content: [{ type: "refusal", refusal: "não posso" }] }] });
  assert.equal(recusada.recusa, "não posso");
  assert.equal(recusada.texto, "");
  const cortada = lerResposta({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] });
  assert.equal(cortada.motivoIncompleta, "max_output_tokens");
  // Sem `usage` o uso é null — e null não vira zero (ver `RespostaIA.uso`).
  assert.equal(cortada.uso, null);
});

test("eventosSse: um JSON por evento, blocos partidos entre chunks se juntam, [DONE] é ignorado", async () => {
  const texto =
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Oi"}\n\n' +
    'data: {"type":"response.output_text.delta","del' +
    'ta":" tudo"}\n\ndata: [DONE]\n\n' +
    'data: {"type":"response.completed","response":{"id":"r"}}\n\n';
  const partes = [texto.slice(0, 70), texto.slice(70, 120), texto.slice(120)];
  const corpo = new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of partes) c.enqueue(new TextEncoder().encode(p));
      c.close();
    },
  });
  const eventos: Record<string, unknown>[] = [];
  for await (const e of eventosSse(corpo)) eventos.push(e);
  assert.deepEqual(
    eventos.map((e) => e.type),
    ["response.output_text.delta", "response.output_text.delta", "response.completed"]
  );
  assert.equal(eventos[1].delta, " tudo");
});

test("esforço: xhigh/max viram high (o teto da OpenAI); desconhecido some", () => {
  assert.equal(esforcoDaOpenAI("low"), "low");
  assert.equal(esforcoDaOpenAI("xhigh"), "high");
  assert.equal(esforcoDaOpenAI("max"), "high");
  assert.equal(esforcoDaOpenAI("qualquer"), undefined);
  assert.equal(esforcoDaOpenAI(undefined), undefined);
});

test("erro: 401 vira 'chave inválida', 429 vira 'muitas perguntas', 5xx vira 'sobrecarregada' — e o status sobrevive para a reserva", () => {
  assert.match(erroLegivelDaOpenAI(new ErroDaOpenAI("OpenAI 401: x", 401)).message, /OPENAI_API_KEY inválida/);
  assert.match(erroLegivelDaOpenAI(new ErroDaOpenAI("OpenAI 429: rate", 429)).message, /Muitas perguntas/);
  assert.match(erroLegivelDaOpenAI(new ErroDaOpenAI("OpenAI 429: insufficient_quota", 429)).message, /sem crédito/);
  const sobrecarga = erroLegivelDaOpenAI(new ErroDaOpenAI("OpenAI 503", 503));
  assert.match(sobrecarga.message, /sobrecarregada/);
  assert.equal((sobrecarga as ErroDaOpenAI).status, 503);
  assert.equal(erroTransitorio(new ErroDaOpenAI("x", 400)), false);
  assert.equal(erroTransitorio(new ErroDaOpenAI("x", 503)), true);
  // Um erro genérico passa como está.
  assert.equal(erroLegivelDaOpenAI(new Error("outro")).message, "outro");
});
