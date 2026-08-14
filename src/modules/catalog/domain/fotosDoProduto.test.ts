import test from "node:test";
import assert from "node:assert/strict";
import { diagnosticarFotos, serveDeCapa } from "./fotosDoProduto.ts";

// A pergunta que a lojista faz produto a produto é "preciso fotografar este,
// ou já tenho foto boa aqui dentro?" — e a diferença entre as duas respostas é
// uma viagem ao fabricante.

const NOME = "Chinelo Havaianas Top Liso";
const boa = { largura: 1200, altura: 1200, cor: "Azul-marinho" };
const ruim = { largura: 402, altura: 496, cor: null };

test("capa não medida NÃO é capa ruim", () => {
  // "não medimos" e "está ruim" são respostas diferentes, e só a segunda manda
  // alguém trabalhar. Somar as duas mandaria a lojista fotografar o que talvez
  // já esteja certo.
  const d = diagnosticarFotos([{ mlb: "MLB1", capaMaxSize: null }], [], NOME);
  assert.equal(d.veredicto, "nao-sei");
  assert.equal(d.foraDoPadrao, 0);
  assert.equal(d.semMedida, 1);
  assert.match(d.frase, /Reler minha conta/);
});

test("com algumas medidas e outras não, a ressalva ENTRA na frase", () => {
  // O silêncio sobre o que não sabemos é o que faz um número parcial passar
  // por completo.
  const d = diagnosticarFotos(
    [
      { mlb: "MLB1", capaMaxSize: "402x496" },
      { mlb: "MLB2", capaMaxSize: null },
    ],
    [],
    NOME
  );
  assert.equal(d.foraDoPadrao, 1);
  assert.equal(d.semMedida, 1);
  assert.match(d.frase, /de 1 anúncio\(s\) eu ainda não sei/);
});

test("tudo dentro do padrão não gasta o tempo dela", () => {
  const d = diagnosticarFotos([{ mlb: "MLB1", capaMaxSize: "1200x1200" }], [], NOME);
  assert.equal(d.veredicto, "tudo-certo");
  assert.doesNotMatch(d.frase, /fotograf/i);
});

test("tem foto boa no cadastro: o conserto é um clique, não uma viagem", () => {
  const d = diagnosticarFotos([{ mlb: "MLB1", capaMaxSize: "402x496" }], [boa, ruim], NOME);
  assert.equal(d.veredicto, "tem-foto-para-aplicar");
  assert.equal(d.fotosQueServem, 1);
  assert.deepEqual([...d.coresProntas], ["Azul-marinho"]);
  assert.match(d.frase, /já tenho 1 foto\(s\) aqui/);
  assert.match(d.frase, /Azul-marinho/);
});

test("foto boa SEM cor não vira promessa — cada anúncio é de uma cor", () => {
  // Aplicar na cor errada troca uma infração de foto por "o anúncio não
  // corresponde ao produto". Foi exatamente o erro cometido em 14/08/2026.
  const d = diagnosticarFotos(
    [{ mlb: "MLB1", capaMaxSize: "402x496" }],
    [{ largura: 1200, altura: 1200, cor: null }],
    NOME
  );
  assert.equal(d.veredicto, "tem-foto-para-aplicar");
  assert.deepEqual([...d.coresProntas], []);
  assert.match(d.frase, /nenhuma delas tem a cor definida/);
});

test("nenhuma foto serve: diz que é foto NOVA, e por onde mandar", () => {
  // "Não dá" ensina a desistir. "Me mande pelo chat" é o que ela pode fazer
  // hoje à noite.
  const d = diagnosticarFotos([{ mlb: "MLB1", capaMaxSize: "402x496" }], [ruim, ruim], NOME);
  assert.equal(d.veredicto, "precisa-fotografar");
  assert.match(d.frase, /nenhuma das 2 foto\(s\)/);
  assert.match(d.frase, /1200 ou mais de lado/);
  assert.match(d.frase, /me mande pelo chat/i);
});

test("produto sem anúncio não é diagnosticado como capa ruim", () => {
  const d = diagnosticarFotos([], [ruim], NOME);
  assert.equal(d.veredicto, "sem-anuncio");
  assert.equal(d.foraDoPadrao, 0);
});

test("a régua é a MESMA da tela: quadrada E 1200 de lado", () => {
  // Uma segunda régua diria "serve" sobre o que a outra reprova, e a lojista
  // descobriria a divergência com o anúncio no ar.
  assert.equal(serveDeCapa({ largura: 1200, altura: 1200, cor: null }), true);
  assert.equal(serveDeCapa({ largura: 1200, altura: 960, cor: null }), false, "retangular passou");
  assert.equal(serveDeCapa({ largura: 900, altura: 900, cor: null }), false, "pequena passou");
  assert.equal(serveDeCapa({ largura: null, altura: null, cor: null }), false, "sem medida passou");
});

test("a contagem NUNCA soma o que não foi medido", () => {
  // A regra geral, sobre todos os arranjos: `foraDoPadrao + semMedida` jamais
  // pode passar do total de anúncios, e `semMedida` jamais entra em
  // `foraDoPadrao`.
  const casos = [
    ["402x496", null, "1200x1200"],
    [null, null, null],
    ["1200x1200", "1200x1200"],
    ["686x466", "1200x1200", null, "374x463"],
  ];
  for (const capas of casos) {
    const d = diagnosticarFotos(
      capas.map((c, i) => ({ mlb: `MLB${i}`, capaMaxSize: c })),
      [],
      NOME
    );
    assert.ok(
      d.foraDoPadrao + d.semMedida <= d.anuncios,
      `${capas.join("|")}: soma passou do total`
    );
    assert.equal(d.anuncios, capas.length);
  }
});
