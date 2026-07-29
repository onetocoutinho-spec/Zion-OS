// Testes da consulta de peso em linguagem natural.
//
// Os números vêm da base real do primeiro lojista, medidos no EXP-004/005:
// 19 produtos com peso faltando, sendo 2 parciais (Havaianas 9/18, Vizzano
// 3/39) e 3 sem grade nenhuma.
// Rodar: npx tsx --test src/modules/catalog/domain/consultaDePeso.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  resolverConsulta,
  type CriterioDePeso,
  type ProdutoConsultavel,
} from "./consultaDePeso.ts";

const MARCAS = ["Actvitta", "Havaianas", "Modare", "Moleca", "Molekinha", "Vizzano"];

/** Recorte fiel da base: completos, ausência total, parcial e sem grade. */
const BASE: ProdutoConsultavel[] = [
  { id: "hav-1", marca: "Havaianas", quantidadeVariantes: 28, variacoesSemPeso: 28 },
  { id: "hav-2", marca: "Havaianas", quantidadeVariantes: 18, variacoesSemPeso: 9 }, // parcial
  { id: "hav-3", marca: "Havaianas", quantidadeVariantes: 19, variacoesSemPeso: 0 },
  { id: "viz-1", marca: "Vizzano", quantidadeVariantes: 39, variacoesSemPeso: 3 }, // parcial
  { id: "viz-2", marca: "Vizzano", quantidadeVariantes: 0, variacoesSemPeso: 0 }, // sem grade
  { id: "mol-1", marca: "Molekinha", quantidadeVariantes: 16, variacoesSemPeso: 0 },
];

function criterio(o: Partial<CriterioDePeso> = {}): CriterioDePeso {
  const base = {
    entendeu: true,
    perguntar: "",
    marca: "",
    estadoDePeso: "faltando",
    termosDoProduto: [],
    interpretacao: "",
  } satisfies CriterioDePeso;
  return { ...base, ...o } as CriterioDePeso;
}

test("marca + estado resolvem sozinhos, sem o modelo tocar em dado", () => {
  const r = resolverConsulta(criterio({ marca: "Havaianas" }), BASE, MARCAS);
  assert.equal(r.desfecho, "encontrado");
  assert.deepEqual(r.produtoIds, ["hav-1", "hav-2"]);
  assert.match(r.mensagem, /2 produto\(s\) · 37 variação\(ões\) sem peso/);
});

test("o PARCIAL entra — é o defeito do INC-001 do outro lado", () => {
  // hav-2 tem 9 de 18 e viz-1 tem 3 de 39. Pelo máximo, os dois "têm peso".
  const r = resolverConsulta(criterio(), BASE, MARCAS);
  assert.ok(r.produtoIds.includes("hav-2"));
  assert.ok(r.produtoIds.includes("viz-1"));
});

test("SEM GRADE nunca aparece como peso faltando", () => {
  // Produto sem variação não tem onde guardar peso; cobrá-lo seria pendência
  // que ninguém resolve nesta tela.
  const r = resolverConsulta(criterio(), BASE, MARCAS);
  assert.equal(r.produtoIds.includes("viz-2"), false);
});

test("termo de tipo NÃO filtra, e é declarado", () => {
  // "chinelo" só existe no nome, onde convive com "tamanco" e "rasteira" no
  // mesmo produto. Filtrar por ele seria inferência virando dado.
  const semTermo = resolverConsulta(criterio({ marca: "Havaianas" }), BASE, MARCAS);
  const comTermo = resolverConsulta(
    criterio({ marca: "Havaianas", termosDoProduto: ["chinelo"] }),
    BASE,
    MARCAS
  );
  assert.deepEqual(comTermo.produtoIds, semTermo.produtoIds);
  assert.equal(comTermo.desfecho, "com_fronteira");
  assert.deepEqual(comTermo.fronteira, ["chinelo"]);
  assert.match(comTermo.mensagem, /não classifica esse termo/);
});

