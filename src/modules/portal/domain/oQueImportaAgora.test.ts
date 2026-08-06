// A abertura da tela "Hoje": a frase e o teto.

import test from "node:test";
import assert from "node:assert/strict";
import { aberturaDoHoje, QUANTAS_APARECEM } from "./oQueImportaAgora.ts";
import type { Lacuna } from "../../publication/domain/prontidaoDaLoja.ts";

const lacuna = (tipo: string, titulo: string, bloqueiaTudo = false): Lacuna =>
  ({
    tipo,
    titulo,
    trava: "o que isto impede",
    quantos: 1,
    href: "/cliente/produtos",
    cta: "Resolver",
    bloqueiaTudo,
  }) as Lacuna;

// ---------------------------------------------------------------------------
// A FRASE — que é a tela
// ---------------------------------------------------------------------------

test("sem nada travado, a tela diz isso e não inventa tarefa", () => {
  const a = aberturaDoHoje([]);
  assert.equal(a.emDia, true);
  assert.match(a.frase, /em dia/i);
  assert.deepEqual(a.visiveis, []);
});

test("a frase nomeia a CONSEQUÊNCIA, não a contagem da nossa lista", () => {
  // "3 pontos a resolver" é um número sobre NÓS. "3 coisas estão travando sua
  // loja" é um fato sobre a loja dela — e é o que faz alguém agir.
  const a = aberturaDoHoje([lacuna("sem_custo", "A"), lacuna("sem_peso", "B"), lacuna("sem_foto", "C")]);
  assert.match(a.frase, /travando sua loja/);
  assert.ok(!/ponto|resolver|pendência/i.test(a.frase), `frase burocrática: "${a.frase}"`);
});

test("o singular concorda", () => {
  // Detalhe pequeno e visível: "1 coisas estão" faz a tela parecer descuidada,
  // e descuido na primeira frase contamina a confiança no resto.
  assert.match(aberturaDoHoje([lacuna("sem_custo", "A")]).frase, /1 coisa está travando/);
  assert.match(aberturaDoHoje([lacuna("a", "A"), lacuna("b", "B")]).frase, /2 coisas estão travando/);
});

// ---------------------------------------------------------------------------
// A PAREDE — quando algo bloqueia TUDO
// ---------------------------------------------------------------------------

test("parede vira a frase inteira, e nada mais aparece", () => {
  // Somar "e mais duas" a uma parede convida a escolher a menor — e a menor não
  // destrava nada enquanto a parede estiver de pé.
  const a = aberturaDoHoje([
    lacuna("sem_produtos", "Sua base está vazia", true),
    lacuna("sem_custo", "Faltam custos"),
    lacuna("sem_peso", "Faltam pesos"),
  ]);
  assert.equal(a.frase, "Sua base está vazia");
  assert.equal(a.visiveis.length, 1);
  assert.equal(a.restantes, 0, "com uma parede, não se anuncia o resto");
});

test("a parede vence mesmo quando não é a primeira da lista", () => {
  const a = aberturaDoHoje([lacuna("sem_custo", "Faltam custos"), lacuna("sem_conexao", "Sem conexão", true)]);
  assert.equal(a.frase, "Sem conexão");
});

// ---------------------------------------------------------------------------
// O TETO — trocar 8 números por 8 lacunas seria a mesma tela
// ---------------------------------------------------------------------------

test("aparecem três, e o resto é contado em vez de sumir", () => {
  const cinco = ["a", "b", "c", "d", "e"].map((t) => lacuna(t, t.toUpperCase()));
  const a = aberturaDoHoje(cinco);
  assert.equal(a.visiveis.length, QUANTAS_APARECEM);
  assert.equal(a.restantes, 2, "esconder a contagem seria mentir por omissão");
  assert.deepEqual(a.visiveis.map((l) => l.titulo), ["A", "B", "C"]);
});

test("cabendo todas, não há resto anunciado", () => {
  const a = aberturaDoHoje([lacuna("a", "A"), lacuna("b", "B")]);
  assert.equal(a.restantes, 0);
  assert.equal(a.visiveis.length, 2);
});

test("o teto é TRÊS — e o motivo está no número que ele substitui", () => {
  // A tela mostrava oito cartões. O defeito não era o conteúdo, era a
  // quantidade: oito números iguais são a decisão adiada oito vezes. Um teto
  // de oito aqui reproduziria a tela antiga com outro nome.
  assert.equal(QUANTAS_APARECEM, 3);
  assert.ok(QUANTAS_APARECEM < 8, "o teto voltou a ser o tamanho do problema");
});

test("a ordem de `lacunasDaLoja` é preservada — nós não reordenamos", () => {
  // Ela ordena "por quanto destrava, não por quantidade", e essa decisão é
  // dela. Reordenar aqui duplicaria o julgamento em dois lugares.
  const entrada = [lacuna("z", "Z"), lacuna("a", "A"), lacuna("m", "M")];
  assert.deepEqual(aberturaDoHoje(entrada).visiveis.map((l) => l.titulo), ["Z", "A", "M"]);
});
