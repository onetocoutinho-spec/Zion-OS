import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { origemDaFoto } from "./origemDaFoto";

const SUPABASE = "https://abcdefgh.supabase.co";
const LOJA = "11111111-1111-4111-8111-111111111111";
const PRODUTO = "22222222-2222-4222-8222-222222222222";
const BOA = `${SUPABASE}/storage/v1/object/public/produtos-imagens/${LOJA}/${PRODUTO}/1700000000-capa.jpg`;

test("a URL do bucket do projeto é aceita e diz de que loja é a foto", () => {
  const o = origemDaFoto(BOA, SUPABASE);
  assert.equal(o.ok, true);
  if (o.ok) {
    assert.equal(o.clienteId, LOJA);
    assert.equal(o.caminho, `${LOJA}/${PRODUTO}/1700000000-capa.jpg`);
    assert.equal(o.url, BOA);
  }
});

test("query e fragmento são descartados — o caminho já diz tudo", () => {
  const o = origemDaFoto(`${BOA}?download=1#x`, SUPABASE);
  assert.equal(o.ok, true);
  if (o.ok) assert.equal(o.url, BOA);
});

// SSRF: tudo isto era aceito pelo `fetch(corpo.imagemUrl)` antigo.
for (const [nome, url] of [
  ["metadata da nuvem", "http://169.254.169.254/latest/meta-data/"],
  ["loopback", "http://127.0.0.1:5432/"],
  ["loopback em https", "https://localhost/"],
  ["outro host https", "https://evil.example.com/foto.jpg"],
  ["host parecido", "https://abcdefgh.supabase.co.evil.com/storage/v1/object/public/produtos-imagens/x"],
  ["mesmo host, http", `http://abcdefgh.supabase.co/storage/v1/object/public/produtos-imagens/${LOJA}/${PRODUTO}/a.jpg`],
  ["outro bucket", `${SUPABASE}/storage/v1/object/public/outro-bucket/${LOJA}/${PRODUTO}/a.jpg`],
  ["endpoint privado do storage", `${SUPABASE}/storage/v1/object/sign/produtos-imagens/${LOJA}/${PRODUTO}/a.jpg`],
  ["rest do Supabase", `${SUPABASE}/rest/v1/produtos?select=*`],
  ["caminho sem loja (uuid)", `${SUPABASE}/storage/v1/object/public/produtos-imagens/loja/${PRODUTO}/a.jpg`],
  ["caminho sem produto", `${SUPABASE}/storage/v1/object/public/produtos-imagens/${LOJA}/a.jpg`],
  ["caminho sem arquivo", `${SUPABASE}/storage/v1/object/public/produtos-imagens/${LOJA}/${PRODUTO}`],
  ["credencial na URL", `https://u:p@abcdefgh.supabase.co/storage/v1/object/public/produtos-imagens/${LOJA}/${PRODUTO}/a.jpg`],
  ["file:", "file:///etc/passwd"],
  ["não é URL", "produtos-imagens/a.jpg"],
] as const) {
  test(`recusa: ${nome}`, () => {
    const o = origemDaFoto(url, SUPABASE);
    assert.equal(o.ok, false, url);
    if (!o.ok) assert.ok(o.motivo.length > 0);
  });
}

test("'..' no caminho é recusado mesmo dentro do bucket", () => {
  const o = origemDaFoto(
    `${SUPABASE}/storage/v1/object/public/produtos-imagens/${LOJA}/${PRODUTO}/..%2F..%2Fx.jpg`,
    SUPABASE
  );
  assert.equal(o.ok, false);
});

test("sem URL do Supabase no servidor, nada é aceito", () => {
  assert.equal(origemDaFoto(BOA, undefined).ok, false);
  assert.equal(origemDaFoto(undefined, SUPABASE).ok, false);
});

// ---- a rota — estrutura ----

test("/api/imagens/gerar: origem validada, loja autorizada, fetch cercado, cota antes do provedor", () => {
  const f = readFileSync(new URL("../../app/api/imagens/gerar/route.ts", import.meta.url), "utf8")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(f, /fetch\(corpo\.imagemUrl/, "a rota ainda baixa a URL crua do corpo");
  const origem = f.indexOf("origemDaFoto(corpo.imagemUrl");
  const autoriza = f.indexOf("exigirAcessoAoCliente(request, origem.clienteId)");
  const baixa = f.indexOf("fetch(origem.url");
  const cota = f.indexOf('cobrarCota(ctx, "imagem"');
  const gera = f.indexOf("gerarImagem(");
  assert.ok(origem > 0 && autoriza > origem, "a loja dona da foto precisa ser autorizada");
  assert.ok(baixa > autoriza, "baixa antes de autorizar");
  assert.ok(cota > 0 && cota < gera, "a cota é cobrada depois do provedor — o dinheiro já foi");
  assert.match(f, /redirect: "manual"/);
  assert.match(f, /AbortSignal\.timeout\(TIMEOUT_DA_FOTO_MS\)/);
  assert.match(f, /byteLength > MAXIMO_DA_FOTO_BYTES/);
  assert.match(f, /if \(!cota\.ok\) return respostaCotaRecusada\(cota\)/);
});
