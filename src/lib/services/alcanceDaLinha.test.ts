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
import { readFileSync } from "node:fs";
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

test("linha que atinge UM produto devolve exatamente um", () => {
  const alcance = alcancePorNome([linha("Babuche Molekinha Arco Iris 22591.408")], "nome", CATALOGO);
  assert.equal(alcance.get(0)?.length, 1);
});

test("ZERO é devolvido como zero — não confundido com um", () => {
  // O DEFEITO, medido em 10/08/2026: a função só registrava `> 1`, e a tela
  // mostrava "1 produto" como padrão para quem não estava no mapa. Uma linha de
  // "Sapato Fantasma Que Nao Existe No Catalogo" aparecia como se fosse cair em
  // algum lugar. Confundir zero com um é o oposto do que esta coluna faz.
  const alcance = alcancePorNome([linha("Sapato Que Não Existe")], "nome", CATALOGO);
  assert.ok(alcance.has(0), "a linha que não casa com nada sumiu do mapa");
  assert.deepEqual(alcance.get(0), [], "zero produtos precisa sair como lista vazia");
});

test("linha SEM nome fica fora do mapa — a tela não afirma nada sobre ela", () => {
  // Diferente de zero: aqui não há o que medir por nome. Quem casa por SKU vai
  // por outro caminho, e esta função não fala daquele.
  const alcance = alcancePorNome([{ nome: "", custo: "10" }], "nome", CATALOGO);
  assert.equal(alcance.size, 0);
});

test("sem coluna de nome, não há o que avisar", () => {
  // Planilha que casa só por SKU atinge a variante exata: não há espalhamento.
  const alcance = alcancePorNome([linha("Babuche Yvate Feminina Eva 1816 Conforto")], null, CATALOGO);
  assert.equal(alcance.size, 0);
});

test("catálogo vazio dá zero, não um", () => {
  const alcance = alcancePorNome([linha("Babuche Yvate Feminina Eva 1816 Conforto")], "nome", []);
  assert.deepEqual(alcance.get(0), []);
});

test("o índice devolvido é o da LINHA, para a prévia casar a coluna certa", () => {
  const alcance = alcancePorNome(
    [linha("Chinelo Havaianas Top Liso"), linha("Babuche Yvate Feminina Eva 1816 Conforto")],
    "nome",
    CATALOGO
  );
  assert.equal(alcance.get(0)?.length, 1, "a primeira linha atinge um só");
  assert.equal(alcance.get(1)?.length, 2, "a segunda é que espalha");
});

// ---------------------------------------------------------------------------
// A TELA precisa distinguir os QUATRO casos
// ---------------------------------------------------------------------------
//
// A função devolve o alcance; a coluna traduz. Estas asserções guardam a
// tradução, porque foi ali que o defeito morava: "1 produto" era o padrão para
// tudo que não estivesse no mapa, e zero caía nesse padrão.

test("a coluna trata zero, um, muitos e sem-nome de formas diferentes", () => {
  const tela = readFileSync(
    new URL("../../components/client-portal/ConferirPlanilha.tsx", import.meta.url),
    "utf8"
  );
  const coluna = tela.slice(tela.indexOf("const atinge = alcance.get("), tela.indexOf("</td>", tela.indexOf("const atinge = alcance.get(")));

  assert.match(coluna, /if \(!atinge\) return/, "linha sem nome deixou de ser um caso próprio");
  assert.match(coluna, /atinge\.length === 0/, "zero deixou de ser um caso próprio — volta a virar '1 produto'");
  assert.match(coluna, /atinge\.length === 1/, "um deixou de ser um caso próprio");
  assert.match(coluna, /nenhum/, "a palavra que avisa que a linha não vai gravar sumiu");
  assert.match(coluna, /pelo SKU/, "sumiu o caso em que o nome não acha mas a chave ainda pode");
});

test("zero COM chave alternativa não é dito como 'nenhum'", () => {
  // A linha tem SKU: zero PELO NOME não é zero no total, e afirmar "nenhum"
  // ali trocaria um erro por outro.
  const tela = readFileSync(
    new URL("../../components/client-portal/ConferirPlanilha.tsx", import.meta.url),
    "utf8"
  );
  assert.match(
    tela,
    /l\.chave \?[\s\S]{0,400}pelo SKU/,
    "o caso 'zero pelo nome, mas tem SKU' deixou de ser distinguido"
  );
});
