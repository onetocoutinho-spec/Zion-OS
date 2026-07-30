import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESTADO_INICIAL,
  MODOS,
  NAO_SAO_MODOS,
  aplicar,
  workspaceDeveAparecer,
  type EstadoDoWorkspace,
  type ModoDoWorkspace,
} from "./modosDoWorkspace.ts";
import { MINIMO_DE_ITENS, porQueAindaNaoVale, valeATela } from "./valeATela.ts";

const TABELA_CHEIA = { itens: 40, acaoQueAConversaNaoOferece: true, comparavelLadoALado: true };

// ---------------------------------------------------------------------------
// Os cinco modos
// ---------------------------------------------------------------------------

test("são exatamente CINCO modos — os que HIGGSFIELD-003 derivou", () => {
  assert.equal(MODOS.length, 5);
  assert.deepEqual(
    [...MODOS].sort(),
    ["draft", "fila-de-decisoes", "preparacao", "pricing", "triagem"]
  );
});

test("conflito, proveniência e prejuízo NÃO são modos", () => {
  const nomes = Object.keys(NAO_SAO_MODOS);
  for (const n of nomes) {
    assert.ok(!(MODOS as readonly string[]).includes(n), `${n} virou modo`);
  }
});

test("cada não-modo aponta onde vive", () => {
  assert.equal(NAO_SAO_MODOS.conflito.modo, "fila-de-decisoes");
  assert.equal(NAO_SAO_MODOS.prejuizo.modo, "pricing");
  // Proveniência não tem modo hospedeiro: é disclosure de qualquer cartão.
  assert.equal(NAO_SAO_MODOS.proveniencia.modo, null);
});

// ---------------------------------------------------------------------------
// A REGRA: só a intenção troca o modo
// ---------------------------------------------------------------------------

test("a intenção troca o modo", () => {
  const e = aplicar(ESTADO_INICIAL, {
    tipo: "intencao",
    intencao: { destino: "pricing", origem: "clique" },
  });
  assert.equal(e.modo, "pricing");
});

test("a CONSEQUÊNCIA nunca troca o modo — a regra aprovada", () => {
  const emTriagem: EstadoDoWorkspace = { modo: "triagem", oferecidos: [], profundidade: 0 };
  const depois = aplicar(emTriagem, {
    tipo: "consequencia",
    consequencia: { resumo: "47 variantes atualizadas", desbloqueou: ["pricing", "preparacao"] },
  });
  assert.equal(depois.modo, "triagem", "a consequência sequestrou o contexto");
  assert.deepEqual([...depois.oferecidos].sort(), ["preparacao", "pricing"]);
});

test("consequência nenhuma, em nenhuma ordem, muda o modo", () => {
  const modos: (ModoDoWorkspace | null)[] = [null, ...MODOS];
  for (const modo of modos) {
    let e: EstadoDoWorkspace = { modo, oferecidos: [], profundidade: 0 };
    for (const d of MODOS) {
      e = aplicar(e, { tipo: "consequencia", consequencia: { resumo: "x", desbloqueou: [d] } });
      assert.equal(e.modo, modo, `consequência mudou o modo de ${modo} para ${e.modo}`);
    }
  }
});

test("o exemplo do enunciado: peso resolvido oferece pricing e NÃO navega", () => {
  const naFila: EstadoDoWorkspace = { modo: "fila-de-decisoes", oferecidos: [], profundidade: 0 };
  const aposResolver = aplicar(naFila, {
    tipo: "consequencia",
    consequencia: { resumo: "47 variantes atualizadas", desbloqueou: ["pricing"] },
  });
  assert.equal(aposResolver.modo, "fila-de-decisoes");
  assert.ok(aposResolver.oferecidos.includes("pricing"));

  // Só o clique muda.
  const aposClicar = aplicar(aposResolver, {
    tipo: "intencao",
    intencao: { destino: "pricing", origem: "clique" },
  });
  assert.equal(aposClicar.modo, "pricing");
});

test("ir para um modo consome a oferta dele e preserva as outras", () => {
  const e: EstadoDoWorkspace = {
    modo: "triagem",
    oferecidos: ["pricing", "preparacao"],
    profundidade: 0,
  };
  const d = aplicar(e, { tipo: "intencao", intencao: { destino: "pricing", origem: "clique" } });
  assert.deepEqual(d.oferecidos, ["preparacao"]);
});

test("não se oferece o modo em que já se está", () => {
  const e: EstadoDoWorkspace = { modo: "pricing", oferecidos: [], profundidade: 0 };
  const d = aplicar(e, {
    tipo: "consequencia",
    consequencia: { resumo: "x", desbloqueou: ["pricing"] },
  });
  assert.deepEqual(d.oferecidos, []);
});

test("ofertas não duplicam", () => {
  let e: EstadoDoWorkspace = { modo: "triagem", oferecidos: [], profundidade: 0 };
  for (let i = 0; i < 3; i++) {
    e = aplicar(e, { tipo: "consequencia", consequencia: { resumo: "x", desbloqueou: ["pricing"] } });
  }
  assert.deepEqual(e.oferecidos, ["pricing"]);
});

