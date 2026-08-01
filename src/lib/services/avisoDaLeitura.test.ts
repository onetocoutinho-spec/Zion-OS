// A frase que conta a verdade da leitura.
//
// "489 já existiam" se lê como "está tudo em dia". Naquele dia faltavam 61, e
// ninguém tinha como saber. Silêncio aqui não é neutro: ele AFIRMA completude.
//
// O contrário também precisa valer: quando a leitura foi completa, não pode
// sair frase nenhuma. Um aviso permanente vira ruído e some da vista em duas
// semanas — e aí a mudez volta, disfarçada de aviso.

import test from "node:test";
import assert from "node:assert/strict";
import { avisoDaLeitura, type LeituraRelatada } from "./importarAnunciosML.ts";

const leitura = (p: Partial<LeituraRelatada> = {}): LeituraRelatada => ({
  total: 561,
  ids: 561,
  perdidos: 0,
  parede: "nenhuma",
  ...p,
});

test("leitura completa NÃO produz frase — senão o aviso vira ruído", () => {
  assert.equal(avisoDaLeitura(leitura()), undefined);
});

test("sem leitura (rota antiga, resposta velha) não inventa nada", () => {
  assert.equal(avisoDaLeitura(undefined), undefined);
});

test("o ML não informar o total não vira acusação de falta", () => {
  // total = -1 significa "não sei", e "não sei" não é "faltou".
  assert.equal(avisoDaLeitura(leitura({ total: -1, ids: 500 })), undefined);
});

test("leu menos que o total: a frase traz os DOIS números", () => {
  const f = avisoDaLeitura(leitura({ total: 561, ids: 500 }));
  assert.ok(f, "leitura incompleta ficou muda");
  assert.match(f, /561/);
  assert.match(f, /500/);
});

test("o caso real de 2026-08-01 produz uma frase que teria evitado o erro", () => {
  const f = avisoDaLeitura({ total: 561, ids: 500, perdidos: 0, parede: "offset-1000" });
  assert.ok(f);
  assert.match(f, /561/);
  assert.match(f, /500/);
});

test("anúncios perdidos no multiget aparecem", () => {
  const f = avisoDaLeitura(leitura({ perdidos: 20 }));
  assert.ok(f, "20 anúncios sumiram em silêncio");
  assert.match(f, /20/);
});

test("a parede dos 1.000 explica que falta OUTRO endpoint, não que deu erro", () => {
  const f = avisoDaLeitura(leitura({ total: 1200, ids: 1000, parede: "offset-1000" }));
  assert.ok(f);
  assert.match(f, /1\.000/);
});

test("a paginação parar antes do total é dito como o que é: sem motivo", () => {
  const f = avisoDaLeitura(leitura({ total: 561, ids: 300, parede: "paginacao-parou" }));
  assert.ok(f);
  assert.match(f, /sem dizer por qu/i);
});

test("duas falhas ao mesmo tempo saem as duas — uma não engole a outra", () => {
  const f = avisoDaLeitura({ total: 561, ids: 500, perdidos: 20, parede: "offset-1000" });
  assert.ok(f);
  assert.match(f, /561/);
  assert.match(f, /20/);
  assert.match(f, /1\.000/);
});
