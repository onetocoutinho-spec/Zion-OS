// Testes do aviso de foto já enviada.
//
// O que se prova: o aviso só aparece quando a MESMA cor do MESMO produto já tem
// foto, diz quantas seriam acrescentadas, e nunca bloqueia nem apaga.
//
// O caso real: em 27/08/2026 a mesma pasta de cor foi enviada duas vezes e o
// produto ficou com 108 imagens onde havia 54.
//
// Rodar: npx tsx --test src/modules/catalog/domain/envioDeFotoRepetido.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  chaveDaFoto,
  conferirEnvioRepetido,
  type GrupoParaEnviar,
} from "./envioDeFotoRepetido.ts";

const grupo = (p: Partial<GrupoParaEnviar> = {}): GrupoParaEnviar => ({
  produtoId: "p1",
  rotulo: "Papete Slide Modare 7208.101",
  cor: "100983 verde luna nobu",
  fotos: 54,
  ...p,
});

test("produto sem foto nenhuma não vira aviso", () => {
  const r = conferirEnvioRepetido([grupo()], new Map());
  assert.equal(r.repetido, false);
  assert.equal(r.texto, "");
});

test("a MESMA cor já com foto é o caso da duplicata", () => {
  // Foi exatamente isto: 54 fotos da mesma cor, enviadas duas vezes.
  const jaTem = new Map([[chaveDaFoto("p1", "100983 verde luna nobu"), 54]]);
  const r = conferirEnvioRepetido([grupo()], jaTem);
  assert.equal(r.repetido, true);
  assert.equal(r.gruposRepetidos, 1);
  assert.equal(r.fotosDuplicadas, 54);
  assert.match(r.texto, /54 foto\(s\) repetida/);
});

test("cor DIFERENTE no mesmo produto é adição legítima, não aviso", () => {
  // Mandar a cor rosa para um produto que já tem a preta é o caso normal.
  const jaTem = new Map([[chaveDaFoto("p1", "preto")]].map(([k]) => [k as string, 9] as const));
  const r = conferirEnvioRepetido([grupo({ cor: "rosa" })], jaTem);
  assert.equal(r.repetido, false);
});

test("a comparação de cor ignora caixa e espaço", () => {
  const jaTem = new Map([[chaveDaFoto("p1", "PRETO"), 3]]);
  assert.equal(conferirEnvioRepetido([grupo({ cor: " preto " })], jaTem).repetido, true);
});

test("cor vazia também é uma cor — a ausência dela", () => {
  const jaTem = new Map([[chaveDaFoto("p1", ""), 5]]);
  assert.equal(conferirEnvioRepetido([grupo({ cor: "" })], jaTem).repetido, true);
});

test("grupo que NÃO casou não entra na conta", () => {
  // Ele não seria enviado de qualquer forma; contá-lo inflaria o número que a
  // pessoa usa para decidir.
  const jaTem = new Map([[chaveDaFoto("p1", "preto"), 3]]);
  const r = conferirEnvioRepetido([grupo({ produtoId: null, cor: "preto" })], jaTem);
  assert.equal(r.repetido, false);
});

test("o aviso soma as fotos de TODOS os grupos repetidos", () => {
  const jaTem = new Map([
    [chaveDaFoto("p1", "preto"), 4],
    [chaveDaFoto("p2", "rosa"), 2],
  ]);
  const r = conferirEnvioRepetido(
    [
      grupo({ produtoId: "p1", cor: "preto", fotos: 10 }),
      grupo({ produtoId: "p2", cor: "rosa", fotos: 7, rotulo: "Outro" }),
      grupo({ produtoId: "p3", cor: "azul", fotos: 99, rotulo: "Novo" }),
    ],
    jaTem
  );
  assert.equal(r.gruposRepetidos, 2);
  assert.equal(r.fotosDuplicadas, 17);
  assert.equal(r.exemplos.includes("Novo"), false);
});

test("o aviso diz que ACRESCENTA, e não que substitui", () => {
  // A frase precisa dizer o que o sistema faz. `uploadImagemProduto` sobe e cria
  // linha, sempre — não há substituição em lugar nenhum.
  const jaTem = new Map([[chaveDaFoto("p1", "100983 verde luna nobu"), 54]]);
  const r = conferirEnvioRepetido([grupo()], jaTem);
  assert.match(r.texto, /ACRESCENTA/);
  assert.match(r.texto, /não substitui/);
  assert.match(r.texto, /apague as antigas/);
});

test("muitos repetidos citam poucos e avisam que há mais", () => {
  const jaTem = new Map<string, number>();
  const grupos = Array.from({ length: 9 }, (_, i) => {
    jaTem.set(chaveDaFoto(`p${i}`, "c"), 1);
    return grupo({ produtoId: `p${i}`, cor: "c", rotulo: `Produto ${i}`, fotos: 1 });
  });
  const r = conferirEnvioRepetido(grupos, jaTem);
  assert.equal(r.exemplos.length, 3);
  assert.match(r.texto, /entre outros/);
});
