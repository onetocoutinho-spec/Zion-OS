// No celular a linha da tabela é um CARTÃO — e cada valor carrega o nome dele.
//
// ===========================================================================
// O DEFEITO, NUM PRINT DA CONTA REAL
// ===========================================================================
//
// Em 06/08/2026 a lojista abriu Meus Produtos no telefone. O que apareceu na
// tela:
//
//     40/100   [Kit]  [Medidas]  [Otimizar]
//
// Sem nome de produto nenhum. Em outro print: "R$ 210 · Em revisão · 40/100",
// também sem sujeito. Em um terceiro, os nomes — e nenhum valor.
//
// A tabela de produtos tem SETE colunas. Em 375px ela não cabe, o
// `overflow-x-auto` deixa rolar, e a COLUNA DE IDENTIDADE — a primeira — sai da
// tela. A lojista estava a um toque de "Otimizar" sem saber em qual produto.
//
// Rolagem horizontal numa tabela de três colunas é aceitável. Numa de sete ela
// esconde a identidade, e o que sobra são números sem sujeito — exatamente o
// defeito que o AUD-001 mediu nos dados, agora produzido pelo LAYOUT.
//
// A régua (`ui-ux-pro-max`, Table Handling) dá as duas saídas: "horizontal
// scroll OR card layout". O projeto tinha a primeira, e ela não serve aqui.
//
// ===========================================================================
// POR QUE O CONSERTO É NO CSS E NA PRIMITIVA
// ===========================================================================
//
// São CINCO telas com tabela — produtos, anúncios, auditoria, pendências,
// precificação. Reescrever cada uma em cartão seriam cinco implementações
// divergindo na primeira que alguém esquecesse: o defeito de "a regra em cinco
// lugares" que este repositório já pagou na regra da capa.
//
// Assim o `<table>` continua `<table>` (semântica preservada no desktop), a
// transformação é do CSS, e o rótulo de cada campo vem dos MESMOS `headers` que
// o cabeçalho usa. Uma fonte de verdade — duas listas para a mesma coisa é como
// a página de um produto já apareceu ao lado de outro neste projeto.
//
// Verificado no navegador, em 375px, e não só aqui: sem rolagem horizontal na
// página nem dentro da tabela, primeira célula em `block`, segunda mostrando o
// rótulo "SKU", cabeçalho em `display: none`.

import { test } from "node:test";
import assert from "node:assert/strict";

import { lerFonte } from "../../../testing/lerFonte.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) => lerFonte(new URL(rel, raiz), "utf8");
const semComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const CSS = ler("app/globals.css");
const TABELA = semComentarios(ler("components/ui/Table.tsx"));

// ── A transformação ─────────────────────────────────────────────────────────

