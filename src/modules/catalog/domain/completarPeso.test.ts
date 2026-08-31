import test from "node:test";
import assert from "node:assert/strict";

import { pesosACompletar, fraseDoCompletar, porValor } from "./completarPeso";
import { pesoConhecidoDoProduto } from "./pendenciasDoCatalogo";
import type { ProdutoComPesoConhecido } from "./completarPeso";

// Os números REAIS medidos em 17/08/2026: 444 variações sem peso, sendo 200 em
// 24 produtos onde as irmãs já concordam num valor, e 244 em 23 onde ninguém
// tem. O Mercado Livre não salva — 8 anúncios consultados ao vivo, nenhum com
// `shipping.dimensions` nem `PACKAGE_WEIGHT`.

/**
 * Monta o produto passando pela REGRA DE VERDADE.
 *
 * `pesoUnicoGramas` sai de `pesoConhecidoDoProduto`, exatamente como o serviço
 * faz — se a fixture calculasse esse campo por conta própria, os testes
 * passariam com uma definição de "qual peso vale" que o app não usa.
 */
const p = (id: string, nome: string, pesos: number[]): ProdutoComPesoConhecido => ({
  id,
  nome,
  pesoUnicoGramas: pesoConhecidoDoProduto({
    id,
    nome,
    variantes: pesos.map((g) => ({ pesoGramas: g })),
  } as unknown as Parameters<typeof pesoConhecidoDoProduto>[0]),
  variacoesSemPeso: pesos.filter((g) => !(g > 0)).length,
  quantidadeVariantes: pesos.length,
});

test("completa onde as irmãs concordam, e diz quantas recebem", () => {
  // O caso real de maior alcance: "Chinelo Havaianas Top Liso", 40 variações,
  // 3 pesadas com 390 g e 37 sem.
  const lista = pesosACompletar([
    p("top-liso", "Chinelo Havaianas Top Liso", [390, 390, 390, ...Array(37).fill(0)]),
  ]);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].gramas, 390);
  assert.equal(lista[0].faltando, 37);
  assert.equal(lista[0].jaTem, 3);
});

test("NÃO completa quando as irmãs discordam — não há resposta a copiar", () => {
  // Duas caixas diferentes no mesmo produto. Escolher uma sobrescreveria a
  // outra sem ninguém ter aprovado, e peso errado é frete cobrado a menos.
  const lista = pesosACompletar([p("x", "Discordantes", [300, 450, 0, 0])]);
  assert.deepEqual(lista, []);
});

test("NÃO inventa peso para quem não tem nenhum", () => {
  // Os 23 produtos da outra metade. Aqui falta o dado, e ele só existe numa
  // balança — nem na base, nem no Mercado Livre.
  const lista = pesosACompletar([p("y", "Sem peso nenhum", [0, 0, 0])]);
  assert.deepEqual(lista, []);
});

test("produto já completo fica de fora", () => {
  assert.deepEqual(pesosACompletar([p("z", "Completo", [500, 500])]), []);
});

test("NUNCA atravessa produtos — 2874.202 não empresta peso ao 2874.204", () => {
  // A tentação óbvia: são da mesma linha, o nome quase igual. Não é a mesma
  // caixa. Este teste é a fronteira do módulo inteiro.
  const lista = pesosACompletar([
    p("a", "Babuche Molekinho Gaspea Eva 2874.202 Infantil", [350, 350, 0]),
    p("b", "Babuche Molekinho Gas Injetado 2874.204 Infantil", [0, 0, 0]),
  ]);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].produtoId, "a");
});

test("o que mais rende aparece primeiro", () => {
  const lista = pesosACompletar([
    p("pouco", "Um só", [400, 0]),
    p("muito", "Trinta e sete", [390, ...Array(37).fill(0)]),
  ]);
  assert.deepEqual(lista.map((x) => x.produtoId), ["muito", "pouco"]);
});

test("a frase carrega os dois números e não promete estimativa", () => {
  const lista = pesosACompletar([
    p("a", "A", [390, 0, 0]),
    p("b", "B", [400, 0]),
  ]);
  const f = fraseDoCompletar(lista);
  assert.match(f, /3 variação\(ões\)/);
  assert.match(f, /2 produto\(s\)/);
  assert.match(f, /Nada aqui é estimado/);
  assert.equal(fraseDoCompletar([]), "", "prometeu algo com a lista vazia");
});

test("agrupa por VALOR: pesos iguais viram uma gravação só", () => {
  // 24 produtos com 7 valores distintos são 7 gravações, não 24. Cada gravação
  // a menos é uma rajada a menos de eventos do Realtime — foi ela que derrubou
  // esta conta hoje.
  const lista = pesosACompletar([
    p("a", "A", [500, 0]),
    p("b", "B", [500, 0]),
    p("c", "C", [390, 0]),
  ]);
  const grupos = porValor(lista);
  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].gramas, 500);
  assert.deepEqual(grupos[0].produtoIds.sort(), ["a", "b"]);
  assert.deepEqual(grupos[1], { gramas: 390, produtoIds: ["c"] });
});

// ---------------------------------------------------------------------------
// A FIAÇÃO
// ---------------------------------------------------------------------------

test("a tela não digita o que já sabe, e não apaga o que não sabe", async () => {
  const { readFileSync } = await import("node:fs");
  const tela = readFileSync(new URL("../../../app/cliente/peso/page.tsx", import.meta.url), "utf8");

  assert.match(tela, /pesosACompletar\(produtos \?\? \[\]\)/, "a tela parou de medir o que dá para completar");
  assert.match(tela, /fraseDoCompletar\(aCompletar\)/, "a tela passou a redigir os números; eles vêm do domínio");

  // AS DIMENSÕES NÃO PODEM SER ZERADAS. Só o peso é conhecido aqui; altura,
  // largura e comprimento continuam sendo dela. `definirPesoDosProdutos` já
  // trata 0 como "não informado" — esta prova garante que o chamador conta com
  // isso de propósito, e não por acidente.
  // Corta no `finally`, e não no primeiro `setMsg(` — esse aparece logo na
  // segunda linha da função e a fatia saía antes da gravação.
  const corpo = tela.slice(tela.indexOf("async function completarConhecidos"));
  const chamada = corpo.slice(0, corpo.indexOf("} finally {"));
  assert.ok(chamada.length > 200, "não achei o corpo da função de completar");
  assert.match(chamada, /alturaCm: 0/);
  assert.match(chamada, /larguraCm: 0/);
  assert.match(chamada, /comprimentoCm: 0/);

  // SEQUENCIAL e agrupado por valor: foi a rajada de escritas que derrubou esta
  // conta em 17/08/2026.
  assert.match(chamada, /for \(const grupo of porValor\(aCompletar\)\)/);
  assert.ok(!/Promise\.all/.test(chamada), "a gravação virou paralela — é o que derrubou a conta");
});

test("o serviço lê o peso único pela regra do domínio, não por uma cópia", async () => {
  const { readFileSync } = await import("node:fs");
  const servico = readFileSync(
    new URL("../../../lib/services/pesoDeProduto.ts", import.meta.url),
    "utf8"
  );
  assert.match(
    servico,
    /pesoUnicoGramas: pesoConhecidoDoProduto\(/,
    "o serviço passou a decidir sozinho qual peso vale — a regra é uma só, e é do domínio"
  );
  // E `pesoGramas` continua sendo o MAIOR: são coisas diferentes, e confundi-las
  // daria 450 g às que faltam num produto onde metade pesa 300.
  assert.match(servico, /pesoGramas: paraGramas\(maior\("peso"\)\)/);
});
