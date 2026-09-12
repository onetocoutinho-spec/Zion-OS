// O chat pode gravar SKU e EAN — e não pode virar fábrica de duplicata.
//
// A lojista pediu que `propor_gravacao` aceitasse SKU e EAN. O caminho do peso
// não serve: peso é do PRODUTO (uma Havaiana pesa 420 g nas 39 variações) e o
// SKU IDENTIFICA UMA UNIDADE. Gravar um SKU por produto seria fabricar o
// defeito que a varredura de 19/08/2026 aponta como o pior — 128 SKUs em mais
// de uma variação e 9 EANs com SKUs divergentes.
//
// Estes testes são as quatro travas.

import test from "node:test";
import assert from "node:assert/strict";
import {
  montarPropostaDeCodigo,
  variacoesQueCasam,
  type ProdutoComVariantes,
} from "./propostaDeCodigo.ts";

const v = (id: string, sku: string, ean: string, cor: string, tamanho: string) => ({
  id,
  sku,
  ean,
  cor,
  tamanho,
});

const zaxy: ProdutoComVariantes = {
  id: "p1",
  nome: "Zaxy Air 19419",
  variantes: [
    v("v1", "", "", "Preto", "33 - 34"),
    v("v2", "01062835", "7900377095597", "Preto", "35 BR"),
    v("v3", "", "", "Branco", "35 BR"),
  ],
};

const outro: ProdutoComVariantes = {
  id: "p2",
  nome: "Papete Mood",
  variantes: [v("v9", "01060239", "7900377004201", "Branco", "39 - 40")],
};

const catalogo = [zaxy, outro];

test("grava o SKU em UMA variação, e o resumo diz qual", () => {
  const p = montarPropostaDeCodigo({
    produto: zaxy,
    campo: "sku",
    valor: "01062833",
    cor: "Preto",
    tamanho: "33 - 34",
    catalogo,
  });
  assert.equal(p.tipo, "pronta");
  if (p.tipo !== "pronta") return;
  assert.equal(p.variante.id, "v1");
  assert.match(p.resumo, /só nessa variação/);
});

// TRAVA 1. Sem cor, "35 BR" cai em Preto e Branco. Escolher uma seria sortear
// em cima de identidade — e identidade errada vai para o estoque dela.
test("duas variações batendo NÃO viram gravação: viram pergunta", () => {
  const p = montarPropostaDeCodigo({
    produto: zaxy,
    campo: "sku",
    valor: "99999999",
    cor: "",
    tamanho: "35 BR",
    catalogo,
  });
  assert.equal(p.tipo, "ambigua");
  if (p.tipo !== "ambigua") return;
  assert.equal(p.candidatos.length, 2);
  assert.match(p.mensagem, /identifica UMA unidade/);
});

// TRAVA 2. O código já vive em outra variação. Gravar aqui também é criar a
// duplicata que a varredura acusa — e a recusa tem de DIZER onde ele está,
// senão a lojista fica sem saber o que fazer.
test("código já usado em outra variação é recusado, dizendo onde está", () => {
  const p = montarPropostaDeCodigo({
    produto: zaxy,
    campo: "sku",
    valor: "01060239",
    cor: "Preto",
    tamanho: "33 - 34",
    catalogo,
  });
  assert.equal(p.tipo, "recusada");
  if (p.tipo !== "recusada") return;
  assert.match(p.mensagem, /Papete Mood/);
  assert.match(p.mensagem, /Branco 39 - 40/);
});

// TRAVA 3. Trocar código existente é legítimo — 127 entraram assim do ERP em
// 15/08. Mas quem confirma precisa ler o que SAI, não só o que entra.
test("sobrescrita mostra o valor anterior no resumo", () => {
  const p = montarPropostaDeCodigo({
    produto: zaxy,
    campo: "sku",
    valor: "01062836",
    cor: "Preto",
    tamanho: "35 BR",
    catalogo,
  });
  assert.equal(p.tipo, "pronta");
  if (p.tipo !== "pronta") return;
  assert.equal(p.anterior, "01062835");
  assert.match(p.resumo, /de 01062835 para 01062836/);
});

// TRAVA 4. Um EAN inventado é PIOR que EAN nenhum: ele é a chave que
// `importacaoPeso` usa para casar linha com variante, então o errado gruda no
// produto errado na importação seguinte.
test("EAN com formato impossível é recusado, e a recusa explica o risco", () => {
  const p = montarPropostaDeCodigo({
    produto: zaxy,
    campo: "ean",
    valor: "12345",
    cor: "Preto",
    tamanho: "33 - 34",
    catalogo,
  });
  assert.equal(p.tipo, "recusada");
  if (p.tipo !== "recusada") return;
  assert.match(p.mensagem, /8, 12, 13 ou 14 dígitos/);
  assert.match(p.mensagem, /chave que a importação usa/);
});

test("EAN de 13 dígitos passa", () => {
  const p = montarPropostaDeCodigo({
    produto: zaxy,
    campo: "ean",
    valor: "7900377095582",
    cor: "Preto",
    tamanho: "33 - 34",
    catalogo,
  });
  assert.equal(p.tipo, "pronta");
});

// O rótulo do tamanho muda entre importações: `35 BR` e `35,0 BR` são o mesmo
// pé. Exigir a grafia exata faria a lojista errar por causa de uma vírgula.
test("casa 35,0 BR com 35 BR — o rótulo mudou, o pé não", () => {
  const achados = variacoesQueCasam(zaxy, "Preto", "35,0 BR");
  assert.equal(achados.length, 1);
  assert.equal(achados[0].id, "v2");
});

// Mas a FAIXA não colapsa com a unidade: `33 - 34` é o par, `33` é um pé. Um
// SKU no lugar errado aqui troca par por unidade no estoque.
test("faixa não casa com unidade — 33 não alcança 33 - 34 por engano", () => {
  const so33: ProdutoComVariantes = {
    id: "p3",
    nome: "X",
    variantes: [v("a", "", "", "Preto", "33 - 34"), v("b", "", "", "Preto", "33 BR")],
  };
  const achados = variacoesQueCasam(so33, "Preto", "33 BR");
  assert.equal(achados.length, 1);
  assert.equal(achados[0].id, "b");
});

// Gravar o mesmo valor que já está lá não é gravação — é ruído. Dizer isso
// evita uma Proposal, um clique e uma escrita que não mudam nada.
test("valor idêntico ao atual é recusado sem drama", () => {
  const p = montarPropostaDeCodigo({
    produto: zaxy,
    campo: "sku",
    valor: "01062835",
    cor: "Preto",
    tamanho: "35 BR",
    catalogo,
  });
  assert.equal(p.tipo, "recusada");
  if (p.tipo !== "recusada") return;
  assert.match(p.mensagem, /já está com esse SKU/);
});

test("código com espaço no meio é recusado", () => {
  const p = montarPropostaDeCodigo({
    produto: zaxy,
    campo: "sku",
    valor: "0106 2833",
    cor: "Preto",
    tamanho: "33 - 34",
    catalogo,
  });
  assert.equal(p.tipo, "recusada");
});
