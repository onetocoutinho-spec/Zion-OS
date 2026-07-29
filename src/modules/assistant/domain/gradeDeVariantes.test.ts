import test from "node:test";
import assert from "node:assert/strict";

import {
  associarIdentificador,
  escreverVariante,
  montarGrade,
  resumirGrade,
  variantesSem,
} from "./gradeDeVariantes";

test('"preto 37, 38, 39 e bege 36, 37, 38" dá SEIS variantes', () => {
  const grade = montarGrade({ cores: ["Preto", "Bege"], tamanhos: ["37", "38", "39"] });
  assert.equal(grade.length, 6);
  assert.deepEqual(grade[0], { cor: "Preto", tamanho: "37" });
  assert.deepEqual(grade[5], { cor: "Bege", tamanho: "39" });
});

test("uma cor e um tamanho dão UMA variante", () => {
  const grade = montarGrade({ cores: ["Preto"], tamanhos: ["37"] });
  assert.equal(grade.length, 1);
});

test("só cores, sem tamanho: ainda é grade", () => {
  // "Tem preto e bege" são duas variantes. Exigir os dois eixos obrigaria a
  // inventar o tamanho.
  const grade = montarGrade({ cores: ["Preto", "Bege"], tamanhos: [] });
  assert.equal(grade.length, 2);
  assert.equal(grade[0].tamanho, "");
});

test("só tamanhos, sem cor: também é grade", () => {
  const grade = montarGrade({ cores: [], tamanhos: ["37", "38"] });
  assert.equal(grade.length, 2);
  assert.equal(grade[0].cor, "");
});

test("nenhum eixo: grade vazia, não uma variante fantasma", () => {
  assert.deepEqual(montarGrade({ cores: [], tamanhos: [] }), []);
});

test("repetição e vazio saem — é digitação, não intenção", () => {
  const grade = montarGrade({
    cores: ["Preto", "preto", "  ", "Bege"],
    tamanhos: ["37", "37", ""],
  });
  assert.equal(grade.length, 2);
  assert.deepEqual(grade.map((v) => v.cor), ["Preto", "Bege"]);
});

test("o resumo agrupa por cor — é o que se lê num relance", () => {
  const grade = montarGrade({ cores: ["Preto", "Bege"], tamanhos: ["37", "38"] });
  const r = resumirGrade(grade);
  assert.equal(r.total, 4);
  assert.deepEqual(r.porCor, [
    { cor: "Preto", tamanhos: ["37", "38"] },
    { cor: "Bege", tamanhos: ["37", "38"] },
  ]);
});

test("escrever variante junta os eixos que existem", () => {
  assert.equal(escreverVariante({ cor: "Preto", tamanho: "37" }), "Preto · 37");
  assert.equal(escreverVariante({ cor: "Preto", tamanho: "" }), "Preto");
  assert.equal(escreverVariante({ cor: "", tamanho: "37" }), "37");
  assert.equal(escreverVariante({ cor: "", tamanho: "" }), "(sem cor nem tamanho)");
});

// ---- ASSOCIAÇÃO DE IDENTIFICADOR ----

const GRADE = montarGrade({ cores: ["Preto", "Bege"], tamanhos: ["37", "38"] });

test('"preto 37 é SKU 01040533" associa na variante certa', () => {
  const r = associarIdentificador(GRADE, "sku", "01040533", { cor: "Preto", tamanho: "37" });
  assert.equal(r.ok, true);
  assert.equal(r.indice, 0);
  assert.equal(r.grade[0].sku, "01040533");
  // As outras NÃO recebem nada.
  assert.equal(r.grade[1].sku, undefined);
});

test("o zero inicial do SKU sobrevive à associação", () => {
  const r = associarIdentificador(GRADE, "sku", "01040533", { cor: "Preto", tamanho: "37" });
  assert.equal(r.ok, true);
  assert.equal(r.grade[0].sku, "01040533");
  assert.notEqual(r.grade[0].sku, "1040533");
});

