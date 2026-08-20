// A foto do acervo é QUADRADA antes de subir — a ligação que faltava.
//
// ===========================================================================
// O CASO, 20/08/2026
// ===========================================================================
//
// O Papete Modare tinha CINCO fotos boas no acervo da lojista, uma por cor,
// todas em 960x1280. Os anúncios dela no Mercado Livre continuavam com capa
// `492x245`, e sete deles derrubados por isso — 360 pares parados.
//
// O software tinha as três peças, e elas nunca se encontraram:
//
//   `melhor-capa`  promove foto que JÁ está no padrão. Nenhuma estava, então
//                  respondeu `trocariam: 0` e parou. Correto.
//   `quadrar-capa` completa a lateral com branco. Mas só sabe pegar a foto que
//                  já está DENTRO do anúncio, e lá só há a ruim. Correto.
//   `aplicar-capa` sobe a foto do acervo. E subia 960x1280 como estava, que o
//                  ML recusa por não ser quadrada. Correto.
//
// Cada uma parou na própria trava, e as três estavam certas. Faltava uma linha:
// a foto do acervo passa por `quadrarCapa` antes de subir.
//
// ===========================================================================
// POR QUE SÓ O CAMINHO DO ACERVO QUADRA
// ===========================================================================
//
// Quando a foto JÁ vive no ML, `aplicar-capa` reusa o id em vez de reenviar.
// Quadrar ali criaria um id novo — e id novo foi exatamente o defeito de
// 13/08/2026, quando uma capa foi "trocada" por uma cópia pior de si mesma.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./aplicar-capa/route.ts", import.meta.url), "utf8");
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("a foto do acervo passa por quadrarCapa antes de subir", () => {
  assert.match(
    CODIGO,
    /const pronta = await quadrarCapa\(bytes\)/,
    "sumiu o quadrado: a foto do acervo volta a subir 960x1280 e o ML recusa"
  );
  // A ordem importa: quadrar DEPOIS de subir não serviria para nada.
  const iQuadrar = CODIGO.indexOf("quadrarCapa(bytes)");
  const iSubir = CODIGO.indexOf("subirFoto(tokens.accessToken, enviar");
  assert.ok(iQuadrar > 0 && iSubir > 0, "as duas etapas precisam existir");
  assert.ok(iQuadrar < iSubir, "o quadrado passou a acontecer depois do upload");
});

// A recusa "já está dentro do padrão" é SUCESSO, não falha: significa que a
// foto serve como está. Tratá-la como erro impediria de aplicar justamente a
// foto boa — o defeito ao contrário.
test("foto que já está no padrão não é tratada como erro", () => {
  assert.match(
    CODIGO,
    /jaEstavaNoPadrao/,
    "a recusa 'já está no padrão' voltou a ser tratada como falha — foto boa seria rejeitada"
  );
  assert.match(
    CODIGO,
    /const enviar = pronta\.ok \? pronta\.imagem : bytes/,
    "quando não há o que quadrar, o original tem de subir mesmo assim"
  );
});

// A foto que JÁ vive no ML continua sendo reusada pelo id, sem passar por
// quadrado nem por upload. Reprocessá-la criaria id novo e pioraria a capa.
test("a foto que já vive no ML continua sendo reusada pelo id", () => {
  assert.match(
    CODIGO,
    /const idNoML = idDaFotoNoML\(foto\.url as string\)/,
    "o reuso do id sumiu: toda foto voltaria a ser reenviada, criando id novo"
  );
  const iId = CODIGO.indexOf("idDaFotoNoML");
  const iQuadrar = CODIGO.indexOf("quadrarCapa(bytes)");
  assert.ok(iId < iQuadrar, "o quadrado passou a acontecer antes do reuso do id");
});
