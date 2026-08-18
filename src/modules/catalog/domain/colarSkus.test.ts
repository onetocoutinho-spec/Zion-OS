import test from "node:test";
import assert from "node:assert/strict";

import { lerColagem, fraseDaColagem, rotuloDaVariante, type VarianteSemSku } from "./colarSkus";

// As variações REAIS de "Chinelo Ortopédico Feminino Slide Modare Ultraconforto
// Laço" — 14 variações, 567 peças em estoque, todas sem SKU desde a importação
// do ML em 08/07/2026.
const VARIANTES: VarianteSemSku[] = [
  { id: "v1", cor: "Preto", tamanho: "34" },
  { id: "v2", cor: "Preto", tamanho: "35" },
  { id: "v3", cor: "Preto", tamanho: "36" },
  { id: "v4", cor: "Bege", tamanho: "34" },
  { id: "v5", cor: "Bege", tamanho: "35" },
];

test("duas colunas casam por tamanho/cor, e a ORDEM não importa", () => {
  // O modo seguro. A planilha dela pode estar em qualquer ordem.
  const l = lerColagem(
    ["Bege 35\t010402", "Preto 34\t010399", "Preto 36\t010401", "Preto 35\t010400", "Bege 34\t010403"].join("\n"),
    VARIANTES
  );
  assert.equal(l.modo, "por-chave");
  assert.equal(l.atribuicoes.length, 5);
  assert.deepEqual(l.impedimentos, []);
  const doV1 = l.atribuicoes.find((a) => a.varianteId === "v1");
  assert.equal(doV1?.sku, "010399", "Preto 34 não recebeu o código dele");
  const doV5 = l.atribuicoes.find((a) => a.varianteId === "v5");
  assert.equal(doV5?.sku, "010402");
});

test("casa só pelo tamanho quando a cor não vem junto", () => {
  const sos = [
    { id: "a", cor: "Preto", tamanho: "34" },
    { id: "b", cor: "Preto", tamanho: "35" },
  ];
  const l = lerColagem("34;010399\n35;010400", sos);
  assert.equal(l.modo, "por-chave");
  assert.equal(l.atribuicoes.find((x) => x.varianteId === "a")?.sku, "010399");
});

test("acentuação e separador não atrapalham o casamento", () => {
  // "Azul-marinho" na tela, "azul marinho" na planilha; "37/38" e "37 / 38".
  const sos = [{ id: "a", cor: "Azul-marinho", tamanho: "37/38" }];
  const l = lerColagem("azul marinho 37 / 38\t010500", sos);
  assert.equal(l.atribuicoes.length, 1);
  assert.equal(l.atribuicoes[0].sku, "010500");
});

test("UMA coluna é posicional e só passa com a conta EXATA", () => {
  // Colar 4 códigos para 5 variações deslizaria todo o resto por uma linha —
  // e o efeito não é erro visível: é o custo de uma cor no tamanho de outra.
  const faltando = lerColagem("010399\n010400\n010401\n010402", VARIANTES);
  assert.equal(faltando.modo, "posicional");
  assert.equal(faltando.atribuicoes.length, 0, "gravaria um pareamento deslocado");
  assert.match(faltando.impedimentos[0], /4 código\(s\) para 5 variação\(ões\)/);
  // E a mensagem ENSINA a saída, em vez de só recusar.
  assert.match(faltando.impedimentos[0], /segunda coluna/);

  const certo = lerColagem("010399\n010400\n010401\n010402\n010403", VARIANTES);
  assert.deepEqual(certo.impedimentos, []);
  assert.equal(certo.atribuicoes.length, 5);
  assert.equal(certo.atribuicoes[0].varianteId, "v1");
  assert.equal(certo.atribuicoes[4].sku, "010403");
});

test("código REPETIDO é recusa, não aviso", () => {
  // Duas variações com o mesmo código herdariam o mesmo custo e o mesmo peso da
  // planilha do ERP — e são peças diferentes.
  const l = lerColagem("010399\n010399\n010401\n010402\n010403", VARIANTES);
  assert.equal(l.atribuicoes.length, 5);
  assert.match(l.impedimentos[0], /010399/);
  assert.match(l.impedimentos[0], /mesmo custo e o mesmo peso/);
});

test("diz o que SOBROU e o que FALTOU — é aí que a colagem errada se denuncia", () => {
  const l = lerColagem("Preto 34\t010399\nVerde 99\t019999", VARIANTES);
  assert.equal(l.atribuicoes.length, 1);
  assert.deepEqual(l.sobraram, ["Verde 99 019999"]);
  assert.equal(l.semCodigo.length, 4);
  assert.ok(l.semCodigo.includes("Bege · 35"));
});

test("uma variação não recebe dois códigos", () => {
  // Duas linhas apontando para a mesma variação: a primeira vale, a segunda
  // sobra e APARECE. Silenciar a segunda esconderia a planilha suja.
  const l = lerColagem("Preto 34\t010399\nPreto 34\t010999", VARIANTES);
  assert.equal(l.atribuicoes.filter((a) => a.varianteId === "v1").length, 1);
  assert.equal(l.atribuicoes[0].sku, "010399");
  assert.deepEqual(l.sobraram, ["Preto 34 010999"]);
});

