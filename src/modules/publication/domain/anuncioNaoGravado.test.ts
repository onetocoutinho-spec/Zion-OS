// Testes do anúncio montado que não chegou ao banco.
//
// Medido em 29/07 no fluxo real: três gerações registraram
// `POST /api/agentes/esteira 200` — a montagem final respondeu — e NENHUMA
// linha entrou em `anuncios_gerados`. Três minutos e ~10 chamadas de IA por
// tentativa, descartados com a mensagem "Não foi possível gerar o anúncio
// agora". Que é falsa: foi gerado.
// Rodar: npx tsx --test src/modules/publication/domain/anuncioNaoGravado.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  chaveAnuncioPendente,
  lerAnuncioPendente,
  serveParaOProduto,
  type AnuncioPendenteDeGravacao,
} from "./anuncioNaoGravado.ts";

const PENDENTE: AnuncioPendenteDeGravacao = {
  produtoId: "5dec4170",
  produtoNome: "Chinelo Slide Nuvem Zaxy Air 19419",
  anuncio: { tituloOtimizado: "Chinelo Nuvem Zaxy", pendencias: [] },
  tipoExecucao: "IA",
  montadoEm: "2026-07-29T14:15:59.279Z",
};

test("a chave separa lojistas no mesmo navegador", () => {
  assert.notEqual(chaveAnuncioPendente("cli-01"), chaveAnuncioPendente("cli-02"));
  assert.match(chaveAnuncioPendente("cli-01"), /cli-01/);
});

test("o anúncio guardado volta inteiro", () => {
  const lido = lerAnuncioPendente(JSON.stringify(PENDENTE));
  assert.deepEqual(lido, PENDENTE);
});

test("lixo no storage devolve null, nunca um objeto pela metade", () => {
  // Anúncio meio gravado é pior que nenhum: a tela ofereceria recuperar algo
  // que não pode ser gravado, e a pessoa tentaria de novo sem entender.
  for (const bruto of [null, undefined, "", "{", "null", "[]", '"texto"', "123"]) {
    assert.equal(lerAnuncioPendente(bruto), null, `${String(bruto)} deveria virar null`);
  }
});

test("sem produtoId ou sem anúncio, não serve", () => {
  assert.equal(lerAnuncioPendente(JSON.stringify({ ...PENDENTE, produtoId: "" })), null);
  assert.equal(lerAnuncioPendente(JSON.stringify({ ...PENDENTE, anuncio: null })), null);
  assert.equal(lerAnuncioPendente(JSON.stringify({ ...PENDENTE, anuncio: "texto" })), null);
});

test("campos secundários ausentes não invalidam o resgate", () => {
  // O que importa é o anúncio e a quem ele pertence. Nome e data são conforto.
  const lido = lerAnuncioPendente(
    JSON.stringify({ produtoId: "abc", anuncio: { titulo: "x" } })
  );
  assert.ok(lido);
  assert.equal(lido.produtoId, "abc");
  assert.equal(lido.produtoNome, "");
  assert.equal(lido.tipoExecucao, "IA");
});

test("anúncio de OUTRO produto nunca é oferecido", () => {
  // Gravar o texto de um chinelo num tênis é pior que perder o texto. Mesma
  // regra do `?produto=` inexistente: na dúvida, não mostra.
  assert.equal(serveParaOProduto(PENDENTE, "5dec4170"), true);
  assert.equal(serveParaOProduto(PENDENTE, "outro-id"), false);
  assert.equal(serveParaOProduto(PENDENTE, null), false);
  assert.equal(serveParaOProduto(null, "5dec4170"), false);
});