test("EAN atravessa como string", () => {
  const r = associarIdentificador(GRADE, "ean", "7900350512518", { cor: "Bege", tamanho: "38" });
  assert.equal(r.ok, true);
  assert.equal(r.grade[3].ean, "7900350512518");
  assert.equal(typeof r.grade[3].ean, "string");
});

test("ALVO AMBÍGUO É RECUSADO, com os candidatos", () => {
  // "Esse é 01040533" com quatro variantes na mesa não tem alvo. Escolher a
  // primeira gravaria o identificador de uma variante em outra — e um SKU no
  // lugar errado é um produto trocado no pedido do cliente.
  const r = associarIdentificador(GRADE, "sku", "01040533", {});
  assert.equal(r.ok, false);
  assert.match(r.motivo, /qual variante/);
  assert.equal(r.candidatos?.length, 4);
});

test("alvo parcial que ainda bate em duas: recusado", () => {
  // "Preto é 01040533" — preto 37 ou preto 38?
  const r = associarIdentificador(GRADE, "sku", "01040533", { cor: "Preto" });
  assert.equal(r.ok, false);
  assert.deepEqual(r.candidatos, ["Preto · 37", "Preto · 38"]);
});

test("alvo parcial que determina UMA: aceito", () => {
  // Numa grade de uma cor só, "37" basta.
  const umaCor = montarGrade({ cores: ["Preto"], tamanhos: ["37", "38"] });
  const r = associarIdentificador(umaCor, "sku", "01040533", { tamanho: "37" });
  assert.equal(r.ok, true);
  assert.equal(r.grade[0].sku, "01040533");
});

test("alvo que não existe na grade é recusado, não criado", () => {
  const r = associarIdentificador(GRADE, "sku", "01040533", { cor: "Azul", tamanho: "37" });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /Não achei essa variante/);
});

test("identificador vazio é recusado", () => {
  const r = associarIdentificador(GRADE, "sku", "   ", { cor: "Preto", tamanho: "37" });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /Não entendi o sku/);
});

test("a associação não MUTA a grade original", () => {
  // Outros lugares comparam o rascunho antes e depois; mutar em silêncio
  // esconderia o que mudou.
  const antes = montarGrade({ cores: ["Preto"], tamanhos: ["37"] });
  const r = associarIdentificador(antes, "sku", "01040533", { cor: "Preto" });
  assert.equal(r.ok, true);
  assert.equal(antes[0].sku, undefined, "a grade de entrada foi alterada");
});

test("cor e tamanho casam sem depender de caixa", () => {
  const r = associarIdentificador(GRADE, "sku", "X", { cor: "PRETO", tamanho: "37" });
  assert.equal(r.ok, true);
});

test("variantesSem lista o que ainda falta — para a pergunta ser útil", () => {
  // Perguntar quatro SKUs de uma vez é interrogatório. Dizer "faltam 3" e pedir
  // os que faltam é trabalho.
  const r = associarIdentificador(GRADE, "sku", "01040533", { cor: "Preto", tamanho: "37" });
  assert.equal(r.ok, true);
  const faltam = variantesSem(r.grade, "sku");
  assert.equal(faltam.length, 3);
  assert.deepEqual(faltam.map((f) => f.descricao), ["Preto · 38", "Bege · 37", "Bege · 38"]);
});

test("grade completa não lista nada faltando", () => {
  let grade = montarGrade({ cores: ["Preto"], tamanhos: ["37"] });
  const r = associarIdentificador(grade, "sku", "01040533", { cor: "Preto" });
  assert.equal(r.ok, true);
  grade = r.grade;
  assert.deepEqual(variantesSem(grade, "sku"), []);
  // EAN continua faltando — os dois campos são contados separado.
  assert.equal(variantesSem(grade, "ean").length, 1);
});
