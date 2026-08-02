// O que o ML manda e o que o Zion olha — a lista de candidatos ao oitavo defeito.
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// Em 01–02/08/2026, SETE defeitos tiveram a MESMA forma: o ML informava e nós
// não líamos.
//
//   `paging.total`         quantos anúncios a conta tem   → descartado
//   `attributes`           a ficha inteira do lojista     → 2 de 17,8 guardados
//   `status`               o estado real do anúncio       → fixo em "publicado"
//   `sub_status`           POR QUE está fora do ar        → nem pedido
//   `tags.required`        o que a categoria exige        → nem pedido
//   `pictures[].max_size`  o tamanho real da foto         → descartado
//   `itens` da publicação  todos os MLBs da família       → só o primeiro
//
// Nenhum foi erro de lógica. Todos foram campo não lido — e a lista branca do
// multiget (`?attributes=`) garante que um campo não pedido nunca apareça nem
// para ser ignorado.

import test from "node:test";
import assert from "node:assert/strict";
import { inventariarItem, camposPedidos } from "./inventarioDoItemML.ts";

const LISTA = "id,title,price,status,pictures";

test("separa o que pedimos do que ignoramos", () => {
  const inv = inventariarItem(
    { id: "MLB1", title: "x", price: 10, status: "active", pictures: [], health: 0.8, tags: [] },
    LISTA
  );
  assert.deepEqual(inv.usados, ["id", "title", "price", "status", "pictures"]);
  assert.deepEqual(inv.ignorados, ["health", "tags"]);
});

test("campo PEDIDO e ausente é sinalizado — é sinal de descontinuação", () => {
  // Foi assim que o `price` começou a sumir em favor de /items/{id}/prices. Um
  // campo que some sem aviso vira preço zero no catálogo inteiro.
  const inv = inventariarItem({ id: "MLB1", title: "x", status: "active", pictures: [] }, LISTA);
  assert.deepEqual(inv.pedidosEAusentes, ["price"]);
});

test("desce UM nível dentro dos campos que já lemos — foi lá que `max_size` estava", () => {
  const inv = inventariarItem(
    { id: "MLB1", pictures: [{ url: "u", secure_url: "s", size: "500x500", max_size: "1200x1200" }] },
    LISTA
  );
  assert.deepEqual(inv.aninhados.pictures, ["max_size", "secure_url", "size", "url"]);
});

test("lista usa a PRIMEIRA entrada como amostra da forma", () => {
  const inv = inventariarItem({ id: "MLB1", variations: [{ price: 1, seller_custom_field: "s" }] }, LISTA);
  assert.deepEqual(inv.aninhados.variations, ["price", "seller_custom_field"]);
});

test("lista vazia não inventa forma", () => {
  const inv = inventariarItem({ id: "MLB1", pictures: [] }, LISTA);
  assert.equal(inv.aninhados.pictures, undefined);
});

test("valor escalar não vira aninhado", () => {
  const inv = inventariarItem({ id: "MLB1", price: 10, title: "x" }, LISTA);
  assert.equal(inv.aninhados.price, undefined);
  assert.equal(inv.aninhados.title, undefined);
});

test("item nulo não acusa nada de ignorado, e acusa TUDO de ausente", () => {
  // Uma falha de rede não pode virar "o ML parou de mandar tudo".
  const inv = inventariarItem(null, LISTA);
  assert.deepEqual(inv.ignorados, []);
  assert.deepEqual(inv.usados, []);
  assert.equal(inv.pedidosEAusentes.length, 5);
});

test("a saída é ordenada — dois diagnósticos do mesmo item são comparáveis", () => {
  const a = inventariarItem({ zzz: 1, aaa: 2, id: "x" }, LISTA);
  const b = inventariarItem({ id: "x", aaa: 2, zzz: 1 }, LISTA);
  assert.deepEqual(a.ignorados, b.ignorados);
  assert.deepEqual(a.ignorados, ["aaa", "zzz"]);
});

test("a lista branca é lida com espaços e vazios tolerados", () => {
  assert.deepEqual(camposPedidos(" id , title ,, price "), ["id", "title", "price"]);
  assert.deepEqual(camposPedidos(""), []);
});

test("pedir um campo NÃO prova que ele é lido", () => {
  // `pictures` e `attributes` estavam na lista e foram lidos pela metade — o
  // inventário mostra o que CHEGA, não o que o código aproveita. Este teste
  // existe para o próximo leitor não confundir as duas coisas.
  const inv = inventariarItem(
    { id: "MLB1", pictures: [{ url: "u", max_size: "1200x1200" }] },
    LISTA
  );
  assert.ok(inv.usados.includes("pictures"), "pictures foi pedido e veio");
  assert.ok(
    inv.aninhados.pictures.includes("max_size"),
    "e `max_size` está dentro dele — pedido não é o mesmo que lido"
  );
});
