import test from "node:test";
import assert from "node:assert/strict";
import {
  corDoTitulo,
  ensaiarTrocaDeCapa,
  nenhumaFotoSumiu,
} from "./ensaioDaCapa.ts";

// As sete cores REAIS do Chinelo Havaianas Top Liso, lidas do banco em
// 13/08/2026. `Azul` e `Azul-marinho` juntas não são um caso inventado para o
// teste: são o catálogo dela, e é por isso que este módulo existe.
const CORES = ["Branco", "Amarelo", "Azul-marinho", "Azul", "Vermelho", "Preto", "Cinza"];

test("a cor mais LONGA vence — `Azul-marinho` não é `Azul`", () => {
  // O erro que este teste impede: `includes("Azul")` casa com o título
  // azul-marinho, e a foto azul vai para o anúncio errado. O ML chama isso de
  // "o anúncio não corresponde ao produto" — a categoria que PAUSA.
  //
  // A LISTA VEM COM A CURTA PRIMEIRO, de propósito. Escrito com `CORES` na
  // ordem do banco, este teste PASSOU sobre a implementação ingênua: ela
  // devolvia o primeiro que casasse, e `Azul-marinho` vem antes de `Azul` ali
  // por acaso. Um teste que acerta por sorte da ordenação não guarda nada.
  const curtaPrimeiro = ["Azul", "Azul-marinho", "Amarelo"];
  assert.equal(
    corDoTitulo("Chinelo Havaianas Top Liso Azul-marinho 35 - 36", curtaPrimeiro),
    "Azul-marinho"
  );
  assert.equal(
    corDoTitulo("Chinelo Havaianas Top Liso Azul 35 - 36", curtaPrimeiro),
    "Azul"
  );
  // E também na ordem real do catálogo, que é a que roda em produção.
  assert.equal(
    corDoTitulo("Chinelo Havaianas Top Liso Azul-marinho 35 - 36", CORES),
    "Azul-marinho"
  );
});

test("casa por palavra inteira — `Azul` não casa dentro de `Azulado`", () => {
  assert.equal(corDoTitulo("Chinelo Azulado Bonito 35", CORES), null);
});

test("acento e caixa não separam", () => {
  assert.equal(corDoTitulo("CHINELO PRETO 39 - 40", CORES), "Preto");
});

test("título sem cor conhecida devolve null, não um palpite", () => {
  assert.equal(corDoTitulo("Chinelo Havaianas Top Liso 35 - 36", CORES), null);
});

test("duas cores de mesmo tamanho no título: recusa", () => {
  // Não dá para saber de qual é a foto. Escolher uma seria apostar com a conta
  // dela — e o custo do erro é anúncio pausado.
  assert.equal(corDoTitulo("Sandália Preto Verde 35", ["Preto", "Verde"]), null);
});

// ---------------------------------------------------------------------------
// O ensaio
// ---------------------------------------------------------------------------

const NOVA = "NOVA-1200";

test("a nova entra na frente e NENHUMA antiga some", () => {
  // `definirFotosDoItem` SUBSTITUI o conjunto no ML: lista incompleta apaga
  // foto da lojista. É o dano mais caro deste caminho inteiro.
  const e = ensaiarTrocaDeCapa(
    [{ mlb: "MLB1", titulo: "Chinelo Top Liso Amarelo 35 - 36", fotos: ["A", "B", "C"] }],
    CORES,
    "Amarelo",
    NOVA
  );
  assert.equal(e.alvos.length, 1);
  assert.deepEqual(e.alvos[0].novaOrdem, [NOVA, "A", "B", "C"]);
  assert.equal(e.alvos[0].fotosHoje, 3);
  assert.ok(nenhumaFotoSumiu(["A", "B", "C"], e.alvos[0].novaOrdem));
});

test("anúncio de OUTRA cor não entra no ensaio", () => {
  const e = ensaiarTrocaDeCapa(
    [{ mlb: "MLB1", titulo: "Chinelo Top Liso Azul-marinho 35 - 36", fotos: ["A"] }],
    CORES,
    "Amarelo",
    NOVA
  );
  assert.equal(e.alvos.length, 0);
  assert.equal(e.fora.length, 0, "outra cor não é 'fora' — simplesmente não é alvo");
});

test("foto já duplicada no anúncio não vai duas vezes", () => {
  // Mandar o mesmo id duas vezes é payload malformado; o ML já recusou assim.
  const e = ensaiarTrocaDeCapa(
    [{ mlb: "MLB1", titulo: "Top Liso Amarelo 35 - 36", fotos: ["A", NOVA, "B"] }],
    CORES,
    "Amarelo",
    NOVA
  );
  assert.deepEqual(e.alvos[0].novaOrdem, [NOVA, "A", "B"]);
});

test("quem JÁ tem essa capa fica de fora, com o motivo", () => {
  const e = ensaiarTrocaDeCapa(
    [{ mlb: "MLB1", titulo: "Top Liso Amarelo 35 - 36", fotos: [NOVA, "A"] }],
    CORES,
    "Amarelo",
    NOVA
  );
  assert.equal(e.alvos.length, 0);
  assert.equal(e.fora[0].motivo, "ja-e-a-capa");
});

test("anúncio sem fotos lidas fica de fora — enviar apagaria as que existem lá", () => {
  const e = ensaiarTrocaDeCapa(
    [{ mlb: "MLB1", titulo: "Top Liso Amarelo 35 - 36", fotos: [] }],
    CORES,
    "Amarelo",
    NOVA
  );
  assert.equal(e.alvos.length, 0);
  assert.equal(e.fora[0].motivo, "sem-fotos-lidas");
});

test("título ambíguo entra em `fora` com o motivo certo", () => {
  // A lojista precisa distinguir: sem cor nenhuma é outro problema (talvez nem
  // seja da grade); com duas, ela resolve renomeando o anúncio.
  const e = ensaiarTrocaDeCapa(
    [
      { mlb: "MLB1", titulo: "Top Liso 35 - 36", fotos: ["A"] },
      { mlb: "MLB2", titulo: "Top Liso Preto Verde 35", fotos: ["A"] },
    ],
    ["Preto", "Verde", "Amarelo"],
    "Amarelo",
    NOVA
  );
  assert.equal(e.alvos.length, 0);
  assert.deepEqual(
    e.fora.map((f) => f.motivo).sort(),
    ["cor-nao-aparece-no-titulo", "titulo-cita-mais-de-uma-cor"]
  );
});

test("a conferência pega foto sumida", () => {
  assert.equal(nenhumaFotoSumiu(["A", "B"], [NOVA, "A"]), false);
  assert.equal(nenhumaFotoSumiu(["A", "B"], [NOVA, "A", "B"]), true);
});
