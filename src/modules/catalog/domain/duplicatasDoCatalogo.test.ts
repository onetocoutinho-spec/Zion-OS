// A varredura que faltava ao assistente.
//
// Em 19/08/2026 a lojista pediu ao chat que analisasse SKUs repetidos e
// derivações faltando. O assistente respondeu que não tinha ferramenta para
// isso — e estava certo em não inventar. A mesma pergunta, em SQL, achou 143
// EANs repetidos em 296 linhas. Faltava ferramenta, não informação.
//
// Estes testes guardam o que a ferramenta pode afirmar e o que ela não pode.

import test from "node:test";
import assert from "node:assert/strict";
import {
  varrerCatalogo,
  fraseDaVarredura,
  type ProdutoVarrido,
} from "./duplicatasDoCatalogo.ts";

const v = (
  id: string,
  sku: string,
  ean: string,
  cor: string,
  tamanho: string
) => ({ id, sku, ean, cor, tamanho });

function prod(id: string, nome: string, variantes: ProdutoVarrido["variantes"]): ProdutoVarrido {
  return { id, nome, variantes };
}

// O caso medido: o EAN 7900123064381 apareceu no Chinelo Modare Esporão E no
// Tamanco Modare 7142.106, com CÓDIGOS DIFERENTES. É o mesmo par de sapato
// segundo o fabricante — então um dos dois SKUs está errado, e o errado vai
// para o estoque dela.
test("mesmo EAN com SKUs diferentes é a repetição mais grave, e vem primeiro", () => {
  const r = varrerCatalogo([
    prod("p1", "Chinelo Modare Esporão", [v("a", "00820433", "789", "Preto", "33 BR")]),
    prod("p2", "Tamanco Modare Tresse", [v("b", "00985638", "789", "Preto/Camel", "33 BR")]),
    // Uma repetição banal, para provar a ORDEM: esta tem o mesmo SKU.
    prod("p3", "Outro", [
      v("c", "111", "555", "Azul", "35"),
      v("d", "111", "555", "Azul", "36"),
    ]),
  ]);
  assert.equal(r.eansRepetidos[0].valor, "789");
  assert.equal(r.eansRepetidos[0].skusDivergentes, true);
  assert.equal(r.eansRepetidos[0].entreProdutos, true);
});

// O rótulo do tamanho mudou entre importações: `39.0 BR` e `39,0 BR` são o
// mesmo pé. Colapsar isso é o que revela a linha duplicada.
test("cor+tamanho repetido no mesmo produto: 39.0 BR e 39,0 BR são o mesmo pé", () => {
  const r = varrerCatalogo([
    prod("p1", "Zaxy", [
      v("a", "01062939", "", "Branco", "39.0 BR"),
      v("b", "", "", "Branco", "39,0 BR"),
    ]),
  ]);
  assert.equal(r.corTamanhoRepetido.length, 1);
  assert.equal(r.corTamanhoRepetido[0].ondes.length, 2);
});

// E a faixa NÃO colapsa com a unidade. `39 - 40` é o par de chinelo; `39` é um
// pé. Juntar os dois esconderia uma diferença real de produto.
test("faixa não colapsa com unidade — 39 - 40 não é 39", () => {
  const r = varrerCatalogo([
    prod("p1", "Zaxy", [
      v("a", "01062939", "", "Branco", "39 - 40"),
      v("b", "", "", "Branco", "39 BR"),
    ]),
  ]);
  assert.deepEqual(r.corTamanhoRepetido, []);
});

// O mesmo produto com dois tamanhos DIFERENTES não é repetição. Um teste que
// só acha problema não prova nada.
test("catálogo limpo não inventa repetição", () => {
  const r = varrerCatalogo([
    prod("p1", "Zaxy", [
      v("a", "1", "111", "Branco", "35"),
      v("b", "2", "222", "Branco", "36"),
    ]),
  ]);
  assert.deepEqual(r.eansRepetidos, []);
  assert.deepEqual(r.skusRepetidos, []);
  assert.deepEqual(r.corTamanhoRepetido, []);
  assert.equal(r.totalSemSku, 0);
  assert.match(fraseDaVarredura(r), /Nada repetido e nada faltando/);
});

// A frase precisa dizer sobre QUANTOS a varredura vale. "Nada repetido" sem o
// denominador é a mesma afirmação de completude que a importação fazia quando
// parava nos 500 e ninguém sabia.
test("a frase declara o que foi varrido, não só o que achou", () => {
  const r = varrerCatalogo([
    prod("p1", "X", [v("a", "1", "111", "Preto", "35"), v("b", "2", "222", "Preto", "36")]),
  ]);
  assert.match(fraseDaVarredura(r), /Varri 2 variações em 1 produtos/);
});

// Variação sem SKU tem de aparecer COM O NOME, não só como número. "23 sem
// SKU" é honesto e inútil: a pergunta seguinte é sempre quais.
test("o que falta vem com produto e exemplos de cor/tamanho", () => {
  const r = varrerCatalogo([
    prod("p1", "Zaxy Air", [
      v("a", "", "111", "Preto", "33 BR"),
      v("b", "", "222", "Preto", "39 BR"),
      v("c", "01062835", "333", "Preto", "35 BR"),
    ]),
  ]);
  assert.equal(r.totalSemSku, 2);
  assert.equal(r.faltando[0].produto, "Zaxy Air");
  assert.deepEqual(r.faltando[0].exemplos, ["Preto 33 BR", "Preto 39 BR"]);
  assert.equal(r.faltando[0].variantes, 3);
});

// Campo vazio NÃO é um valor que se repete. Sem isto, 25 variações sem SKU
// virariam "um SKU repetido 25 vezes" — e o relatório acusaria um problema que
// não existe enquanto esconde o que existe.
test("vazio não conta como repetição", () => {
  const r = varrerCatalogo([
    prod("p1", "X", [
      v("a", "", "", "Preto", "35"),
      v("b", "", "", "Preto", "36"),
      v("c", "", "", "Preto", "37"),
    ]),
  ]);
  assert.deepEqual(r.skusRepetidos, []);
  assert.deepEqual(r.eansRepetidos, []);
  assert.equal(r.totalSemSku, 3);
});

// `linhasAMais` é a resposta a "quanto sobra?", e ela é N-1 por código, não N:
// uma das linhas é a legítima.
test("linhasAMais conta o excedente, não o total", () => {
  const r = varrerCatalogo([
    prod("p1", "X", [
      v("a", "1", "999", "Preto", "35"),
      v("b", "2", "999", "Preto", "36"),
      v("c", "3", "999", "Preto", "37"),
    ]),
  ]);
  assert.equal(r.linhasAMais, 2);
});
