import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAMPOS_PEDIDOS_AO_ML } from "./mercadolivre.ts";

// TODO CAMPO QUE O MAPEADOR LÊ TEM QUE SER PEDIDO AO MERCADO LIVRE.
//
// ===========================================================================
// O DEFEITO QUE ISTO PEGA — medido em 14/08/2026
// ===========================================================================
//
// O mapeador lia `it.shipping?.free_shipping` para saber quem paga o frete.
// `shipping` NUNCA esteve em `CAMPOS_PEDIDOS_AO_ML`: o `attributes=` da API
// filtra a resposta, então o campo chegava sempre `undefined`.
//
// O que a lojista via: 80 de 80 produtos sem quem paga o frete, e o botão
// respondendo **"Nenhum anúncio informou o frete"** — culpando o Mercado Livre
// por uma pergunta que nunca foi feita. Sem frete não há preço mínimo, e sem
// preço mínimo a precificação inteira fica parada.
//
// É a família de defeito mais cara deste repositório: o dado EXISTE na fonte,
// o leitor não o alcança, e o software afirma a ausência com confiança.
//
// ===========================================================================
// POR QUE UMA SENTINELA E NÃO SÓ O CONSERTO
// ===========================================================================
//
// Porque a lista tem 30 campos e o mapeador lê de `it` em vinte lugares. A
// próxima vez que alguém ler um campo novo sem acrescentá-lo à lista, o
// sintoma será outro dado nulo em massa, meses depois, com a mesma mensagem
// culpando a fonte. Aqui o desacordo aparece no gate.

const FONTE = readFileSync(new URL("./mercadolivre.ts", import.meta.url), "utf8");

/** O corpo do mapeador — de onde `it` é lido. */
const MAPEADOR = (() => {
  const i = FONTE.indexOf("const atributos: AtributoML[] = (it.attributes ?? [])");
  assert.ok(i > 0, "o mapeador de item mudou de forma");
  // Vai até o fim do `return { ... }` que monta o AnuncioML.
  const fim = FONTE.indexOf("\n}", FONTE.indexOf("return {", i));
  return FONTE.slice(i, fim);
})();

/**
 * Campos que o ML entrega SEM precisar ser pedidos, ou que não vêm do item.
 *
 * `id` vem sempre. O resto desta lista tem que ficar VAZIO — cada entrada nova
 * aqui é uma exceção que precisa de motivo escrito.
 */
const NAO_PRECISAM_SER_PEDIDOS = new Set<string>(["id"]);

test("todo campo lido de `it` está na lista pedida ao Mercado Livre", () => {
  const pedidos = new Set(CAMPOS_PEDIDOS_AO_ML.split(","));
  // `it.shipping?.free_shipping` e `it.attributes ?? []` — só a PRIMEIRA parte
  // importa: é ela que o `attributes=` da API filtra.
  const lidos = new Set(
    [...MAPEADOR.matchAll(/\bit\??\.([a-z_][a-z0-9_]*)/gi)].map((m) => m[1])
  );

  const naoPedidos = [...lidos]
    .filter((c) => !pedidos.has(c) && !NAO_PRECISAM_SER_PEDIDOS.has(c))
    .sort();

  assert.deepEqual(
    naoPedidos,
    [],
    "o mapeador lê campo que o Mercado Livre nunca é perguntado — ele chegará " +
      "`undefined` SEMPRE, e o software vai afirmar que a fonte não informou"
  );
});

test("`shipping` está na lista — é o frete, e ele trava a precificação", () => {
  // A prova nominal do caso que originou a sentinela. A regra geral acima
  // cobre o futuro; esta linha impede que o conserto de hoje seja desfeito por
  // alguém enxugando a lista.
  assert.ok(
    CAMPOS_PEDIDOS_AO_ML.split(",").includes("shipping"),
    "sem `shipping` o frete volta a chegar nulo em todos os produtos"
  );
});

test("o mapeador realmente lê o frete de `shipping`", () => {
  // Os dois lados da regra. Se o mapeador parar de ler, pedir o campo vira
  // peso morto — e a sentinela acima ficaria verde sobre um dado que não chega
  // a lugar nenhum.
  assert.match(
    MAPEADOR,
    /it\.shipping\?\.free_shipping/,
    "o mapeador parou de ler quem paga o frete"
  );
});
