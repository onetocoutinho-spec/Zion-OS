// As pendências da conta — e por que a ORDEM é o produto.
//
// Em 02/08/2026 a leitura completa produziu "535 capas fora do padrão" numa
// faixa de uma linha que some quando a tela recarrega. Número agregado, sem
// ordem, sem link, sem dizer por onde começar.
//
// 535 fotos é trabalho de semanas. Os vinte que concentram estoque são trabalho
// de uma tarde. Sem a ordem, ela não começa.

import test from "node:test";
import assert from "node:assert/strict";
import { pendenciasDaConta } from "./pendenciasDaConta.ts";

const an = (mlb: string, p: Record<string, unknown> = {}) => ({
  mlb,
  titulo: `Anúncio ${mlb}`,
  permalink: `https://x/${mlb}`,
  status: "active",
  estoque: 0,
  ...p,
});

// ---------------------------------------------------------------------------
// A ORDEM
// ---------------------------------------------------------------------------

test("bloqueio vem primeiro, mesmo com estoque zero", () => {
  // É o único que pode custar a CONTA, não o anúncio.
  const r = pendenciasDaConta([
    an("MUITO_ESTOQUE", { estoque: 900, fotoCapaMaxSize: "165x93" }),
    an("BLOQUEADO", { estoque: 0, subStatus: ["forbidden"] }),
  ]);
  assert.equal(r.itens[0].mlb, "BLOQUEADO");
  assert.equal(r.itens[0].gravidade, "conta");
});

test("dentro da mesma gravidade, MAIOR ESTOQUE primeiro — é onde o dinheiro para", () => {
  const r = pendenciasDaConta([
    an("POUCO", { estoque: 3, fotoCapaMaxSize: "165x93" }),
    an("MUITO", { estoque: 300, fotoCapaMaxSize: "165x93" }),
    an("MEDIO", { estoque: 40, fotoCapaMaxSize: "165x93" }),
  ]);
  assert.deepEqual(
    r.itens.map((p) => p.mlb),
    ["MUITO", "MEDIO", "POUCO"]
  );
});

test("empate de estoque desempata pelo MLB — duas execuções, mesma lista", () => {
  const um = pendenciasDaConta([
    an("MLB2", { estoque: 10, fotoCapaMaxSize: "800x800" }),
    an("MLB1", { estoque: 10, fotoCapaMaxSize: "800x800" }),
  ]);
  const dois = pendenciasDaConta([
    an("MLB1", { estoque: 10, fotoCapaMaxSize: "800x800" }),
    an("MLB2", { estoque: 10, fotoCapaMaxSize: "800x800" }),
  ]);
  assert.deepEqual(um.itens.map((p) => p.mlb), dois.itens.map((p) => p.mlb));
  assert.deepEqual(um.itens.map((p) => p.mlb), ["MLB1", "MLB2"]);
});

test("receita vem antes de atenção", () => {
  const r = pendenciasDaConta([
    an("REVISAO", { estoque: 500, subStatus: ["waiting_for_patch"] }),
    an("CAPA", { estoque: 1, fotoCapaMaxSize: "165x93" }),
  ]);
  assert.equal(r.itens[0].mlb, "CAPA", "estoque alto não promove atenção acima de receita");
});

// ---------------------------------------------------------------------------
// O QUE NÃO ENTRA
// ---------------------------------------------------------------------------

test("capa ruim de anúncio FORA do ar não vira tarefa", () => {
  // Mandar refotografar um anúncio pausado é trabalho jogado fora enquanto ele
  // não voltar.
  const r = pendenciasDaConta([an("PAUSADO", { status: "paused", fotoCapaMaxSize: "165x93" })]);
  assert.equal(r.itens.filter((p) => p.tipo === "capa").length, 0);
});

test("capa DENTRO do padrão não vira tarefa", () => {
  const r = pendenciasDaConta([an("BOA", { fotoCapaMaxSize: "1200x1200" })]);
  assert.deepEqual(r.itens, []);
});

test("capa sem tamanho informado NÃO é acusada", () => {
  // Acusar a foto de alguém com base em campo ausente é inventar defeito.
  const r = pendenciasDaConta([an("SEM_TAMANHO"), an("VAZIO", { fotoCapaMaxSize: "" })]);
  assert.equal(r.itens.filter((p) => p.tipo === "capa").length, 0);
});

test("bloqueado NÃO acumula outras pendências — bloqueio manda", () => {
  const r = pendenciasDaConta([
    an("B", { subStatus: ["forbidden", "out_of_stock"], fotoCapaMaxSize: "165x93" }),
  ]);
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].tipo, "bloqueado");
});

