import test from "node:test";
import assert from "node:assert/strict";

import {
  expiraEm,
  explicarImpedimento,
  podeExecutar,
  precondicoesQuebradas,
  RISCO_POR_TIPO,
  type PropostaPersistida,
} from "./propostaPersistida";

const AGORA = "2026-07-29T12:00:00.000Z";

const BASE = {
  id: "prop-1",
  clienteId: "cli-A",
  conversaId: "conv-1",
  criadaPor: "user-1",
  tipo: "custo",
  risco: "alto",
  status: "pendente",
  alvos: ["p1"],
  valor: 24.9,
  resumo: "Trocar o custo de X de R$ 17,16 para R$ 24,90.",
  precondicoes: [{ campo: "custo", valorNaCriacao: 17.16 }],
  criadaEm: "2026-07-29T11:50:00.000Z",
  expiraEm: "2026-07-29T12:20:00.000Z",
} satisfies PropostaPersistida;

const com = (m: Partial<PropostaPersistida>): PropostaPersistida => ({ ...BASE, ...m });

/** O estado que satisfaz as precondições da BASE. */
const ESTADO_IGUAL = { custo: 17.16 };

test("proposta válida, do mesmo tenant, com estado igual: pode executar", () => {
  assert.deepEqual(podeExecutar(BASE, "cli-A", AGORA, ESTADO_IGUAL), { pode: true });
});

test("proposta inexistente não executa", () => {
  const v = podeExecutar(null, "cli-A", AGORA, ESTADO_IGUAL);
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "nao_encontrada");
});

test("proposta de OUTRO TENANT não executa", () => {
  // O tenant vem da sessão. Uma proposta de outro cliente é intocável mesmo
  // com o id correto em mãos.
  const v = podeExecutar(BASE, "cli-B", AGORA, ESTADO_IGUAL);
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "outro_tenant");
});

test("a mensagem NÃO distingue outro tenant de inexistente", () => {
  // Distinguir contaria a quem tentou que a proposta existe em outro cliente.
  // Internamente os dois casos são separados — para a auditoria registrar a
  // tentativa — mas o texto é o mesmo.
  const a = explicarImpedimento({ motivo: "nao_encontrada" });
  const b = explicarImpedimento({ motivo: "outro_tenant" });
  assert.equal(a, b);
});

test("proposta JÁ EXECUTADA não executa de novo — é o duplo clique", () => {
  const v = podeExecutar(com({ status: "executada" }), "cli-A", AGORA, ESTADO_IGUAL);
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "ja_executada");
});

test("já executada tem resposta PRÓPRIA, não um erro genérico", () => {
  // Um erro genérico faria a pessoa tentar de novo achando que falhou.
  const frase = explicarImpedimento({ motivo: "ja_executada" });
  assert.match(frase, /já foi feito/i);
  assert.doesNotMatch(frase, /erro|falh/i);
});

test("todo status que não é pendente é recusado", () => {
  for (const status of ["aprovada", "rejeitada", "expirada", "falhou", "obsoleta"] as const) {
    const v = podeExecutar(com({ status }), "cli-A", AGORA, ESTADO_IGUAL);
    assert.equal(v.pode, false, status);
    assert.equal(v.impedimento.motivo, "status_invalido", status);
  }
});

test("proposta vencida não executa", () => {
  const v = podeExecutar(
    com({ expiraEm: "2026-07-29T11:59:00.000Z" }),
    "cli-A",
    AGORA,
    ESTADO_IGUAL
  );
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "expirada");
});

test("expirar exatamente agora conta como vencida", () => {
  const v = podeExecutar(com({ expiraEm: AGORA }), "cli-A", AGORA, ESTADO_IGUAL);
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "expirada");
});

test("ESTADO MUDOU: proposta fica obsoleta e diz o que mudou", () => {
  // O caso da spec: custo era 42, virou 55, o clique chega depois.
  const v = podeExecutar(BASE, "cli-A", AGORA, { custo: 55 });
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "obsoleta");
  assert.deepEqual(v.impedimento.mudou, [{ campo: "custo", de: 17.16, para: 55 }]);
});

test("a explicação de obsoleta diz DE quanto PARA quanto", () => {
  // "Os dados mudaram" sem dizer o quê parece defeito. Dizendo, a pessoa
  // entende que foi protegida.
  const frase = explicarImpedimento({
    motivo: "obsoleta",
    mudou: [{ campo: "custo", de: 42, para: 55 }],
  });
  assert.match(frase, /42/);
  assert.match(frase, /55/);
  assert.match(frase, /Não gravei/);
});

test("dado APAGADO também é mudança", () => {
  const v = podeExecutar(BASE, "cli-A", AGORA, { custo: null });
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "obsoleta");
  assert.deepEqual(v.impedimento.mudou[0], { campo: "custo", de: 17.16, para: null });
});

test("campo AUSENTE do estado atual é tratado como apagado, não como igual", () => {
  // Se `custo` sumiu da leitura, não podemos supor que continua 17,16.
  const v = podeExecutar(BASE, "cli-A", AGORA, {});
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "obsoleta");
});

test("continuar sem valor NÃO é mudança", () => {
  const semCusto = com({ precondicoes: [{ campo: "custo", valorNaCriacao: null }] });
  assert.deepEqual(podeExecutar(semCusto, "cli-A", AGORA, { custo: null }), { pode: true });
});

test("a ordem das checagens não vaza existência de proposta alheia", () => {
  // Proposta de outro tenant, JÁ executada e com estado mudado: o veredito tem
  // que ser `outro_tenant`. Se `ja_executada` viesse antes, a mensagem
  // confirmaria que a proposta existe e foi usada.
  const alheia = com({ clienteId: "cli-B", status: "executada" });
  const v = podeExecutar(alheia, "cli-A", AGORA, { custo: 999 });
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "outro_tenant");
});

test("várias precondições: qualquer uma quebrada basta", () => {
  const duas = com({
    precondicoes: [
      { campo: "custo", valorNaCriacao: 17.16 },
      { campo: "variacoesSemPeso", valorNaCriacao: 12 },
    ],
  });
  const v = podeExecutar(duas, "cli-A", AGORA, { custo: 17.16, variacoesSemPeso: 8 });
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "obsoleta");
  assert.equal(v.impedimento.mudou.length, 1);
  assert.equal(v.impedimento.mudou[0].campo, "variacoesSemPeso");
});

test("precondicoesQuebradas devolve vazio quando nada mudou", () => {
  assert.deepEqual(precondicoesQuebradas(BASE.precondicoes, ESTADO_IGUAL), []);
});

test("a expiração é derivada da criação, não do relógio de quem lê", () => {
  const e = expiraEm("2026-07-29T11:50:00.000Z");
  assert.equal(e, "2026-07-29T12:20:00.000Z");
});

test("peso e custo são AMBOS risco alto", () => {
  // Peso muda o frete, e frete errado vira preço abaixo do custo. Nenhum dos
  // dois é "baixo risco" só porque é um campo só.
  assert.equal(RISCO_POR_TIPO.peso, "alto");
  assert.equal(RISCO_POR_TIPO.custo, "alto");
});
