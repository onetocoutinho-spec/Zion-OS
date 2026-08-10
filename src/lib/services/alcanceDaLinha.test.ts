// Uma linha da planilha pode atingir mais de um produto — e ela precisa saber.
//
// ===========================================================================
// O CASO, MEDIDO NA CONTA REAL
// ===========================================================================
//
// 10/08/2026, testando a importação pelo chat com DUAS linhas. O relatório
// disse "3 produto(s)".
//
// A linha era "Babuche Yvate FEMININA Eva 1816 Conforto" e o casamento por nome
// pegou também o MASCULINO — mesmo modelo, mesma numeração, uma palavra de
// diferença. Os dois tinham custo idêntico e não houve estrago. Foi sorte: uma
// planilha com "Feminina — R$ 31,00" daria 31,00 ao Masculino, calado.
//
// O importador já recusa o CONFLITO — duas linhas brigando pelo mesmo produto,
// com custos diferentes. O oposto passava sem aviso, porque do ponto de vista
// dele não há disputa: uma linha, um custo, vários produtos felizes.
//
// ===========================================================================
// POR QUE MOSTRAR E NÃO RECUSAR
// ===========================================================================
//
// Espalhar às vezes é o que ela QUER: o mesmo modelo em quatro cores, uma linha
// de custo para todas. Recusar transformaria o caso legítimo em digitação
// manual. Mostrar deixa a decisão com quem conhece o catálogo.

import test from "node:test";
import assert from "node:assert/strict";
import { alcancePorNome } from "./importacaoCustos.ts";

const CATALOGO = [
  "Babuche Yvate Feminina Eva 1816 Conforto",
  "Babuche Yvate Masculino Eva 1816 Conforto",
  "Babuche Molekinha Arco Iris 22591.408",
  "Chinelo Havaianas Top Liso",
];

const linha = (nome: string) => ({ nome, custo: "29,50" });

test("o caso real: FEMININA atinge também o MASCULINO", () => {
  const alcance = alcancePorNome([linha("Babuche Yvate Feminina Eva 1816 Conforto")], "nome", CATALOGO);
  const atingidos = alcance.get(0);
  assert.ok(atingidos, "a linha que espalhou não foi sinalizada");
  assert.equal(atingidos!.length, 2);
  assert.ok(atingidos!.some((n) => /Masculino/.test(n)), "o Masculino não apareceu no alcance");
});

test("linha que atinge UM produto não vira aviso", () => {
  // Ruído é como se ensina alguém a ignorar a coluna. O caso normal fica quieto.
  const alcance = alcancePorNome([linha("Babuche Molekinha Arco Iris 22591.408")], "nome", CATALOGO);
  assert.equal(alcance.size, 0);
});

test("nome que não casa com nada também não vira aviso", () => {
  // "Não achei" é outro problema, e o relatório da importação já o conta em
  // `naoEncontrados`. Misturar os dois aqui confundiria duas coisas diferentes.
  const alcance = alcancePorNome([linha("Sapato Que Não Existe")], "nome", CATALOGO);
  assert.equal(alcance.size, 0);
});

test("sem coluna de nome, não há o que avisar", () => {
  // Planilha que casa só por SKU atinge a variante exata: não há espalhamento.
  const alcance = alcancePorNome([linha("Babuche Yvate Feminina Eva 1816 Conforto")], null, CATALOGO);
  assert.equal(alcance.size, 0);
});

test("catálogo vazio não inventa alcance", () => {
  const alcance = alcancePorNome([linha("Babuche Yvate Feminina Eva 1816 Conforto")], "nome", []);
  assert.equal(alcance.size, 0);
});

test("o índice devolvido é o da LINHA, para a prévia casar a coluna certa", () => {
  const alcance = alcancePorNome(
    [linha("Chinelo Havaianas Top Liso"), linha("Babuche Yvate Feminina Eva 1816 Conforto")],
    "nome",
    CATALOGO
  );
  assert.ok(!alcance.has(0), "sinalizou a linha errada");
  assert.ok(alcance.has(1), "a segunda linha é que espalha");
});
