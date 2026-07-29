import test from "node:test";
import assert from "node:assert/strict";

import {
  apresentar,
  conjuntoVigente,
  lerMetadata,
  lerOrdinal,
  paraMetadata,
  resolverEscolha,
  type ConjuntoApresentado,
} from "./referenciasDaConversa";

const TRES: ConjuntoApresentado = apresentar("busca", [
  { tipo: "produto", id: "prod-A", rotulo: "Papete Modare 7178.102" },
  { tipo: "produto", id: "prod-B", rotulo: "Papete Modare 7178.104" },
  { tipo: "produto", id: "prod-C", rotulo: "Papete Beira Rio 8488.122" },
]);

// ---------------------------------------------------------------------------
// ordinais
// ---------------------------------------------------------------------------

test("ordinais em português viram números", () => {
  assert.equal(lerOrdinal("o primeiro"), 1);
  assert.equal(lerOrdinal("o segundo"), 2);
  assert.equal(lerOrdinal("a terceira"), 3);
  assert.equal(lerOrdinal("quarto"), 4);
  assert.equal(lerOrdinal("o décimo"), 10);
});

test("acento não decide nada", () => {
  assert.equal(lerOrdinal("o setimo"), 7);
  assert.equal(lerOrdinal("o sétimo"), 7);
});

test('"o último" precisa do tamanho do conjunto para existir', () => {
  assert.equal(lerOrdinal("o último", 3), 3);
  // Sem o tamanho, "último" é tão indeterminado quanto "aquele".
  assert.equal(lerOrdinal("o último"), null);
});

test("número solto vale como posição", () => {
  assert.equal(lerOrdinal("2"), 2);
  assert.equal(lerOrdinal("o 3"), 3);
  assert.equal(lerOrdinal("n. 1"), 1);
});

test("UM SKU NÃO É UM ORDINAL", () => {
  // "01040533" tem dígitos e não é posição de lista nenhuma. Confundir os dois
  // apontaria para o produto errado sem nada na tela denunciando.
  assert.equal(lerOrdinal("01040533"), null);
  assert.equal(lerOrdinal("7900350512518"), null);
});

test("frase sem ordinal não inventa um", () => {
  assert.equal(lerOrdinal("esse aí"), null);
  assert.equal(lerOrdinal(""), null);
});

// ---------------------------------------------------------------------------
// resolução
// ---------------------------------------------------------------------------

test('"o segundo" resolve para o id que foi mostrado em segundo', () => {
  const r = resolverEscolha("o segundo", TRES);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.item.id, "prod-B");
});

test("o id cru também resolve — quando o modelo já o tem", () => {
  const r = resolverEscolha("prod-C", TRES);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.item.ordem, 3);
});

test("um id que NÃO está no conjunto é recusado", () => {
  // Um id vindo de outro lugar é alucinação estrutural, e aceitar seria deixar
  // o modelo escolher o alvo sem passar por uma lista que alguém viu.
  const r = resolverEscolha("prod-Z", TRES);
  assert.equal(r.ok, false);
});

test("sem conjunto, não há referente — e a resposta é perguntar", () => {
  const r = resolverEscolha("o segundo", null);
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.motivo, /não mostrei uma lista/i);
});

test("ordinal fora da lista é recusado com o tamanho real", () => {
  const r = resolverEscolha("o quinto", TRES);
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.motivo, /mostrei 3/);
});

test("a numeração é a da tela — apresentar numera na ordem recebida", () => {
  assert.deepEqual(
    TRES.itens.map((i) => [i.ordem, i.id]),
    [
      [1, "prod-A"],
      [2, "prod-B"],
      [3, "prod-C"],
    ]
  );
});

// ---------------------------------------------------------------------------
// ida e volta pelo banco
// ---------------------------------------------------------------------------

test("o conjunto sobrevive à ida e volta do jsonb", () => {
  const lido = lerMetadata(JSON.parse(JSON.stringify(paraMetadata(TRES))));
  assert.deepEqual(lido, TRES);
});

test("metadata corrompida não derruba a resolução — devolve null", () => {
  assert.equal(lerMetadata(null), null);
  assert.equal(lerMetadata({}), null);
  assert.equal(lerMetadata({ candidatos: { origem: "sei_la", itens: [] } }), null);
  assert.equal(lerMetadata({ candidatos: { origem: "busca", itens: "nao é lista" } }), null);
});

test("item sem id é descartado, não vira item fantasma", () => {
  const lido = lerMetadata({
    candidatos: {
      origem: "busca",
      itens: [
        { ordem: 1, tipo: "produto", id: "prod-A", rotulo: "A" },
        { ordem: 2, tipo: "produto", rotulo: "sem id" },
      ],
    },
  });
  assert.equal(lido?.itens.length, 1);
});

// ---------------------------------------------------------------------------
// a lista CORRENTE — e só ela
// ---------------------------------------------------------------------------

test("a lista da última fala do assistente é a referenciável", () => {
  const vigente = conjuntoVigente([
    { papel: "lojista", metadata: null },
    { papel: "assistente", metadata: paraMetadata(TRES) },
  ]);
  assert.equal(vigente?.itens.length, 3);
});

test("LISTA ANTIGA NÃO É CONFUNDIDA COM A NOVA", () => {
  // Se a última fala do assistente não mostrou lista, não existe lista corrente.
  // Continuar procurando acharia a de três turnos atrás e a trataria como "a
  // lista" — e "o segundo" apontaria para outro produto.
  const vigente = conjuntoVigente([
    { papel: "assistente", metadata: paraMetadata(TRES) },
    { papel: "lojista", metadata: null },
    { papel: "assistente", metadata: null },
  ]);
  assert.equal(vigente, null);
  assert.equal(resolverEscolha("o segundo", vigente).ok, false);
});

test("uma lista nova substitui a anterior por inteiro", () => {
  const nova = apresentar("cadastros", [
    { tipo: "cadastro", id: "d9", rotulo: "Havaianas Top" },
  ]);
  const vigente = conjuntoVigente([
    { papel: "assistente", metadata: paraMetadata(TRES) },
    { papel: "assistente", metadata: paraMetadata(nova) },
  ]);
  assert.equal(vigente?.origem, "cadastros");
  const r = resolverEscolha("o primeiro", vigente);
  assert.equal(r.ok && r.item.id, "d9");
});

test("conversa sem nenhuma fala do assistente não tem lista", () => {
  assert.equal(conjuntoVigente([{ papel: "lojista", metadata: null }]), null);
  assert.equal(conjuntoVigente([]), null);
});
