// Testes do Autor tipado (E5.8).
//
// Cobrem: interpretação determinística de TODAS as strings já gravadas nos
// fatos (e-mails, "", "suggestion-engine"), o prefixo canônico para sistemas
// futuros, roundtrip textoDe∘autorDe, rótulos de exibição preservados e a
// RETROCOMPATIBILIDADE da superfície de leitura (rotuloAutor mantém as
// saídas que as telas e testes existentes já esperavam).
// Rodar: npx tsx --test src/modules/adaptive-intelligence/domain/author.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AUTOR_NAO_REGISTRADO,
  autorDe,
  rotuloDe,
  textoDe,
  type Autor,
} from "./author.ts";
import { rotuloAutor } from "../application/pattern-browser.ts";

test("humano: e-mail da sessão (o formato gravado desde a E4.2.3)", () => {
  assert.deepEqual(autorDe("ana@zion.com"), { tipo: "humano", id: "ana@zion.com" });
  assert.deepEqual(autorDe("  ana@zion.com  "), { tipo: "humano", id: "ana@zion.com" });
});

test("não registrado: vazio/espaços/null — as Decisions pré-E4.2.3", () => {
  assert.deepEqual(autorDe(""), AUTOR_NAO_REGISTRADO);
  assert.deepEqual(autorDe("   "), AUTOR_NAO_REGISTRADO);
  assert.deepEqual(autorDe(null), AUTOR_NAO_REGISTRADO);
  assert.deepEqual(autorDe(undefined), AUTOR_NAO_REGISTRADO);
});

test("sistema: id conhecido dos fatos já gravados (ofertas.autor_da_oferta)", () => {
  assert.deepEqual(autorDe("suggestion-engine"), { tipo: "sistema", id: "suggestion-engine" });
});

test("sistema futuro: prefixo canônico 'sistema:' (E5.9 em diante)", () => {
  assert.deepEqual(autorDe("sistema:reprojection-runtime"), {
    tipo: "sistema",
    id: "reprojection-runtime",
  });
  assert.deepEqual(autorDe("sistema:"), AUTOR_NAO_REGISTRADO); // prefixo vazio não é autor
});

test("roundtrip: textoDe(autorDe(x)) devolve a forma canônica estável", () => {
  for (const texto of ["ana@zion.com", "suggestion-engine", "sistema:novo-componente", ""]) {
    const autor = autorDe(texto);
    assert.deepEqual(autorDe(textoDe(autor)), autor); // estável em 2ª passagem
  }
  // sistema conhecido roundtripa SEM prefixo (compatível com as ofertas gravadas):
  assert.equal(textoDe(autorDe("suggestion-engine")), "suggestion-engine");
  // sistema novo roundtripa COM prefixo:
  assert.equal(textoDe({ tipo: "sistema", id: "novo" } as Autor), "sistema:novo");
});

test("rótulos: os textos que as telas já usam, preservados", () => {
  assert.equal(rotuloDe(autorDe("ana@zion.com")), "ana@zion.com");
  assert.equal(rotuloDe(autorDe("")), "não registrado");
  assert.equal(rotuloDe(autorDe("suggestion-engine")), "sistema · suggestion-engine");
});

test("RETROCOMPATIBILIDADE: rotuloAutor (superfície de leitura) mantém as saídas", () => {
  // As mesmas assertivas dos testes pré-E5.8 — nada mudou para os fatos existentes:
  assert.equal(rotuloAutor("ana@zion.com"), "ana@zion.com");
  assert.equal(rotuloAutor(""), "não registrado");
  assert.equal(rotuloAutor("  "), "não registrado");
});
