// O obrigatório que ninguém propôs também precisa chegar até ela.
//
// ===========================================================================
// O BURACO, MEDIDO EM 28/08/2026
// ===========================================================================
//
// `/cliente/atributos` mostrava só o que a IMPORTAÇÃO propôs. Um obrigatório
// que ninguém propôs — "Tipo de meias" numa meia, "Tipo de mochila" numa
// mochila — nunca aparecia. A publicação recusava, e o caminho até a resposta
// não existia: mesmo laço fechado de antes, um nível acima.
//
// São 9 produtos parados assim no catálogo do T1.
//
// E aqui não se deduz nada: o ML publica as opções que aceita, então a pergunta
// é de múltipla escolha e quem responde é ela.
//
// Rodar: npx tsx --test src/lib/services/aPerguntaQueOMlJaEscreveu.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { agruparPerguntas } from "./perguntasDaCategoria.ts";
import type { ExigenciaDaCategoria } from "../../modules/publication/domain/atributosDoMarketplace.ts";

/** As exigências reais de MLB108791 (meias), medidas no ML em 28/08. */
const MEIAS: ExigenciaDaCategoria[] = [
  { id: "BRAND", nome: "Marca", tipo: "string", valoresAceitos: [{ id: "1", nome: "Reserva" }] },
  { id: "MODEL", nome: "Modelo", tipo: "string" },
  {
    id: "SOCKS_TYPE",
    nome: "Tipo de meias",
    tipo: "list",
    valoresAceitos: [
      { id: "a", nome: "Térmicas" },
      { id: "b", nome: "Escolares" },
      { id: "c", nome: "Soquete" },
    ],
    dica: "Escolha o tipo",
  },
  {
    id: "LENGTH_TYPE",
    nome: "Tipo de comprimento",
    tipo: "list",
    valoresAceitos: [{ id: "d", nome: "Longo" }, { id: "e", nome: "Curtas" }],
  },
];

const entrada = (over: Partial<Parameters<typeof agruparPerguntas>[0]> = {}) => ({
  categoriaDo: new Map([["p1", "MLB108791"]]),
  nomeDo: new Map([["p1", "Meia Cano Curto Olympikus"]]),
  jaTem: new Set<string>(),
  exigencias: new Map([["MLB108791", MEIAS]]),
  ...over,
});

test("o obrigatório de LISTA vira pergunta, com as opções do ML", () => {
  const g = agruparPerguntas(entrada());
  assert.deepEqual(
    g.map((x) => x.atributo).sort(),
    ["Tipo de comprimento", "Tipo de meias"]
  );
  const meias = g.find((x) => x.atributo === "Tipo de meias");
  assert.equal(meias?.opcoes.length, 3);
  assert.equal(meias?.dica, "Escolha o tipo");
});

test("`string` NÃO vira pergunta fechada, mesmo trazendo valores", () => {
  // `BRAND` é `string` e vem com "opções" que são sugestão, não a lista inteira.
  // Oferecer "escolha entre estas" esconderia dela a marca que ela vende.
  const g = agruparPerguntas(entrada());
  assert.equal(g.some((x) => x.atributo === "Marca"), false);
});

test("`list` sem opções publicadas também não vira pergunta", () => {
  // Sem lista não há múltipla escolha — e inventar as opções seria o oposto do
  // motivo de esta tela existir.
  const semLista: ExigenciaDaCategoria[] = [{ id: "X", nome: "Coisa", tipo: "list" }];
  const g = agruparPerguntas(entrada({ exigencias: new Map([["MLB108791", semLista]]) }));
  assert.deepEqual(g, []);
});

test("O QUE JÁ TEM LINHA NÃO É PERGUNTADO — nem resposta, nem proposta", () => {
  // Medido: contando a proposta como ausência, o T1 daria 479 perguntas; a tela
  // pediria confirmação numa seção e resposta na outra, para a mesma coisa.
  // Contando como já perguntado, 110.
  const g = agruparPerguntas(entrada({ jaTem: new Set(["p1|tipo de meias"]) }));
  assert.deepEqual(g.map((x) => x.atributo), ["Tipo de comprimento"]);
});

test("o acento não decide se já foi perguntado", () => {
  const g = agruparPerguntas(entrada({ jaTem: new Set(["p1|tipo de comprimento"]) }));
  assert.deepEqual(g.map((x) => x.atributo), ["Tipo de meias"]);
});

test("agrupa por CATEGORIA e atributo — a mesma pergunta muda de opções", () => {
  // "Gênero" em MLB273770 tem 6 opções e em MLB108791 tem 7. Juntar os dois
  // grupos ofereceria a uma meia uma opção que a categoria dela não aceita.
  const outra: ExigenciaDaCategoria[] = [
    { id: "SOCKS_TYPE", nome: "Tipo de meias", tipo: "list", valoresAceitos: [{ id: "z", nome: "Outra" }] },
  ];
  const g = agruparPerguntas({
    categoriaDo: new Map([["p1", "MLB108791"], ["p2", "MLB999"]]),
    nomeDo: new Map([["p1", "Meia A"], ["p2", "Meia B"]]),
    jaTem: new Set(),
    exigencias: new Map([["MLB108791", MEIAS], ["MLB999", outra]]),
  });
  const meias = g.filter((x) => x.atributo === "Tipo de meias");
  assert.equal(meias.length, 2, "grupos de categorias diferentes foram fundidos");
  assert.deepEqual(meias.map((x) => x.opcoes.length).sort(), [1, 3]);
});

test("o maior grupo primeiro — é onde uma resposta resolve mais", () => {
  const g = agruparPerguntas({
    categoriaDo: new Map([["p1", "MLB108791"], ["p2", "MLB108791"]]),
    nomeDo: new Map([["p1", "Meia A"], ["p2", "Meia B"]]),
    jaTem: new Set(["p2|tipo de comprimento"]),
    exigencias: new Map([["MLB108791", MEIAS]]),
  });
  assert.equal(g[0].atributo, "Tipo de meias");
  assert.equal(g[0].produtos.length, 2);
});

test("produto sem nome cai no id — linha feia é melhor que linha muda", () => {
  const g = agruparPerguntas(entrada({ nomeDo: new Map() }));
  assert.equal(g[0].produtos[0].produto, "p1");
});
