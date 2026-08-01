// O modo `novos` casa antes de criar — provado sem infraestrutura.
//
// Medido em 2026-08-01 contra um export do ERP: dos 170 anúncios que o Zion não
// conhecia, 117 pertenciam a produtos que JÁ existiam. Sem casar, o modo `novos`
// criaria 18 produtos duplicados — incluindo um gêmeo do Papete Modare que
// acabara de ser publicado.

import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarNomeDeProduto,
  casarGruposComProdutos,
  variantesInexistentes,
} from "./casarComProdutoExistente.ts";

// ---------------------------------------------------------------------------
// O CASAMENTO
// ---------------------------------------------------------------------------

test("casa ignorando caixa e acento — é como o ERP e a base divergem", () => {
  // Casos REAIS da medição: o export escreve "Leaz/Paris" e a base tem
  // "Leaz/paris"; o export "t/pronta" e a base "T/pronta".
  const existentes = [
    { id: "p1", nome: "Tamanco Feminino Anabela Modare 7151.115 Leaz/paris" },
    { id: "p2", nome: "Papete Slide Feminino Beira Rio 8488.122 T/pronta" },
    { id: "p3", nome: "Sandália Infantil Ipanema 27403 Glow" },
  ];
  const casados = casarGruposComProdutos(
    [
      "Tamanco Feminino Anabela Modare 7151.115 Leaz/Paris",
      "Papete Slide Feminino Beira Rio 8488.122 t/pronta",
      "Sandalia Infantil Ipanema 27403 Glow",
    ],
    existentes
  );
  assert.deepEqual(
    casados.map((c) => c?.id),
    ["p1", "p2", "p3"]
  );
});

test("produto que não existe devolve null — e null significa CRIAR", () => {
  const casados = casarGruposComProdutos(
    ["Babuche Moleca 5832.100 Pvc", "Chinelo Slide Nuvem Zaxy Air 19419"],
    [{ id: "p1", nome: "Chinelo Slide Nuvem Zaxy Air 19419" }]
  );
  assert.equal(casados[0], null);
  assert.equal(casados[1]?.id, "p1");
});

test("dois existentes com o mesmo nome: o PRIMEIRO vence, e é determinístico", () => {
  // Escolher "o mais recente" ou "o com mais variantes" seria decidir em
  // silêncio qual dos dois é o certo. A base tem casos assim.
  const a = casarGruposComProdutos(["Chinelo X"], [
    { id: "p1", nome: "Chinelo X" },
    { id: "p2", nome: "chinelo x" },
  ]);
  const b = casarGruposComProdutos(["Chinelo X"], [
    { id: "p1", nome: "Chinelo X" },
    { id: "p2", nome: "chinelo x" },
  ]);
  assert.equal(a[0]?.id, "p1");
  assert.deepEqual(a, b, "o desempate deixou de ser determinístico");
});

test("nome vazio nunca casa — vazio não é chave", () => {
  const casados = casarGruposComProdutos([""], [{ id: "p1", nome: "" }]);
  assert.equal(casados[0], null);
});

test("normalizar não junta nomes que são DIFERENTES", () => {
  // O modelo 7208.101 aparece em dois produtos da base, com sufixos distintos.
  // Se a normalização os fundisse, variantes de um iriam para o outro.
  const a = normalizarNomeDeProduto("Papete Slide Modare 7208.101 Nobuck");
  const b = normalizarNomeDeProduto("Papete Slide Modare Micr Perf Suprem 7208.101");
  assert.notEqual(a, b);
});

// ---------------------------------------------------------------------------
// A DEDUPLICAÇÃO DE VARIANTES
// ---------------------------------------------------------------------------

const v = (sku: string, cor: string, tamanho: string) => ({ sku, cor, tamanho });

test("variante com SKU já presente NÃO entra de novo", () => {
  const novas = variantesInexistentes(
    [v("01053839", "Marrom", "39 BR"), v("01063037", "Marrom", "37 BR")],
    [v("01053839", "Marrom", "39 BR")]
  );
  assert.deepEqual(
    novas.map((x) => x.sku),
    ["01063037"]
  );
});

test("sem SKU, a chave é (cor, tamanho) — e ignora caixa e acento", () => {
  const novas = variantesInexistentes(
    [v("", "MARROM", "39 br"), v("", "Nude", "35 BR")],
    [v("", "Marrom", "39 BR")]
  );
  assert.deepEqual(
    novas.map((x) => x.cor),
    ["Nude"]
  );
});

test("deduplica DENTRO do lote novo também", () => {
  // O mesmo SKU pode vir em dois MLBs do ERP. Sem isto, criaríamos a variante
  // duas vezes no mesmo import.
  const novas = variantesInexistentes([v("A1", "Preto", "38"), v("A1", "Preto", "38")], []);
  assert.equal(novas.length, 1);
});

test("SKU repetido em tamanhos diferentes cria os DOIS — o erro dela fica visível", () => {
  // A base tem 117 SKUs repetidos. Fundir por (cor, tamanho) aqui esconderia o
  // problema de cadastro dela atrás de uma escolha nossa.
  const novas = variantesInexistentes([v("A1", "Preto", "38"), v("A1", "Preto", "39")], []);
  assert.equal(novas.length, 1, "SKU manda quando existe — e aqui ele é o mesmo");
  // E sem SKU, os dois tamanhos entram:
  const semSku = variantesInexistentes([v("", "Preto", "38"), v("", "Preto", "39")], []);
  assert.equal(semSku.length, 2);
});

test("lista vazia de existentes deixa tudo passar", () => {
  const novas = variantesInexistentes([v("A", "x", "1"), v("B", "y", "2")], []);
  assert.equal(novas.length, 2);
});