test("a mensagem NÃO afirma inexistência a partir de busca textual", () => {
  const r = resolverConsulta(
    criterio({ marca: "Havaianas", termosDoProduto: ["chinelo"] }),
    BASE,
    MARCAS
  );
  assert.doesNotMatch(r.mensagem, /não exist|nao exist|inexist|nenhum chinelo/i);
});

test("substantivo genérico não vira fronteira", () => {
  // O modelo extrai amplamente de propósito; a precisão é daqui. Pedir a ele
  // que excluísse o genérico fez perder "chinelo" e "tênis" junto (EXP-004 R2).
  for (const g of ["produto", "produtos", "Itens", "coisas"]) {
    const r = resolverConsulta(criterio({ termosDoProduto: [g] }), BASE, MARCAS);
    assert.equal(r.desfecho, "encontrado", `"${g}" não deveria virar fronteira`);
    assert.deepEqual(r.fronteira, []);
  }
});

test("conjunto vazio é FATO, não ambiguidade — e precede a fronteira", () => {
  const r = resolverConsulta(
    criterio({ marca: "Molekinha", termosDoProduto: ["chinelo"] }),
    BASE,
    MARCAS
  );
  assert.equal(r.desfecho, "vazio");
  assert.deepEqual(r.fronteira, [], "sem conjunto não há candidato a declarar");
  assert.doesNotMatch(r.mensagem, /chinelo/);
});

test("marca fora da enumeração é critério inválido, nunca aproximação", () => {
  const r = resolverConsulta(criterio({ marca: "Olympikus" }), BASE, MARCAS);
  assert.equal(r.desfecho, "invalido");
  assert.deepEqual(r.produtoIds, []);
  assert.match(r.mensagem, /Olympikus/);
});

test("frase não compreendida devolve a pergunta do modelo", () => {
  const r = resolverConsulta(
    criterio({ entendeu: false, perguntar: "Você quis dizer peso ou preço?" }),
    BASE,
    MARCAS
  );
  assert.equal(r.desfecho, "invalido");
  assert.equal(r.mensagem, "Você quis dizer peso ou preço?");
});

test("estado 'completo' exige grade — sem grade não é completo", () => {
  const r = resolverConsulta(criterio({ estadoDePeso: "completo" }), BASE, MARCAS);
  assert.deepEqual(r.produtoIds, ["hav-3", "mol-1"]);
  assert.equal(r.produtoIds.includes("viz-2"), false);
});

test("sem estado mencionado, não filtra por peso", () => {
  const r = resolverConsulta(
    criterio({ marca: "Vizzano", estadoDePeso: "nao_mencionado" }),
    BASE,
    MARCAS
  );
  assert.deepEqual(r.produtoIds, ["viz-1", "viz-2"]);
});

test("marca repetida em termosDoProduto NÃO vira fronteira falsa", () => {
  // Medido na tela: para "Quais Havaianas estão sem peso?" o modelo devolveu
  // marca="Havaianas" E termosDoProduto=["Havaiana"]. A mensagem anunciava que
  // o catálogo não classifica "Havaiana" — sobre um eixo que ele conhece.
  // Fronteira falsa ensina a ignorar o aviso, e o aviso é o que separa o que o
  // Zion prova do que não sabe.
  for (const termo of ["Havaiana", "Havaianas", "havaianas"]) {
    const r = resolverConsulta(
      criterio({ marca: "Havaianas", termosDoProduto: [termo] }),
      BASE,
      MARCAS
    );
    assert.equal(r.desfecho, "encontrado", `"${termo}" virou fronteira`);
    assert.deepEqual(r.fronteira, []);
  }
});

test("o eixo PESO repetido em termos também não vira fronteira", () => {
  const r = resolverConsulta(criterio({ termosDoProduto: ["peso"] }), BASE, MARCAS);
  assert.deepEqual(r.fronteira, []);
});

test("mas um tipo real continua sendo fronteira, mesmo com marca junto", () => {
  const r = resolverConsulta(
    criterio({ marca: "Havaianas", termosDoProduto: ["Havaianas", "chinelo"] }),
    BASE,
    MARCAS
  );
  assert.deepEqual(r.fronteira, ["chinelo"]);
  assert.equal(r.desfecho, "com_fronteira");
});