test("colagem vazia não afirma nada", () => {
  const l = lerColagem("   \n\n  ", VARIANTES);
  assert.equal(l.modo, "nenhum");
  assert.deepEqual(l.atribuicoes, []);
  assert.equal(l.semCodigo.length, 5);
  assert.equal(fraseDaColagem(l), "");
});

test("a frase diz COMO casou — porque o risco dos dois modos é diferente", () => {
  const chave = lerColagem("Preto 34\t010399", VARIANTES);
  assert.match(fraseDaColagem(chave), /a ordem da sua planilha não importa/);
  assert.match(fraseDaColagem(chave), /4 variação\(ões\) ficam sem código/);

  const pos = lerColagem("1\n2\n3\n4\n5", VARIANTES);
  assert.match(fraseDaColagem(pos), /ORDEM da lista abaixo — confira antes de gravar/);
});

test("o rótulo da variação é o que a lojista reconhece", () => {
  assert.equal(rotuloDaVariante({ id: "x", cor: "Preto", tamanho: "37" }), "Preto · 37");
  assert.equal(rotuloDaVariante({ id: "x", cor: "", tamanho: "37" }), "37");
  assert.equal(rotuloDaVariante({ id: "x", cor: "", tamanho: "" }), "(sem cor nem tamanho)");
});

// ===========================================================================
// O SUFIXO DO TAMANHO — visto na tela em 18/08/2026
// ===========================================================================
//
// As variações desta base chamam-se "34 BR", "40 BR". A planilha do ERP diz
// "34". Comparar o texto inteiro não casa NADA, e a lojista não tem como
// adivinhar que precisa digitar " BR" — o exemplo que eu mesmo pus na tela
// estava errado para o catálogo dela.

const COM_BR: VarianteSemSku[] = [
  { id: "b1", cor: "Preto", tamanho: "34 BR" },
  { id: "b2", cor: "Preto", tamanho: "35 BR" },
  { id: "b3", cor: "Aveiã Soft", tamanho: "34 BR" },
];

test('"34" casa com "34 BR" quando a cor desempata', () => {
  const l = lerColagem("Preto 34\t010399\nAveiã Soft 34\t010500", COM_BR);
  assert.deepEqual(l.impedimentos, []);
  assert.equal(l.atribuicoes.find((a) => a.varianteId === "b1")?.sku, "010399");
  assert.equal(l.atribuicoes.find((a) => a.varianteId === "b3")?.sku, "010500");
});

test('"34" sozinho, batendo em duas cores, é RECUSA e não escolha', () => {
  // Duas variações têm tamanho 34. Escolher uma seria voltar a decidir por
  // ordem — exatamente o que o modo posicional existe para evitar.
  const l = lerColagem("34\t010399", COM_BR);
  assert.equal(l.atribuicoes.length, 0);
  assert.match(l.impedimentos[0], /mais de uma variação/);
  assert.match(l.impedimentos[0], /Preto · 34 BR/);
  assert.match(l.impedimentos[0], /Inclua a cor/);
});

test("o relaxamento não inventa empate quando não há dígito", () => {
  // "Preto" contra "Aveiã Soft" não pode casar por ausência de número.
  const l = lerColagem("Verde\t010399", COM_BR);
  assert.equal(l.atribuicoes.length, 0);
  assert.deepEqual(l.sobraram, ["Verde 010399"]);
  assert.deepEqual(l.impedimentos, []);
});

test("o EXATO continua ganhando do relaxado", () => {
  // Se "35 BR" está escrito por inteiro, ele casa por igualdade e nem chega no
  // caminho dos dígitos.
  const l = lerColagem("Preto 35 BR\t010400", COM_BR);
  assert.equal(l.atribuicoes.length, 1);
  assert.equal(l.atribuicoes[0].varianteId, "b2");
});

test("a frase DECLARA que o Zion não valida o código", () => {
  // 18/08/2026: dois códigos de EXEMPLO que eu inventei para o placeholder —
  // 010399 e 010400 — eram códigos reais de tênis Molekinha. A lojista copiou
  // o exemplo e gravou, e eles foram parar em duas variações de um chinelo
  // Modare. Nenhuma guarda deste módulo acusou, porque nenhuma pode: o Zion não
  // tem o cadastro do ERP.
  //
  // O que ele pode fazer é DIZER que não sabe.
  const l = lerColagem("Preto 34\t010399", VARIANTES);
  assert.match(fraseDaColagem(l), /Não consigo conferir se estes códigos existem no seu ERP/);
  assert.match(fraseDaColagem(l), /nem de qual produto são/);
});

test("o EXEMPLO da tela nunca parece um código de verdade", async () => {
  // A causa raiz. Um exemplo com cara de dado convida a gravá-lo — e foi
  // exatamente isso que aconteceu.
  const { readFileSync } = await import("node:fs");
  const tela = readFileSync(
    new URL("../../../app/cliente/codigos/page.tsx", import.meta.url),
    "utf8"
  );
  const i = tela.indexOf("placeholder=");
  assert.ok(i > 0, "o placeholder sumiu da tela");
  const trecho = tela.slice(i, i + 320);
  assert.ok(
    !/\d{4,}/.test(trecho),
    "o exemplo do campo voltou a conter um número com cara de código — " +
      "foi assim que 010399 e 010400, códigos reais de OUTROS produtos, " +
      "foram gravados em duas variações"
  );
});
