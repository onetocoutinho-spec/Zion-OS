// Testes do nome do produto quando a planilha cola a derivação nele.
//
// O que se prova: o corte só acontece com PROVA — a outra coluna dizendo qual é
// o sufixo — e nunca por palpite de pontuação. Cortar no primeiro hífen
// destruiria "Tênis Slip On - Preto" em silêncio.
//
// Rodar: npx tsx --test src/modules/catalog/domain/nomeSemDerivacao.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { nomeSemDerivacao } from "./nomeSemDerivacao.ts";

test("o caso real que apareceu na tela em 26/08", () => {
  const cheio =
    "Sandália Molekinha 2312.260 Turim Fem - SANDALIA MOLEKINHA 2312.260 TURIM FEM (9583 ROSA/SILVER 35)";
  const derivacao = "SANDALIA MOLEKINHA 2312.260 TURIM FEM (9583 ROSA/SILVER 35)";
  assert.equal(nomeSemDerivacao(cheio, derivacao), "Sandália Molekinha 2312.260 Turim Fem");
});

test("a caixa não impede o corte — o ERP grava a derivação em maiúsculas", () => {
  assert.equal(nomeSemDerivacao("Papete Nobuck - PAPETE NOBUCK (39)", "papete nobuck (39)"), "Papete Nobuck");
});

test("sem a coluna de derivação, o nome fica como veio", () => {
  // Sem prova, sem corte. É a linha 7224 do arquivo real.
  const n = "Chinelo Havaianas - Top Max";
  assert.equal(nomeSemDerivacao(n, undefined), n);
  assert.equal(nomeSemDerivacao(n, ""), n);
});

test("derivação que NÃO é sufixo não corta nada", () => {
  // O valor existe, mas não está no fim: cortar seria adivinhar.
  assert.equal(
    nomeSemDerivacao("Tênis Loc Salem - Calce Fácil", "PRETO 42"),
    "Tênis Loc Salem - Calce Fácil"
  );
});

test("hífen no nome legítimo sobrevive", () => {
  // A prova de que o corte não é por pontuação. Cortar no primeiro " - " aqui
  // devolveria "Tênis Slip On" e ninguém veria a perda.
  assert.equal(nomeSemDerivacao("Tênis Slip On - Preto", ""), "Tênis Slip On - Preto");
  assert.equal(
    nomeSemDerivacao("Tênis Slip On - Preto - PRETO 40", "PRETO 40"),
    "Tênis Slip On - Preto"
  );
});

test("nome que é SÓ a derivação não vira vazio", () => {
  // Produto chamado "" é pior que produto com nome comprido.
  assert.equal(nomeSemDerivacao("PRETO 40", "PRETO 40"), "PRETO 40");
  // O nome volta APARADO, não idêntico à entrada: espaço nas pontas é ruído,
  // e o teste do espaço logo abaixo depende dessa mesma regra.
  assert.equal(nomeSemDerivacao(" - PRETO 40", "PRETO 40"), "- PRETO 40");
});

test("os três traços de ligação são aparados", () => {
  assert.equal(nomeSemDerivacao("Bota Cano Alto - X", "X"), "Bota Cano Alto");
  assert.equal(nomeSemDerivacao("Bota Cano Alto – X", "X"), "Bota Cano Alto");
  assert.equal(nomeSemDerivacao("Bota Cano Alto — X", "X"), "Bota Cano Alto");
  assert.equal(nomeSemDerivacao("Bota Cano Alto-X", "X"), "Bota Cano Alto");
});

test("espaço em volta não atrapalha", () => {
  assert.equal(nomeSemDerivacao("  Sapatilha Nude - NUDE 37  ", "  NUDE 37 "), "Sapatilha Nude");
});

test("derivação maior que o nome não corta", () => {
  assert.equal(nomeSemDerivacao("X", "NOME ENORME DA DERIVACAO"), "X");
});
