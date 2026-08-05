// Todo assunto que o domínio sabe contar tem que ser ALCANÇÁVEL pela rota.
//
// ===========================================================================
// O DEFEITO: UMA PERGUNTA ANUNCIADA E IMPOSSÍVEL
// ===========================================================================
//
// `infracao` existia em três lugares e faltava no quarto:
//
//   · `AssuntoContavel` (o tipo)                              ✔
//   · `contarPara` — com o cuidado de distinguir              ✔
//     "não li as infrações" de "não há infrações"
//   · `POSSO_RESPONDER`, que ANUNCIA a pergunta à lojista      ✔
//     ("Quantas infrações o Mercado Livre registrou na sua conta")
//   · o `enum` de `assunto` no schema de `/api/assistente`     ✘
//
// Com saída estruturada em json_schema, o modelo NÃO EMITE valor fora do enum.
// O prompt pedia `infracao`, o card de recusa oferecia a pergunta, e ela era a
// única da lista sem resposta possível. Todo aquele ramo cuidadoso era código
// que ninguém alcançava.
//
// A forma do defeito é a que este projeto já viu duas vezes: uma verdade num
// lugar e uma CÓPIA dela em outro, divergindo em silêncio. Typecheck não pega —
// o enum do schema é um array de strings, não o tipo. Só um teste pega.
//
// Por isso a asserção é nos DOIS SENTIDOS. Faltar assunto no enum torna uma
// pergunta impossível; sobrar assunto no enum deixa o modelo emitir um valor
// que o `switch` do domínio não trata.

import { test } from "node:test";
import assert from "node:assert/strict";

import { lerFonte } from "../../../testing/lerFonte.ts";
import { ASSUNTOS_CONTAVEIS_PARA_TESTE, POSSO_RESPONDER } from "./perguntaDaOperacao.ts";

const ROTA = lerFonte(new URL("../../../app/api/assistente/route.ts", import.meta.url), "utf8");

/** Os valores do `enum` de `assunto` no schema da rota, lidos da fonte. */
function assuntosDoSchema(): string[] {
  const bloco = /assunto:\s*\{\s*type:\s*"string",\s*enum:\s*\[([\s\S]*?)\]/.exec(ROTA);
  assert.ok(bloco, "não achei o enum de `assunto` no schema da rota");
  return [...bloco[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

test("todo assunto contável do domínio existe no enum da rota", () => {
  const doSchema = new Set(assuntosDoSchema());
  for (const assunto of ASSUNTOS_CONTAVEIS_PARA_TESTE) {
    assert.ok(
      doSchema.has(assunto),
      `"${assunto}" é contável no domínio e NÃO está no enum da rota — o modelo não consegue pedir`
    );
  }
});

test("o enum da rota não tem assunto que o domínio não sabe contar", () => {
  // "nenhum" é o único valor que não é assunto: ele significa "não se aplica".
  const contaveis = new Set<string>([...ASSUNTOS_CONTAVEIS_PARA_TESTE, "nenhum"]);
  for (const a of assuntosDoSchema()) {
    assert.ok(contaveis.has(a), `o enum oferece "${a}", que o domínio não sabe contar`);
  }
});

test("infração é alcançável — foi ela que faltava", () => {
  assert.ok(assuntosDoSchema().includes("infracao"));
});

test("o que POSSO_RESPONDER anuncia sobre infração tem caminho", () => {
  // A lista é texto para gente ler, então não dá para casar item a item com o
  // enum. Mas se ela PROMETE infração, o caminho precisa existir — e essa era
  // exatamente a promessa quebrada.
  const prometeInfracao = POSSO_RESPONDER.some((p) => /infra/i.test(p));
  if (prometeInfracao) {
    assert.ok(
      assuntosDoSchema().includes("infracao"),
      "o card oferece a pergunta sobre infrações e o schema não deixa pedir"
    );
  }
});

test("o prompt da rota e o enum falam do mesmo assunto", () => {
  // O prompt pedia `infracao` a um modelo que não podia emitir. Instrução sem
  // enum é instrução que a API silenciosamente descarta.
  const noPrompt = /"infracao"/.test(ROTA);
  assert.equal(
    noPrompt,
    assuntosDoSchema().includes("infracao"),
    "o prompt e o enum discordam sobre infração"
  );
});