test("anúncio no ar e sem sub_status não vira 'sem motivo'", () => {
  // "Sem motivo" só faz sentido para quem NÃO está no ar.
  const r = pendenciasDaConta([an("OK", { status: "active", fotoCapaMaxSize: "1200x1200" })]);
  assert.deepEqual(r.itens, []);
});

// ---------------------------------------------------------------------------
// O RECORTE NÃO MENTE
// ---------------------------------------------------------------------------

test("a lista é recortada; os TOTAIS não", () => {
  // Mostrar 20 de 535 é útil. Dizer que são 20 seria mentira.
  const muitos = Array.from({ length: 40 }, (_, i) =>
    an(`MLB${i}`, { estoque: i, fotoCapaMaxSize: "165x93" })
  );
  const r = pendenciasDaConta(muitos, 10);
  assert.equal(r.itens.length, 10);
  assert.deepEqual(r.totais, [{ tipo: "capa", quantas: 40 }]);
});

test("o limite é POR TIPO — um tipo grande não engole os outros", () => {
  const itens = [
    ...Array.from({ length: 30 }, (_, i) => an(`CAPA${i}`, { fotoCapaMaxSize: "165x93" })),
    an("BLOQ", { subStatus: ["forbidden"] }),
  ];
  const r = pendenciasDaConta(itens, 5);
  assert.equal(r.itens.filter((p) => p.tipo === "capa").length, 5);
  assert.equal(r.itens.filter((p) => p.tipo === "bloqueado").length, 1);
});

test("o estoque travado soma só as de RECEITA", () => {
  const r = pendenciasDaConta([
    an("CAPA", { estoque: 100, fotoCapaMaxSize: "165x93" }),
    an("REVISAO", { estoque: 900, subStatus: ["waiting_for_patch"] }),
  ]);
  assert.equal(r.estoqueTravado, 100, "atenção não é dinheiro parado por nossa conta");
});

// ---------------------------------------------------------------------------
// O TEXTO É PARA ELA
// ---------------------------------------------------------------------------

test("nenhuma linha usa o jargão do ML", () => {
  const r = pendenciasDaConta([
    an("A", { subStatus: ["forbidden"] }),
    an("B", { subStatus: ["out_of_stock"] }),
    an("C", { subStatus: ["waiting_for_patch"] }),
    an("D", { estoque: 1, fotoCapaMaxSize: "165x93" }),
  ]);
  for (const p of r.itens) {
    const texto = `${p.oQueFazer} ${p.porque}`;
    for (const jargao of ["forbidden", "out_of_stock", "waiting_for_patch", "sub_status"]) {
      assert.doesNotMatch(texto, new RegExp(jargao), `"${jargao}" vazou para a tela em ${p.mlb}`);
    }
  }
});

test("toda linha leva o link do anúncio — sem ele, não há o que fazer", () => {
  const r = pendenciasDaConta([
    an("A", { subStatus: ["forbidden"] }),
    an("B", { estoque: 1, fotoCapaMaxSize: "165x93" }),
  ]);
  assert.equal(r.itens.length, 2);
  for (const p of r.itens) assert.match(p.permalink, /^https:\/\//);
});

test("a capa diz o tamanho QUE TEM e o que o ML pede", () => {
  const r = pendenciasDaConta([an("A", { estoque: 1, fotoCapaMaxSize: "165x93" })]);
  assert.match(r.itens[0].porque, /165x93/);
  assert.match(r.itens[0].oQueFazer, /1200/);
});

test("conta limpa não produz pendência nenhuma", () => {
  const r = pendenciasDaConta([]);
  assert.deepEqual(r.itens, []);
  assert.deepEqual(r.totais, []);
  assert.equal(r.estoqueTravado, 0);
});

test("anúncio incompleto vindo do JSON não derruba a lista", () => {
  // 02/08/2026: quebrou com "Cannot read properties of undefined (reading
  // 'localeCompare')" porque um anúncio veio sem `mlb`. O tipo dizia `string`,
  // e o tipo não é um contrato com quem está do outro lado do fio — mesma lição
  // do `family_id` que veio como número.
  const torto = [
    { subStatus: ["forbidden"] },
    { mlb: "MLB1", subStatus: ["forbidden"] },
  ] as never;
  const r = pendenciasDaConta(torto);
  assert.equal(r.itens.length, 2);
  assert.ok(
    r.itens.every((p) => typeof p.mlb === "string" && typeof p.titulo === "string"),
    "campo ausente virou undefined na saída"
  );
  assert.match(r.itens.find((p) => !p.mlb)!.titulo, /sem t[íi]tulo/i);
});
