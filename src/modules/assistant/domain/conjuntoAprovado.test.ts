// CICLO G.1 — a escrita de peso não pode sair do conjunto aprovado.
//
// O que se prova aqui é O CONJUNTO QUE VAI PARA A ESCRITA, não o texto do
// arquivo. A rota monta a query a partir de `escritaDePeso(p)` e não tem
// segunda fonte para os filtros; então provar a descrição é provar o alcance.
//
// O cenário central é o que o CICLO G falsificou em transação revertida sobre o
// catálogo real:
//
//     aprovado {A,B,C}  →  alguém preenche C e zera D  →  {A,B,D}
//     contagem 3 = 3, a precondição por contagem APROVA,
//     e o código anterior gravava em D.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { escritaDePeso, idsCongelados } from "./conjuntoAprovado.ts";
import { podeExecutar, type PropostaPersistida } from "./propostaPersistida.ts";

const CLIENTE = "5074ae56-5f3a-4bc2-a3ad-d9f79ac8d53c";
const PRODUTO = "faaed47d-28de-4c7d-b6e4-15b88dad5d11";
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const C = "cccccccc-0000-4000-8000-000000000003";
const D = "dddddddd-0000-4000-8000-000000000004";

function proposta(over: Partial<PropostaPersistida> = {}): PropostaPersistida {
  return {
    id: "903c1830-6cb3-488b-962f-c1edb018a60a",
    clienteId: CLIENTE,
    conversaId: "3d8af477-bad6-42c5-917b-84b71252718b",
    criadaPor: "",
    tipo: "peso",
    risco: "alto",
    status: "pendente",
    alvos: [PRODUTO],
    valor: 410,
    resumo: "Aplicar 410 g de peso a 3 variações de 1 produto.",
    precondicoes: [
      { campo: `variacoesSemPeso:${PRODUTO}`, valorNaCriacao: 3, idsAprovados: [A, B, C] },
    ],
    criadaEm: "2026-07-31T00:53:14.358Z",
    expiraEm: "2026-07-31T01:23:14.358Z",
    autoridade: "sem_autoridade",
    ...over,
  };
}

/** O conjunto que a escrita pode tocar, como a rota o obtém. */
const alcance = (p: PropostaPersistida) => escritaDePeso(p).ids;

// ---------------------------------------------------------------------------
// T1–T8 — a identidade
// ---------------------------------------------------------------------------

test("T1 conjunto inalterado: a escrita mira exatamente o aprovado", () => {
  assert.deepEqual(alcance(proposta()), [A, B, C]);
});

test("T2 encolheu {A,B}: a escrita NÃO ganha ninguém de fora", () => {
  // O alcance é o aprovado; quem já foi preenchido é barrado por `peso <= 0`,
  // que o banco aplica no mesmo statement.
  const e = escritaDePeso(proposta());
  assert.deepEqual(e.ids, [A, B, C]);
  assert.equal(e.apenasSemPeso, true);
});

test("T3 apareceu D: D não está no alcance", () => {
  assert.ok(!alcance(proposta())!.includes(D));
});

test("T4/T5 TROCA {A,B,C} -> {A,B,D}: D jamais é escrita", () => {
  // ESTE é o defeito do INC-002 que o CICLO G demonstrou. A contagem continua
  // 3 e a revalidação aprova — e mesmo assim D está fora do alcance.
  const p = proposta();
  const estado = { [`variacoesSemPeso:${PRODUTO}`]: 3 };
  assert.equal(podeExecutar(p, CLIENTE, "2026-07-31T01:00:00.000Z", estado).pode, true);
  const ids = alcance(p)!;
  assert.ok(!ids.includes(D), "D entrou no alcance: o defeito voltou");
  assert.ok(ids.includes(A) && ids.includes(B));
  assert.ok(ids.includes(C), "C some do alcance — quem barra C é `peso <= 0`, não a lista");
});

test("T6 variante aprovada já preenchida: quem barra é apenasSemPeso", () => {
  assert.equal(escritaDePeso(proposta()).apenasSemPeso, true);
});

test("T7/T8 variante zerada ou criada depois: fora do alcance", () => {
  const ids = alcance(proposta())!;
  for (const forasteiro of [D, "eeeeeeee-0000-4000-8000-000000000005"]) {
    assert.ok(!ids.includes(forasteiro));
  }
});

// ---------------------------------------------------------------------------
// T9/T10 — tenant e ids inválidos NÃO ampliam alcance
// ---------------------------------------------------------------------------

test("T9/T10 id de outro tenant ou inexistente não amplia o alcance", () => {
  // Entram na lista, mas a lista só RESTRINGE: os outros filtros continuam.
  const p = proposta({
    precondicoes: [
      { campo: `variacoesSemPeso:${PRODUTO}`, valorNaCriacao: 3, idsAprovados: [A, "id-de-outro-tenant", "nao-existe"] },
    ],
  });
  const e = escritaDePeso(p);
  assert.equal(e.clienteId, CLIENTE, "o tenant deixou de vir da proposta");
  assert.deepEqual(e.produtoIds, [PRODUTO], "o escopo por produto sumiu");
  assert.equal(e.apenasSemPeso, true);
  // `ids` é interseção, nunca união: um id solto não alcança linha nenhuma
  // porque produto e tenant continuam filtrando.
  assert.ok(e.ids!.includes(A));
});

