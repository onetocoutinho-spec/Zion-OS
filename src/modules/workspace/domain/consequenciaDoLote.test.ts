import { test } from "node:test";
import assert from "node:assert/strict";
import { consequenciaDoLote, type AvaliacaoDeAlvo } from "./consequenciaDoLote.ts";
import { ofertasQueValem } from "./consequencia.ts";

const base = { resumo: "47 variantes atualizadas", afetados: 47 };

// ---------------------------------------------------------------------------
// SENTINELA R1 — a prova contra uma ampliação concreta
// ---------------------------------------------------------------------------

test("SENTINELA R1: produtos fora de p.alvos que TAMBÉM seriam desbloqueados não entram", () => {
  // Cenário: uma implementação ingênua leria o catálogo e acharia "z" e "w",
  // que satisfazem exatamente a mesma condição de "a". O resultado tem que
  // continuar refletindo SOMENTE o conjunto oferecido.
  const r = consequenciaDoLote({
    ...base,
    alvos: ["a", "b"],
    avaliacoes: [
      { produtoId: "a", antes: "bloqueado", depois: "calculavel" },
      { produtoId: "b", antes: "bloqueado", depois: "bloqueado" },
      // Vindos do catálogo, não da proposta:
      { produtoId: "z", antes: "bloqueado", depois: "calculavel" },
      { produtoId: "w", antes: "bloqueado", depois: "calculavel" },
    ],
  });

  assert.equal(r.consequencia?.desbloqueios[0].quantos, 1, "contou registro externo");
  assert.deepEqual(r.desbloqueados, ["a"]);
  assert.equal(r.foraDoEscopo, 2);
  assert.equal(r.naoAvaliados, 0);
});

test("SENTINELA R1: nem mesmo o catálogo INTEIRO altera o número", () => {
  // Se alguém trocar o porto por `catalogoParaTriagem`, o número não muda —
  // só `foraDoEscopo` cresce, e a guarda da fiação real acusa.
  const catalogo: AvaliacaoDeAlvo[] = Array.from({ length: 300 }, (_, i) => ({
    produtoId: `externo-${i}`,
    antes: "bloqueado" as const,
    depois: "calculavel" as const,
  }));
  const r = consequenciaDoLote({
    ...base,
    alvos: ["a"],
    avaliacoes: [{ produtoId: "a", antes: "bloqueado", depois: "calculavel" }, ...catalogo],
  });
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 1);
  assert.equal(r.foraDoEscopo, 300);
});

test("um alvo que aparece duas vezes conta uma vez", () => {
  const r = consequenciaDoLote({
    ...base,
    alvos: ["a"],
    avaliacoes: [
      { produtoId: "a", antes: "bloqueado", depois: "calculavel" },
      { produtoId: "a", antes: "bloqueado", depois: "calculavel" },
    ],
  });
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 1);
});

// ---------------------------------------------------------------------------
// CAUSALIDADE — os cinco controles
// ---------------------------------------------------------------------------

test("CONTROLE A: bloqueado por peso -> calculável depois -> CONTA", () => {
  const r = consequenciaDoLote({
    ...base,
    alvos: ["a"],
    avaliacoes: [{ produtoId: "a", antes: "bloqueado", depois: "calculavel" }],
  });
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 1);
  assert.deepEqual(r.desbloqueados, ["a"]);
});

test("CONTROLE B: já era calculável antes -> NÃO CONTA", () => {
  // O caso que falsificou o desenho anterior: entrou no escopo por ter variante
  // sem peso, mas outra variante já dava embalagem.
  const r = consequenciaDoLote({
    ...base,
    alvos: ["ja-tinha"],
    avaliacoes: [{ produtoId: "ja-tinha", antes: "calculavel", depois: "calculavel" }],
  });
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 0);
  assert.deepEqual(r.desbloqueados, []);
});

test("CONTROLE C: continua bloqueado por custo -> NÃO CONTA", () => {
  const r = consequenciaDoLote({
    ...base,
    alvos: ["sem-custo"],
    avaliacoes: [{ produtoId: "sem-custo", antes: "bloqueado", depois: "bloqueado" }],
  });
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 0);
});

test("CONTROLE D: estado anterior insuficiente -> quantos: null, nunca estimativa", () => {
  const r = consequenciaDoLote({
    ...base,
    alvos: ["a", "b", "c"],
    avaliacoes: [{ produtoId: "a", antes: "bloqueado", depois: "calculavel" }],
  });
  assert.equal(r.naoAvaliados, 2);
  assert.equal(r.consequencia?.desbloqueios[0].quantos, null, "publicou número parcial");
});

