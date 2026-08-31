// O veredito da foto separa "não serve" de "não serve ASSIM".
//
// ===========================================================================
// O CASO, 20/08/2026
// ===========================================================================
//
// A lojista mandou pelo chat uma foto 960x1280 do Papete Creme. O cartão
// respondeu:
//
//   "Esta foto não é quadrada. O lado menor tem 960px e o Mercado Livre exige
//    1200. Subir assim não destrava o anúncio — ele continua como está."
//
// Cada frase é verdadeira e o conjunto está errado: a foto SERVIA. O Zion tem
// `quadrar-capa`, que completa a lateral com branco (`contain` — nunca corta,
// nunca estica) e devolve 1280x1280. A regra daquela rota é o MAIOR lado ≥
// 1200; 1280 passa com folga.
//
// O cartão media o lado MENOR e concluía pelo pior caso. Isso está certo para
// "esta foto já serve como está?" e errado como CONSELHO — mandava procurar
// foto nova existindo caminho para esta, e o custo disso é uma viagem ao
// fabricante.
//
// É o formato que este repositório persegue há semanas: o software sabe fazer e
// a mensagem diz que não dá.
//
// Este teste lê a FONTE porque o defeito não é de cálculo — é de conclusão. A
// conta do lado menor sempre esteve certa.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./ConferirFoto.tsx", import.meta.url), "utf8");

test("o veredito olha o MAIOR lado antes de mandar procurar foto nova", () => {
  assert.match(
    FONTE,
    /const maiorLado = Math\.max\(medida\.largura, medida\.altura\)/,
    "o cartão voltou a decidir só pelo lado menor — foto que serve vira foto recusada"
  );
});

test("quando dá para quadrar, o cartão OFERECE em vez de recusar", () => {
  assert.match(
    FONTE,
    /completar a lateral com branco/,
    "sumiu a oferta de quadrar: a lojista guarda uma foto que serve"
  );
  // E diz que nada se perde. Sem isso, "completar com branco" soa como recorte.
  assert.match(
    FONTE,
    /Nada é cortado nem esticado/,
    "o cartão parou de dizer que quadrar não corta nem estica"
  );
});

// A recusa continua existindo — e agora com o motivo CERTO. Abaixo de 1200 no
// maior lado, ampliar inventaria pixel; aí a foto realmente não serve.
test("abaixo do mínimo no MAIOR lado, a recusa continua e explica por quê", () => {
  assert.match(
    FONTE,
    /Ampliar inventaria pixel/,
    "a recusa perdeu o motivo: sem ele a lojista não sabe se é caso de refotografar"
  );
});

// A frase antiga não pode voltar sozinha: ela era categórica onde havia saída.
test("não voltou o 'continua como está' sem alternativa", () => {
  const semComentarios = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(
    !/Subir assim não destrava o anúncio — ele continua como está/.test(semComentarios),
    "voltou o veredito categórico que mandava procurar foto nova sem checar o maior lado"
  );
});