// ---------------------------------------------------------------------------
// T11 — LEGACY
// ---------------------------------------------------------------------------

test("T11 proposta legacy: sem ids, comportamento anterior intacto", () => {
  const p = proposta({
    precondicoes: [{ campo: `variacoesSemPeso:${PRODUTO}`, valorNaCriacao: 3 }],
  });
  assert.equal(idsCongelados(p), undefined, "legacy virou conjunto congelado");
  assert.equal(escritaDePeso(p).ids, undefined);
  // E os outros filtros continuam todos lá.
  assert.deepEqual(escritaDePeso(p).produtoIds, [PRODUTO]);
  assert.equal(escritaDePeso(p).apenasSemPeso, true);
});

test("LEGACY: ausência NUNCA vira conjunto vazio", () => {
  // Um `Set` vazio faria a escrita não atingir nada — toda proposta antiga
  // viraria uma que não grava.
  const p = proposta({ precondicoes: [] });
  assert.equal(idsCongelados(p), undefined);
  assert.notDeepEqual(escritaDePeso(p).ids, []);
});

// ---------------------------------------------------------------------------
// T12/T13 — os outros contratos não se misturam
// ---------------------------------------------------------------------------

test("T12 derivada: conjunto congelado e pesoConhecido coexistem e não se misturam", () => {
  const p = proposta({
    precondicoes: [
      { campo: `variacoesSemPeso:${PRODUTO}`, valorNaCriacao: 3, idsAprovados: [A, B, C] },
      { campo: `pesoConhecido:${PRODUTO}`, valorNaCriacao: 410 },
    ],
  });
  assert.deepEqual(alcance(p), [A, B, C]);
  // `pesoConhecido` responde POR QUE o valor vale, não QUEM pode ser tocado.
  // Se ele carregasse ids, a referência derivada mexeria no alcance da escrita.
  assert.ok(p.precondicoes.find((c) => c.campo.startsWith("pesoConhecido:"))!.idsAprovados === undefined);
});

test("T13 a autoridade da 044 não é tocada pelo conjunto congelado", () => {
  const p = proposta({ autoridade: "sem_autoridade" });
  escritaDePeso(p);
  assert.equal(p.autoridade, "sem_autoridade");
  const fonte = readFileSync(new URL("./conjuntoAprovado.ts", import.meta.url), "utf8");
  assert.ok(!/autoridade/.test(fonte), "o conjunto aprovado passou a mexer em autoridade");
});

// ---------------------------------------------------------------------------
// T14/T15 — as proteções de sempre continuam antes da escrita
// ---------------------------------------------------------------------------

const ESTADO = { [`variacoesSemPeso:${PRODUTO}`]: 3 };

test("T14 expirada continua recusada, com ou sem conjunto congelado", () => {
  const v = podeExecutar(proposta(), CLIENTE, "2026-07-31T12:00:00.000Z", ESTADO);
  assert.equal(v.pode, false);
  assert.equal(v.pode === false && v.impedimento.motivo, "expirada");
});

test("T15 outro tenant continua recusado", () => {
  const v = podeExecutar(proposta(), "outro-cliente", "2026-07-31T01:00:00.000Z", ESTADO);
  assert.equal(v.pode, false);
  assert.equal(v.pode === false && v.impedimento.motivo, "outro_tenant");
});

test("contagem que muda continua invalidando — a precondição antiga não foi enfraquecida", () => {
  const v = podeExecutar(proposta(), CLIENTE, "2026-07-31T01:00:00.000Z", {
    [`variacoesSemPeso:${PRODUTO}`]: 2,
  });
  assert.equal(v.pode, false);
  assert.equal(v.pode === false && v.impedimento.motivo, "obsoleta");
});

test("CONTROLE: `podeExecutar` NÃO revalida a identidade — ela é restrição de ESCRITA", () => {
  // Se a identidade virasse precondição, uma troca invalidaria a proposta em
  // vez de reduzir a escrita — e isso contraria `desfechoDoPreenchimento`, que
  // declara a parcialidade como contrato.
  const fonte = readFileSync(new URL("./propostaPersistida.ts", import.meta.url), "utf8");
  const corpo = fonte.slice(fonte.indexOf("export function podeExecutar"));
  assert.ok(!/idsAprovados/.test(corpo));
});

// ---------------------------------------------------------------------------
// A rota usa ESTA descrição, e não uma segunda fonte
// ---------------------------------------------------------------------------

test("a rota monta a escrita a partir de `escritaDePeso` — fonte única", () => {
  const rota = readFileSync(new URL("../../../app/api/assistente/proposta/route.ts", import.meta.url), "utf8");
  assert.match(rota, /escritaDePeso\(p\)/, "a rota deixou de consumir a descrição");
  // Os dois caminhos de peso — lote e individual — precisam aplicar os ids.
  const aplicacoes = rota.match(/\.in\("id", \[\.\.\.congelados/g) ?? [];
  assert.equal(aplicacoes.length, 2, `esperava 2 aplicações do conjunto congelado, achei ${aplicacoes.length}`);
});
