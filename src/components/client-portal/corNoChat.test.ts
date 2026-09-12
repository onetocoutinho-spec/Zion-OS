import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A cor da foto atravessa QUATRO pontos entre o clipe e o banco: carregar as
// cores do produto, passar ao cartão, o cartão devolver a escolhida, e o
// upload gravá-la. Quebrar qualquer um deles não dá erro — dá foto sem cor.
//
// ===========================================================================
// E foto sem cor é o fim da linha, não um detalhe
// ===========================================================================
//
// Os anúncios desta base são um por cor e tamanho (460 para 80 produtos). Uma
// foto sem cor não pode virar capa de anúncio nenhum, porque usá-la na cor
// errada troca uma infração de FOTO por uma de "o anúncio não corresponde ao
// produto" — a categoria com que o ML já pausou 25 anúncios desta conta.
//
// Esta é a quinta lista nominal que esta base guarda com sentinela. As quatro
// anteriores nasceram do mesmo jeito: alguém ligou três das quatro pontas e o
// compilador não reclamou.

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CHAT = semComentarios(
  readFileSync(new URL("./ChatDaOperacao.tsx", import.meta.url), "utf8")
);
const CARTAO = semComentarios(
  readFileSync(new URL("./ConferirFoto.tsx", import.meta.url), "utf8")
);

test("1. o chat carrega as cores do produto quando a foto chega", () => {
  assert.match(
    CHAT,
    /listarVariantesDoProduto\([\s\S]{0,60}?coresDoProduto\(/,
    "o chat parou de carregar as cores — o cartão não teria o que oferecer"
  );
});

test("2. as cores chegam ao cartão", () => {
  assert.match(
    CHAT,
    /cores=\{t\.foto\.cores\}/,
    "o cartão deixou de receber as cores e a pergunta some da tela"
  );
});

test("3. o cartão devolve a cor escolhida", () => {
  assert.match(
    CARTAO,
    /onConfirmar\(comoCapa, cor\.trim\(\) \|\| null\)/,
    "o cartão voltou a devolver só `comoCapa` — a escolha da lojista é descartada"
  );
  // Vazio VIRA `null`, não string vazia: a constraint da 060 recusa vazio, e
  // gravar "" seria a ausência disfarçada de resposta.
  assert.match(CARTAO, /cor\.trim\(\) \|\| null/);
});

test("4. a cor chega ao upload", () => {
  assert.match(
    CHAT,
    /\.\.\.\(cor \? \{ cor \} : \{\}\)/,
    "a cor escolhida não é mais enviada ao upload — ela morre no caminho"
  );
});

test("o seletor começa VAZIO — não pré-seleciona cor", () => {
  // Pré-selecionar a primeira faria a foto do preto ser gravada como amarela
  // sempre que ela não reparasse no campo. Cor errada é pior que cor nenhuma:
  // `null` ao menos impede o uso.
  assert.match(
    CARTAO,
    /useState\(""\)/,
    "o seletor de cor passou a vir preenchido — a foto ganha cor por descuido"
  );
  assert.match(
    CARTAO,
    /<option value="">Não sei dizer<\/option>/,
    'sumiu a saída "Não sei dizer" — a lojista fica obrigada a chutar uma cor'
  );
});