test("CONTROLE D: um só alvo não avaliado já basta para suprimir o número", () => {
  const r = consequenciaDoLote({
    ...base,
    alvos: ["a", "b"],
    avaliacoes: [{ produtoId: "a", antes: "bloqueado", depois: "calculavel" }],
  });
  assert.equal(r.consequencia?.desbloqueios[0].quantos, null);
});

test("CONTROLE E: externo que satisfaria a condição — coberto pela sentinela R1", () => {
  const r = consequenciaDoLote({
    ...base,
    alvos: ["a"],
    avaliacoes: [
      { produtoId: "a", antes: "bloqueado", depois: "bloqueado" },
      { produtoId: "externo", antes: "bloqueado", depois: "calculavel" },
    ],
  });
  // O externo seria desbloqueado; o alvo não foi. O número é ZERO, não um.
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 0);
  assert.equal(r.foraDoEscopo, 1);
});

test("conflito -> calculável NÃO conta: peso não resolve custo em disputa", () => {
  const r = consequenciaDoLote({
    ...base,
    alvos: ["a"],
    avaliacoes: [{ produtoId: "a", antes: "conflito", depois: "calculavel" }],
  });
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 0);
});

test("calculável -> bloqueado (regressão) não vira número negativo nem conta", () => {
  const r = consequenciaDoLote({
    ...base,
    alvos: ["a"],
    avaliacoes: [{ produtoId: "a", antes: "calculavel", depois: "bloqueado" }],
  });
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 0);
});

// ---------------------------------------------------------------------------
// ZERO CONHECIDO vs AUSÊNCIA
// ---------------------------------------------------------------------------

test("zero conhecido é ZERO, e é diferente de null", () => {
  const zero = consequenciaDoLote({
    ...base,
    alvos: ["a"],
    avaliacoes: [{ produtoId: "a", antes: "bloqueado", depois: "bloqueado" }],
  });
  const desconhecido = consequenciaDoLote({ ...base, alvos: ["a"], avaliacoes: [] });
  assert.equal(zero.consequencia?.desbloqueios[0].quantos, 0);
  assert.equal(desconhecido.consequencia?.desbloqueios[0].quantos, null);
  assert.notEqual(
    zero.consequencia?.desbloqueios[0].quantos,
    desconhecido.consequencia?.desbloqueios[0].quantos
  );
});

test("zero conhecido NÃO vira oferta — o fato fica, o botão não aparece", () => {
  const zero = consequenciaDoLote({
    ...base,
    alvos: ["a"],
    avaliacoes: [{ produtoId: "a", antes: "bloqueado", depois: "bloqueado" }],
  });
  assert.equal(zero.consequencia!.desbloqueios.length, 1, "o fato tem que ficar registrado");
  assert.deepEqual(ofertasQueValem(zero.consequencia!), [], "zero não pode virar botão");
});

test("null (não sei) CONTINUA sendo oferta — 'não contei' não é 'contei e deu zero'", () => {
  const r = consequenciaDoLote({ ...base, alvos: ["a", "b"], avaliacoes: [] });
  assert.equal(ofertasQueValem(r.consequencia!).length, 1);
});

// ---------------------------------------------------------------------------
// Bordas
// ---------------------------------------------------------------------------

test("sem alvos: consequência é null — nada oferecido, nada a concluir", () => {
  const r = consequenciaDoLote({ ...base, alvos: [], avaliacoes: [] });
  assert.equal(r.consequencia, null);
  assert.equal(r.naoAvaliados, 0);
});

test("sem alvos, mas com avaliações externas: continua null e acusa o fora de escopo", () => {
  const r = consequenciaDoLote({
    ...base,
    alvos: [],
    avaliacoes: [{ produtoId: "z", antes: "bloqueado", depois: "calculavel" }],
  });
  assert.equal(r.consequencia, null);
  assert.equal(r.foraDoEscopo, 1);
});

test("a consequência não reconta a escrita: `afetados` atravessa intacto", () => {
  const r = consequenciaDoLote({
    resumo: "x",
    afetados: 47,
    alvos: ["a"],
    avaliacoes: [{ produtoId: "a", antes: "bloqueado", depois: "calculavel" }],
  });
  assert.equal(r.consequencia?.afetados, 47);
});

test("só produz desbloqueio de PRICING — nenhum outro modo neste slice", () => {
  const r = consequenciaDoLote({
    ...base,
    alvos: ["a"],
    avaliacoes: [{ produtoId: "a", antes: "bloqueado", depois: "calculavel" }],
  });
  assert.deepEqual(
    r.consequencia!.desbloqueios.map((d) => d.modo),
    ["pricing"]
  );
});
