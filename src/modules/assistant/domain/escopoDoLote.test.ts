import test from "node:test";
import assert from "node:assert/strict";

import {
  candidatosDoCatalogo,
  escopoAindaVale,
  montarEscopo,
  type CandidatoAoLote,
} from "./escopoDoLote";
import type { ProdutoAlvo } from "./propostaDeCorrecao";

const g = (v: number) => `${v} g`;
const reais = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

const candidato = (m: Partial<CandidatoAoLote> & { id: string }): CandidatoAoLote => ({
  nome: `Produto ${m.id}`,
  unidades: 4,
  unidadesSemDado: 4,
  valorAtual: null,
  ...m,
});

test("o lote inclui só quem está SEM o dado", () => {
  const escopo = montarEscopo(
    "peso",
    [
      candidato({ id: "a", unidades: 4, unidadesSemDado: 4 }),
      candidato({ id: "b", unidades: 3, unidadesSemDado: 0 }),
      candidato({ id: "c", unidades: 5, unidadesSemDado: 5 }),
    ],
    420,
    g
  );
  assert.deepEqual(
    escopo.incluidos.map((c) => c.id),
    ["a", "c"]
  );
  assert.deepEqual(
    escopo.jaTemDado.map((c) => c.id),
    ["b"]
  );
});

test("quem JÁ TEM o dado não é tocado — e é CONTADO na frase", () => {
  // Sobrescrever em massa apaga trabalho anterior, que costuma ser mais
  // confiável que a generalização de agora. E esconder isso faria a pessoa
  // aprovar achando que resolveu tudo.
  const escopo = montarEscopo(
    "peso",
    [
      candidato({ id: "a", unidadesSemDado: 4 }),
      candidato({ id: "b", unidadesSemDado: 0 }),
      candidato({ id: "c", unidadesSemDado: 0 }),
    ],
    420,
    g
  );
  assert.equal(escopo.jaTemDado.length, 2);
  assert.match(escopo.resumo, /2 produtos já têm peso e não serão alterados/);
});

test("a frase conta VARIAÇÕES no peso, não produtos", () => {
  // "47 variantes" é o que o lojista aprova; "12 produtos" esconde o tamanho
  // real do que vai ser tocado.
  const escopo = montarEscopo(
    "peso",
    [
      candidato({ id: "a", unidades: 39, unidadesSemDado: 39 }),
      candidato({ id: "b", unidades: 8, unidadesSemDado: 8 }),
    ],
    420,
    g
  );
  assert.equal(escopo.unidadesAfetadas, 47);
  assert.match(escopo.resumo, /47 variações de 2 produtos/);
});

test("custo conta PRODUTOS — ele vive no pai, não na variação", () => {
  const escopo = montarEscopo(
    "custo",
    [candidato({ id: "a", unidades: 39, valorAtual: null }), candidato({ id: "b", valorAtual: null })],
    38.7,
    reais
  );
  assert.equal(escopo.unidadesAfetadas, 2);
  assert.match(escopo.resumo, /2 produtos/);
  assert.doesNotMatch(escopo.resumo, /variaç/);
});

test("custo já preenchido fica de fora", () => {
  const escopo = montarEscopo(
    "custo",
    [candidato({ id: "a", valorAtual: 17.16 }), candidato({ id: "b", valorAtual: null })],
    38.7,
    reais
  );
  assert.deepEqual(escopo.incluidos.map((c) => c.id), ["b"]);
});

test("ninguém precisando: o lote diz isso em vez de propor nada", () => {
  const escopo = montarEscopo("peso", [candidato({ id: "a", unidadesSemDado: 0 })], 420, g);
  assert.equal(escopo.incluidos.length, 0);
  assert.match(escopo.resumo, /Não há o que aplicar/);
});

test("ESCOPO CONGELADO: quem entrou depois NÃO é incluído", () => {
  // O caso da spec: a proposta diz 47, na execução aparecem 48. A 48ª não foi
  // mostrada, não foi lida e não foi aprovada.
  const aprovados = ["a", "b", "c"];
  const aindaPrecisam = ["a", "b", "c", "d"]; // "d" surgiu depois
  const r = escopoAindaVale(aprovados, aindaPrecisam);
  assert.equal(r.vale, true);
  assert.deepEqual(r.restantes, ["a", "b", "c"]);
  assert.equal(r.restantes.includes("d"), false);
});

test("alvo que saiu do escopo invalida — alguém preencheu no meio-tempo", () => {
  const r = escopoAindaVale(["a", "b", "c"], ["a", "c"]);
  assert.equal(r.vale, false);
  assert.deepEqual(r.saíram, ["b"]);
});

test("troca de alvo é detectada, mesmo com a CONTAGEM igual", () => {
  // 3 e 3 pode ser um trocado por outro. Comparar contagem em vez de conjunto
  // deixaria passar exatamente o caso que mais importa.
  const r = escopoAindaVale(["a", "b", "c"], ["a", "b", "z"]);
  assert.equal(r.vale, false);
  assert.deepEqual(r.saíram, ["c"]);
});

test("escopo intacto continua valendo", () => {
  const r = escopoAindaVale(["a", "b"], ["a", "b"]);
  assert.equal(r.vale, true);
  assert.deepEqual(r.saíram, []);
});

test("candidatosDoCatalogo pega SÓ os ids pedidos", () => {
  const catalogo: ProdutoAlvo[] = [
    { id: "a", nome: "A", marca: "M", custo: 0, quantidadeVariantes: 4, variacoesSemPeso: 4 },
    { id: "b", nome: "B", marca: "M", custo: 17.16, quantidadeVariantes: 2, variacoesSemPeso: 0 },
    { id: "c", nome: "C", marca: "X", custo: 0, quantidadeVariantes: 1, variacoesSemPeso: 1 },
  ];
  const cands = candidatosDoCatalogo(catalogo, ["a", "b"]);
  assert.deepEqual(cands.map((c) => c.id), ["a", "b"]);
  assert.equal(cands[1].valorAtual, 17.16);
  // Um id que não existe no catálogo simplesmente não vira candidato — o
  // modelo pode alucinar ids, e alucinação não pode virar alvo.
  assert.equal(candidatosDoCatalogo(catalogo, ["zzz"]).length, 0);
});

test("o lote NÃO decide pertencimento por semelhança de nome", () => {
  // Recebe candidatos já resolvidos. Julgar "é da mesma família" pelo nome é a
  // inferência que vira identidade errada — e identidade errada em lote é o
  // pior estrago possível.
  const catalogo: ProdutoAlvo[] = [
    { id: "a", nome: "Havaianas Top", marca: "H", custo: 0, quantidadeVariantes: 2, variacoesSemPeso: 2 },
    { id: "b", nome: "Havaianas Top Max", marca: "H", custo: 0, quantidadeVariantes: 2, variacoesSemPeso: 2 },
  ];
  // Só "a" foi pedido: "b" não entra por parecer.
  assert.deepEqual(candidatosDoCatalogo(catalogo, ["a"]).map((c) => c.id), ["a"]);
});
