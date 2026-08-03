// Deixar a foto quadrada sem inventar pixel.
//
// Medido na conta da Chinelaria em 02/08/2026, pelo `max_size` do próprio ML:
//
//     993x1200 · 961x1200 · 896x1152 · 559x699 · 552x684
//
// Não são fotos pequenas: são fotos EM PÉ. Falta a lateral, não a resolução.
//
// O que estes testes protegem é a RECUSA. Completar é seguro; cortar, esticar e
// ampliar não são — e as três seriam mais fáceis de escrever.

import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { quadrarCapa, maiorVariacao, LADO_ALVO } from "./quadrarCapa.ts";

/** Uma imagem de teste com cor sólida, para conferir o que sobrou nas bordas. */
const imagem = (largura: number, altura: number, cor = { r: 200, g: 40, b: 40 }) =>
  sharp({ create: { width: largura, height: altura, channels: 3, background: cor } })
    .jpeg()
    .toBuffer();

// ---------------------------------------------------------------------------
// O CASO REAL
// ---------------------------------------------------------------------------

test("993x1200 vira 1200x1200 — o caso da conta dela", async () => {
  const r = await quadrarCapa(await imagem(993, 1200));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const m = await sharp(r.imagem).metadata();
  assert.equal(m.width, LADO_ALVO);
  assert.equal(m.height, LADO_ALVO);
  assert.equal(r.de, "993x1200");
  assert.equal(r.para, "1200x1200");
});

test("deitada também: 1600x900 vira 1200x1200", async () => {
  const r = await quadrarCapa(await imagem(1600, 900));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const m = await sharp(r.imagem).metadata();
  assert.equal(m.width, LADO_ALVO);
  assert.equal(m.height, LADO_ALVO);
});

// ---------------------------------------------------------------------------
// COMPLETA — NÃO CORTA, NÃO ESTICA
// ---------------------------------------------------------------------------

test("o que sobra é BRANCO, e o produto continua inteiro no meio", async () => {
  // `cover` cortaria o sapato; `fill` o esticaria. Um chinelo esticado é um
  // chinelo que não existe, e a compradora decide a compra por ele.
  const r = await quadrarCapa(await imagem(600, 1200));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const { data, info } = await sharp(r.imagem).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => {
    const i = (y * info.width + x) * info.channels;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  };
  const canto = px(5, 600); // faixa lateral esquerda
  assert.ok(canto.r > 240 && canto.g > 240 && canto.b > 240, `lateral não ficou branca: ${JSON.stringify(canto)}`);
  const centro = px(600, 600);
  assert.ok(centro.r > 150 && centro.g < 100, `o produto sumiu do centro: ${JSON.stringify(centro)}`);
});

test("a proporção do produto é preservada", async () => {
  // 600x1200 é 1:2. Depois de completar, o conteúdo continua 1:2 — 600 de
  // largura e 1200 de altura dentro do quadrado.
  const r = await quadrarCapa(await imagem(600, 1200));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const { data, info } = await sharp(r.imagem).raw().toBuffer({ resolveWithObject: true });
  const ehProduto = (x: number, y: number) => {
    const i = (y * info.width + x) * info.channels;
    return data[i] > 150 && data[i + 1] < 100;
  };
  let largura = 0;
  for (let x = 0; x < info.width; x++) if (ehProduto(x, 600)) largura++;
  assert.ok(Math.abs(largura - 600) <= 4, `o conteúdo ficou com ${largura}px de largura, esperado ~600`);
});

// ---------------------------------------------------------------------------
// AS RECUSAS — cada uma é uma proteção
// ---------------------------------------------------------------------------

test("RECUSA ampliar: sem 1200 em nenhum lado, é foto nova", async () => {
  // Esticar 699x344 para 1200 deixa borrado, e borrado é exatamente o que o ML
  // está punindo. Trocaríamos um defeito por outro.
  const r = await quadrarCapa(await imagem(699, 344));
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.motivo, /699x344/);
  assert.match(r.motivo, /foto nova/i);
});

test("RECUSA mexer no que já está bom", async () => {
  // Reprocessar um JPEG só o degrada mais uma vez.
  const r = await quadrarCapa(await imagem(1200, 1200));
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.motivo, /j[áa] est[áa]/i);
});

test("1199x1199 é recusada — quase lá não é lá", async () => {
  const r = await quadrarCapa(await imagem(1199, 1199));
  assert.equal(r.ok, false);
});

