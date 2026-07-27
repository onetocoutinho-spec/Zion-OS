// Testes da decodificação de arquivo.
//
// O caso real que motivou tudo: 470 produtos entraram com "T?nis" no lugar de
// "Tênis" porque `file.text()` decodifica sempre como UTF-8 e a planilha vinha
// do Excel em Windows-1252. O nome corrompido ia direto para o título do
// anúncio no marketplace.
// Rodar: npx tsx --test src/lib/textoDeArquivo.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  decodificarTexto,
  pareceCorrompido,
  contarCorrompidos,
} from "./textoDeArquivo.ts";

/** "Tênis Actvitta" em Windows-1252: o ê é o byte 0xEA, sozinho. */
const TENIS_1252 = new Uint8Array([
  0x54, 0xea, 0x6e, 0x69, 0x73, 0x20, 0x41, 0x63, 0x74, 0x76, 0x69, 0x74, 0x74, 0x61,
]);

/** O mesmo texto em UTF-8: o ê ocupa dois bytes (0xC3 0xAA). */
const TENIS_UTF8 = new TextEncoder().encode("Tênis Actvitta");

test("Windows-1252 é reconhecido e o acento sobrevive", () => {
  // É este o caso que quebrou na produção — Excel brasileiro exporta assim.
  const r = decodificarTexto(TENIS_1252);
  assert.equal(r.encoding, "windows-1252");
  assert.equal(r.texto, "Tênis Actvitta");
  assert.equal(r.temCorrupcao, false);
});

test("UTF-8 continua sendo lido como UTF-8", () => {
  const r = decodificarTexto(TENIS_UTF8);
  assert.equal(r.encoding, "utf-8");
  assert.equal(r.texto, "Tênis Actvitta");
});

test("BOM de UTF-8 decide sem heurística", () => {
  const comBom = new Uint8Array([0xef, 0xbb, 0xbf, ...TENIS_UTF8]);
  const r = decodificarTexto(comBom);
  assert.equal(r.encoding, "utf-8");
  assert.match(r.texto, /Tênis Actvitta$/);
});

test("o erro que acontecia antes: forçar UTF-8 em bytes 1252 corrompe", () => {
  // Reproduz o comportamento de file.text() para provar que o problema era real.
  const errado = new TextDecoder("utf-8").decode(TENIS_1252);
  assert.ok(pareceCorrompido(errado), `esperado corrompido, veio "${errado}"`);
  assert.notEqual(errado, "Tênis Actvitta");
});

test("texto sem acento nenhum é UTF-8 válido e passa direto", () => {
  const r = decodificarTexto(new TextEncoder().encode("Chinelo Slide 4942"));
  assert.equal(r.encoding, "utf-8");
  assert.equal(r.texto, "Chinelo Slide 4942");
});

test("arquivo vazio não explode", () => {
  const r = decodificarTexto(new Uint8Array([]));
  assert.equal(r.texto, "");
  assert.equal(r.temCorrupcao, false);
});

test("CSV inteiro em 1252 preserva acento em todas as linhas", () => {
  const linhas = "nome;preco\nTênis Corrida;199,90\nSandália Salto;89,90";
  const bytes = new Uint8Array(
    [...linhas].map((c) => {
      const cp = c.codePointAt(0)!;
      return cp < 256 ? cp : 0x3f; // 1252 cobre latim-1 direto
    })
  );
  const r = decodificarTexto(bytes);
  assert.equal(r.encoding, "windows-1252");
  assert.match(r.texto, /Tênis Corrida/);
  assert.match(r.texto, /Sandália Salto/);
});

// ── Detecção do que JÁ está gravado ──────────────────────────────────────────

test("detecta corrupção em texto já salvo — não dá para reparar adivinhando", () => {
  // O byte original se perdeu na decodificação; o que resta é avisar.
  assert.equal(pareceCorrompido("T�nis Actvitta"), true);
  assert.equal(pareceCorrompido("Tênis Actvitta"), false);
});

test("conta quantos itens estão corrompidos, ignorando ausentes", () => {
  const nomes = ["T�nis", "Chinelo", null, "Sand�lia", undefined];
  assert.equal(contarCorrompidos(nomes), 2);
});