test("intenção nula fecha o workspace", () => {
  const e: EstadoDoWorkspace = { modo: "pricing", oferecidos: [], profundidade: 1 };
  const d = aplicar(e, { tipo: "intencao", intencao: { destino: null, origem: "clique" } });
  assert.equal(d.modo, null);
  assert.equal(d.profundidade, 0);
});

// ---------------------------------------------------------------------------
// D5 — drill-down
// ---------------------------------------------------------------------------

test("D5: drill-down aprofunda dentro do modo, sem trocá-lo", () => {
  const e: EstadoDoWorkspace = { modo: "triagem", oferecidos: [], profundidade: 0 };
  const d = aplicar(e, { tipo: "drill-down" });
  assert.equal(d.modo, "triagem");
  assert.equal(d.profundidade, 1);
});

test("D5: a profundidade nunca passa de 1", () => {
  let e: EstadoDoWorkspace = { modo: "triagem", oferecidos: [], profundidade: 0 };
  for (let i = 0; i < 5; i++) e = aplicar(e, { tipo: "drill-down" });
  assert.equal(e.profundidade, 1);
});

test("D5: sem modo não há drill-down", () => {
  const d = aplicar(ESTADO_INICIAL, { tipo: "drill-down" });
  assert.equal(d.profundidade, 0);
});

test("D5: voltar sobe um nível; voltar da raiz fecha o workspace", () => {
  const fundo: EstadoDoWorkspace = { modo: "triagem", oferecidos: [], profundidade: 1 };
  const meio = aplicar(fundo, { tipo: "voltar" });
  assert.deepEqual([meio.modo, meio.profundidade], ["triagem", 0]);
  const fora = aplicar(meio, { tipo: "voltar" });
  assert.equal(fora.modo, null);
});

test("trocar de modo volta à raiz do drill-down", () => {
  const e: EstadoDoWorkspace = { modo: "triagem", oferecidos: [], profundidade: 1 };
  const d = aplicar(e, { tipo: "intencao", intencao: { destino: "pricing", origem: "clique" } });
  assert.equal(d.profundidade, 0);
});

// ---------------------------------------------------------------------------
// D6 e D7
// ---------------------------------------------------------------------------

test("D6: sem modo, o workspace não aparece nem com conteúdo de sobra", () => {
  assert.equal(workspaceDeveAparecer(ESTADO_INICIAL, TABELA_CHEIA), false);
});

test("D6: com modo e conteúdo que vale, aparece", () => {
  const e: EstadoDoWorkspace = { modo: "triagem", oferecidos: [], profundidade: 0 };
  assert.equal(workspaceDeveAparecer(e, TABELA_CHEIA), true);
});

test("D7: o Draft com dois fatos NÃO abre a tela", () => {
  const e: EstadoDoWorkspace = { modo: "draft", oferecidos: [], profundidade: 0 };
  const draftMagro = {
    itens: 2,
    acaoQueAConversaNaoOferece: true,
    comparavelLadoALado: false,
  };
  assert.equal(valeATela(draftMagro), false);
  assert.equal(workspaceDeveAparecer(e, draftMagro), false);
});

test("D7: o mesmo Draft, já com grade, passa a valer", () => {
  const comGrade = { itens: 6, acaoQueAConversaNaoOferece: true, comparavelLadoALado: true };
  assert.equal(valeATela(comGrade), true);
});

test("D7: ação sozinha não basta — o botão cabe na conversa", () => {
  assert.equal(
    valeATela({ itens: 1, acaoQueAConversaNaoOferece: true, comparavelLadoALado: true }),
    false
  );
});

test("D7: o limiar é TRÊS — dois fatos são uma frase", () => {
  assert.equal(MINIMO_DE_ITENS, 3);
  const base = { acaoQueAConversaNaoOferece: false, comparavelLadoALado: true };
  assert.equal(valeATela({ ...base, itens: 2 }), false);
  assert.equal(valeATela({ ...base, itens: 3 }), true);
});

test("D7: itens de sobra sem comparação nem ação em lote NÃO valem a tela", () => {
  assert.equal(
    valeATela({ itens: 50, acaoQueAConversaNaoOferece: false, comparavelLadoALado: false }),
    false
  );
});

test("D7: a explicação existe quando não vale e some quando vale", () => {
  assert.equal(porQueAindaNaoVale(TABELA_CHEIA), null);
  assert.match(
    porQueAindaNaoVale({ itens: 2, acaoQueAConversaNaoOferece: true, comparavelLadoALado: false })!,
    /poucos dados/i
  );
  assert.match(
    porQueAindaNaoVale({ itens: 0, acaoQueAConversaNaoOferece: false, comparavelLadoALado: false })!,
    /nada para mostrar/i
  );
  assert.match(
    porQueAindaNaoVale({ itens: 9, acaoQueAConversaNaoOferece: false, comparavelLadoALado: false })!,
    /cabe na conversa/i
  );
});
