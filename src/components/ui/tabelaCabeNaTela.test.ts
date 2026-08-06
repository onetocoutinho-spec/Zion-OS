// A tabela não pode exigir barra de rolagem horizontal.
//
// ===========================================================================
// O DEFEITO, RELATADO POR QUEM USA
// ===========================================================================
//
// "ao invés da tabela ficar completa ela corta e tem uma barra lá embaixo para
// rolar". Nas telas de 7 colunas isso escondia as três últimas — inclusive a de
// AÇÃO, que é onde a pessoa clica.
//
// A causa era `whitespace-nowrap` no nome do registro, em `TdMain`. Nomes de
// produto são longos ("Chinelo Ortopedico Modare Feminino Esporao Massageador
// Macio"), e proibir a quebra faz a coluna assumir a largura do nome mais
// comprido da lista inteira. A tabela passa a ter uma LARGURA MÍNIMA.
//
// Medido no navegador, com as classes e os nomes reais:
//
//   com nowrap → mínimo de 937px  · estoura 237px num container de 700
//   sem nowrap → cabe em 700, 800, 900 e 1000
//
// Uma tabela que esconde o botão é pior que uma tabela com o nome em duas
// linhas.
//
// ===========================================================================
// O QUE ESTE ARQUIVO PROVA — E O QUE NÃO PROVA
// ===========================================================================
//
// PROVA que as classes que causavam o mínimo não voltaram. NÃO prova o
// layout — isso foi medido no navegador, e um teste em Node não renderiza CSS.

import test from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../../testing/lerFonte.ts";

const TABELA = lerFonte(new URL("./Table.tsx", import.meta.url), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("o NOME do registro pode quebrar linha — é o que tira a largura mínima", () => {
  const codigo = semComentarios(TABELA);
  const tdMain = codigo.slice(codigo.indexOf("export function TdMain"));
  const corpo = tdMain.slice(0, tdMain.indexOf("\n}"));
  assert.ok(
    !/whitespace-nowrap/.test(corpo),
    "`whitespace-nowrap` voltou ao nome: a tabela volta a ter largura mínima e a esconder a coluna de ação"
  );
});

test("o CABEÇALHO continua sem quebrar — ali o texto é curto", () => {
  // A distinção importa: rótulo de coluna quebrado em duas linhas é feio e não
  // custa largura, porque "Score" e "Falta" já são estreitos. O problema nunca
  // foi o `th`.
  const codigo = semComentarios(TABELA);
  const cabecalho = codigo.slice(codigo.indexOf("<th"), codigo.indexOf("</th>"));
  assert.match(cabecalho, /whitespace-nowrap/);
});

test("a rolagem horizontal continua POSSÍVEL — só deixou de ser necessária", () => {
  // `overflow-x-auto` fica: numa tela estreita de celular, sete colunas não
  // cabem de jeito nenhum, e aí rolar é melhor que cortar. O que mudou é que
  // ela parou de ser obrigatória no desktop.
  assert.match(TABELA, /overflow-x-auto/);
});

// ---------------------------------------------------------------------------
// A COLUNA QUE SAIU — e o critério foi medição, não gosto
// ---------------------------------------------------------------------------

test("as duas colunas que saíram não voltaram — e por motivos diferentes", () => {
  // "Marketplace": 1 valor distinto em 590 anúncios ("Mercado Livre"). Não
  // informava nada. Mesmo argumento do PR #70 na tabela de produtos.
  //
  // "Prioridade": VARIAVA — vinha de `prioridade(a)`, calculada de nota e
  // pendências. Saiu por ser DERIVADA de Score e Problema principal, que estão
  // ali ao lado. Redundância, não constância, e decisão do dono do produto.
  const tela = semComentarios(
    lerFonte(new URL("../../app/cliente/anuncios/page.tsx", import.meta.url), "utf8")
  );
  const inicio = tela.indexOf("<Table");
  const bloco = tela.slice(inicio, tela.indexOf("</Table>", inicio));
  assert.ok(!/<Td>\{a\.marketplace\}<\/Td>/.test(bloco), "a coluna constante voltou");
  assert.ok(!/"Marketplace"/.test(bloco), "o cabeçalho da coluna constante voltou");
  assert.ok(!/"Prioridade"/.test(bloco), "o cabeçalho da coluna derivada voltou");
  // A função que só existia para ela também saiu: código morto que ninguém
  // remove vira código que alguém religa sem entender por que saiu.
  assert.ok(
    !/function prioridade\(/.test(tela),
    "`prioridade()` continua no arquivo sem nenhuma coluna que a use"
  );
});

test("os colSpan acompanharam o número de colunas", () => {
  // Um `colSpan` desatualizado quebra a linha vazia e a linha expandida em
  // silêncio — a tabela continua desenhando, só torta.
  const tela = lerFonte(
    new URL("../../app/cliente/anuncios/page.tsx", import.meta.url),
    "utf8"
  );
  // As colunas saíram do `headers={[...]}` inline e viraram `COLUNAS_DA_LISTA`
  // em 06/08: passaram a ter DOIS leitores — a tabela carregada e o esqueleto
  // que aparece antes dela. Duas listas escritas à mão divergiriam, e esqueleto
  // com número de colunas diferente do conteúdo é o pulo de layout que ele
  // existe para evitar. O teste segue a constante em vez de exigir o inline.
  const decl = tela.slice(tela.indexOf("const COLUNAS_DA_LISTA"));
  const cabecalhos = decl.slice(0, decl.indexOf("]"));
  const colunas = (cabecalhos.match(/"/g) ?? []).length / 2;
  assert.equal(colunas, 5, `esperava 5 colunas, achei ${colunas}`);
  assert.match(
    tela,
    /headers=\{COLUNAS_DA_LISTA\}/,
    "a tabela deixou de usar a constante: as duas listas voltam a poder divergir"
  );
  for (const m of tela.matchAll(/colSpan=\{(\d+)\}/g)) {
    assert.equal(Number(m[1]), colunas, `colSpan=${m[1]} não acompanha as ${colunas} colunas`);
  }
});