test("existe a regra que transforma a tabela em cartão no celular", () => {
  assert.match(CSS, /@media\s*\(max-width:\s*639px\)/);
  assert.match(CSS, /\.tabela-cartao\s+td\s*\{[\s\S]{0,200}?display:\s*flex/);
});

test("o cabeçalho da tabela sai — num cartão o rótulo vai em cada campo", () => {
  assert.match(CSS, /\.tabela-cartao\s+thead\s*\{\s*display:\s*none/);
});

test("cada valor mostra o NOME do campo", () => {
  // Sem isto o cartão vira "40/100" solto, que é o mesmo defeito de outra forma:
  // número sem significado.
  assert.match(CSS, /content:\s*attr\(data-rotulo\)/);
});

test("a IDENTIDADE é o título do cartão, sem rótulo e em largura inteira", () => {
  // É a coluna que a rolagem escondia. Se ela voltar a ser um par
  // rótulo/valor à direita, o nome do produto some do topo do cartão.
  assert.match(CSS, /td\[data-identidade\]\s*\{[\s\S]{0,160}?display:\s*block/);
  assert.match(CSS, /td\[data-identidade\]::before\s*\{\s*content:\s*none/);
});

test("a célula de largura inteira (o estado vazio) não ganha rótulo", () => {
  assert.match(CSS, /td\[colspan\]::before\s*\{\s*content:\s*none/);
});

// ── A primitiva ─────────────────────────────────────────────────────────────

test("o invólucro só rola horizontalmente a partir de sm", () => {
  // `overflow-x-auto` sem prefixo era o que permitia esconder a identidade no
  // celular. No desktop ele continua, porque lá a rolagem é a saída certa.
  assert.match(TABELA, /className="tabela-cartao[^"]*sm:overflow-x-auto"/);
  assert.doesNotMatch(
    TABELA,
    /className="overflow-x-auto/,
    "voltou a rolar no celular, e a rolagem esconde o nome do produto"
  );
});

test("o rótulo vem dos MESMOS headers do cabeçalho", () => {
  // Duas listas para a mesma coisa envelhecem em direções diferentes.
  //
  // O RECORTE NÃO FECHA MAIS O PARÊNTESE, e a diferença é a de sempre por
  // aqui: `comRotulos\(children,\s*headers\)` exigia que a chamada tivesse
  // EXATAMENTE dois argumentos. Quando `comRotulos` ganhou um terceiro
  // (`acaoFixa`, que gruda a coluna de ação na borda direita), este teste
  // reprovou uma mudança que não mexeu em nada do que ele protege — a lista
  // continua sendo UMA, a mesma `headers` do cabeçalho.
  //
  // É a mesma armadilha que `tabelaCabeNaTela.test.ts` já narra três vezes:
  // sentinela ancorada na FORMA envelhece com o layout. O que vale é que os
  // dois primeiros argumentos sejam `children` e `headers`; quantos vêm
  // depois é assunto de quem chama. Trocar `headers` por outra lista continua
  // reprovando, que é o ponto.
  assert.match(TABELA, /comRotulos\(children,\s*headers\b/);
  assert.match(TABELA, /"data-rotulo":\s*headers\[indice\]/);
});

test("a primeira coluna é marcada como identidade", () => {
  assert.match(TABELA, /indice === 0 \? \{ "data-identidade": "" \}/);
});

test("célula com colSpan passa intacta", () => {
  // O estado vazio não é par rótulo/valor. Marcá-lo poria "PRODUTO" na frente
  // de "Nenhum registro encontrado".
  assert.match(TABELA, /if \(cp\.colSpan\) return celula/);
});

test("Td e TdMain REPASSAM os atributos injetados", () => {
  // Sem o repasse o clone acontece e o atributo morre no caminho: a tabela
  // viraria cartão com todos os valores sem nome, que é pior que rolando.
  assert.match(TABELA, /<td \{\.\.\.resto\} className=\{`px-4 py-3 align-top text-zinc-400/);
  assert.match(TABELA, /<td \{\.\.\.resto\} className="px-4 py-3 align-top">/);
});

// ── O cabeçalho de ações ────────────────────────────────────────────────────

test("os botões do cabeçalho quebram linha em vez de deslocar a página", () => {
  // Quatro botões em `flex` sem `flex-wrap` não quebram: empurram a largura e
  // deslocam a PÁGINA. No print, o conteúdo aparecia cortado à esquerda e o
  // título fora da tela. O `PageHeader` já quebrava; era o grupo de dentro.
  for (const rel of [
    "app/cliente/produtos/page.tsx",
    "app/cliente/vendas/page.tsx",
    "app/cliente/anuncios/page.tsx",
  ]) {
    const fonte = semComentarios(ler(rel));
    const grupo = /acao=\{\s*<div className="([^"]*)"/.exec(fonte);
    assert.ok(grupo, `${rel}: não achei o grupo de ações do cabeçalho`);
    assert.match(grupo[1], /flex-wrap/, `${rel}: o cabeçalho voltou a não quebrar linha`);
  }
});
