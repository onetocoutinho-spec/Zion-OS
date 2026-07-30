import { test } from "node:test";
import assert from "node:assert/strict";
import { embalagemDe, type MedidasDaVariante } from "./embalagemDoProduto.ts";

const vazia = (): MedidasDaVariante => ({
  peso: null,
  altura: null,
  largura: null,
  comprimento: null,
});

// ---------------------------------------------------------------------------
// REGRESSÃO: a semântica movida do serviço tem que continuar idêntica
// ---------------------------------------------------------------------------

test("sem variantes: null", () => {
  assert.equal(embalagemDe([]), null);
});

test("variantes sem medida nenhuma: null", () => {
  assert.equal(embalagemDe([vazia(), vazia()]), null);
});

test("peso em KG vira GRAMAS, arredondado", () => {
  const e = embalagemDe([{ ...vazia(), peso: 0.42 }]);
  assert.equal(e?.pesoGramas, 420);
});

test("é o MÁXIMO entre as variantes, não soma nem média", () => {
  const e = embalagemDe([
    { ...vazia(), peso: 0.3 },
    { ...vazia(), peso: 0.5 },
    { ...vazia(), peso: 0.4 },
  ]);
  assert.equal(e?.pesoGramas, 500);
});

test("o máximo é por campo, independentemente — cada um da sua variante", () => {
  const e = embalagemDe([
    { peso: 0.5, altura: 2, largura: null, comprimento: null },
    { peso: 0.1, altura: 30, largura: 20, comprimento: null },
    { peso: null, altura: null, largura: 5, comprimento: 40 },
  ]);
  assert.deepEqual(e, { pesoGramas: 500, alturaCm: 30, larguraCm: 20, comprimentoCm: 40 });
});

test("BASTA UM CAMPO: só dimensão, sem peso nenhum, JÁ É embalagem", () => {
  // É esta regra que faz um produto sem peso não estar bloqueado por peso.
  const e = embalagemDe([{ peso: null, altura: 10, largura: null, comprimento: null }]);
  assert.notEqual(e, null);
  assert.equal(e?.pesoGramas, 0);
});

test("zero não conta como medida", () => {
  assert.equal(
    embalagemDe([{ peso: 0, altura: 0, largura: 0, comprimento: 0 }]),
    null
  );
});

test("negativo não inventa embalagem", () => {
  assert.equal(embalagemDe([{ peso: -1, altura: -2, largura: null, comprimento: null }]), null);
});

test("peso minúsculo que arredonda para zero grama não vira embalagem sozinho", () => {
  // 0.0004 kg -> 0.4 g -> arredonda para 0. Sem outra medida, não há embalagem.
  assert.equal(
    embalagemDe([{ peso: 0.0004, altura: null, largura: null, comprimento: null }]),
    null
  );
});

// ---------------------------------------------------------------------------
// O CASO QUE FALSIFICOU O DESENHO ANTERIOR
// ---------------------------------------------------------------------------

test("UMA variante com peso entre cinco JÁ produz embalagem", () => {
  // Este produto entra no escopo do lote (tem variante sem peso) e mesmo assim
  // NUNCA esteve bloqueado por peso. É o controle B da causalidade.
  const cinco: MedidasDaVariante[] = [
    { ...vazia(), peso: 0.4 },
    vazia(),
    vazia(),
    vazia(),
    vazia(),
  ];
  assert.notEqual(embalagemDe(cinco), null);
  assert.equal(embalagemDe(cinco)?.pesoGramas, 400);
});

test("todas sem peso e sem dimensão: null — este SIM estava bloqueado", () => {
  assert.equal(embalagemDe([vazia(), vazia(), vazia()]), null);
});