test("2000x2000 é recusada: já é quadrada e maior que o mínimo", async () => {
  const r = await quadrarCapa(await imagem(2000, 2000));
  assert.equal(r.ok, false);
});

test("lixo no lugar de imagem é RECUSADO, não sobe para o anúncio", async () => {
  const r = await quadrarCapa(Buffer.from("isto não é uma imagem"));
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.motivo, /n[ãa]o consegui ler/i);
});

// ---------------------------------------------------------------------------
// A MAIOR VARIAÇÃO — sem adivinhar pelo sufixo
// ---------------------------------------------------------------------------

test("escolhe a maior por ÁREA, não pela ordem", () => {
  const r = maiorVariacao([
    { size: "500x500", secure_url: "https://x/o.jpg" },
    { size: "1200x1200", secure_url: "https://x/f.jpg" },
    { size: "800x800", secure_url: "https://x/b.jpg" },
  ]);
  assert.deepEqual(r, { url: "https://x/f.jpg", size: "1200x1200" });
});

test("variação sem `size` legível é IGNORADA — escolher no escuro não vale", () => {
  // Adivinhar pelo sufixo da URL não funciona: medido em 02/08/2026, `-F` é a
  // maior numa imagem e é 492x245 em outra.
  const r = maiorVariacao([
    { size: "", secure_url: "https://x/1.jpg" },
    { secure_url: "https://x/2.jpg" },
    { size: "800x800", secure_url: "https://x/3.jpg" },
  ]);
  assert.equal(r?.url, "https://x/3.jpg");
});

test("sem variação utilizável devolve null", () => {
  assert.equal(maiorVariacao([]), null);
  assert.equal(maiorVariacao([{ size: "1200x1200" }]), null, "sem URL não serve");
  assert.equal(maiorVariacao([{ secure_url: "https://x/1.jpg" }]), null, "sem tamanho não serve");
});

test("`url` serve quando não há `secure_url`", () => {
  assert.equal(maiorVariacao([{ size: "900x900", url: "http://x/1.jpg" }])?.url, "http://x/1.jpg");
});

// ---------------------------------------------------------------------------
// A FRASE SEGUE A CAPA, NÃO O STATUS HTTP
// ---------------------------------------------------------------------------

import { explicarCapaQuadrada } from "../../../lib/services/quadrarCapaML.ts";

test("capa NÃO trocada: a frase diz isso, e não diz 'ajustada'", () => {
  // 03/08/2026: a frase dizia "Capa ajustada" porque o `PUT` voltou 200 — e o
  // 200 significa que o ML ACEITOU o pedido, não que a capa mudou. A lojista
  // reconferiu e a capa continuava a antiga.
  const f = explicarCapaQuadrada({
    itemId: "MLB1",
    de: "960x1200",
    para: "1200x1200",
    fotosAntes: 12,
    fotosDepois: 13,
    capaTrocada: false,
    temVariacoes: false,
  });
  assert.match(f, /N[ÃA]O MUDOU/i);
  assert.doesNotMatch(f, /Capa ajustada de/);
  assert.match(f, /nenhuma foto foi perdida/i);
});

test("com variação, a frase diz ONDE está o caminho", () => {
  // Em anúncio com variação o ML controla as fotos por variação. Repetir a
  // tentativa não resolve, e dizer isso é mais útil que deixar tentar de novo.
  const f = explicarCapaQuadrada({
    itemId: "MLB1",
    de: "960x1200",
    para: "1200x1200",
    fotosAntes: 12,
    fotosDepois: 13,
    capaTrocada: false,
    temVariacoes: true,
  });
  assert.match(f, /varia/i);
});

test("capa trocada: aí sim a frase afirma o ajuste", () => {
  const f = explicarCapaQuadrada({
    itemId: "MLB1",
    de: "960x1200",
    para: "1200x1200",
    fotosAntes: 12,
    fotosDepois: 13,
    capaTrocada: true,
    temVariacoes: false,
  });
  assert.match(f, /Capa ajustada de 960x1200 para 1200x1200/);
  assert.match(f, /12 fotos originais/);
});

test("foto perdida é avisada mesmo com a capa trocada", () => {
  const f = explicarCapaQuadrada({
    itemId: "MLB1",
    de: "960x1200",
    para: "1200x1200",
    fotosAntes: 12,
    fotosDepois: 8,
    capaTrocada: true,
    temVariacoes: false,
  });
  assert.match(f, /ATEN[ÇC][ÃA]O/);
  assert.match(f, /8/);
});
