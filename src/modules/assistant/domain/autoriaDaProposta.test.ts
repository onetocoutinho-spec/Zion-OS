// Quem viu o diff é quem confirma — para risco alto/crítico.
//
// `criadaPor` era gravado "para a auditoria" e nunca conferido na execução:
// qualquer operador do tenant executava a proposta de qualquer outro. Para
// custo, peso e preço isso é um portão que não porta. (Auditoria do Copilot,
// 2026-08-22, P2.)

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { explicarImpedimento, podeExecutar, type PropostaPersistida } from "./propostaPersistida";

const AGORA = "2026-08-22T12:00:00.000Z";
function proposta(extra: Partial<PropostaPersistida>): PropostaPersistida {
  return {
    id: "p1",
    clienteId: "loja-A",
    conversaId: "c1",
    criadaPor: "ana",
    tipo: "custo",
    risco: "alto",
    status: "pendente",
    alvos: ["prod-1"],
    valor: 10,
    resumo: "custo",
    precondicoes: [],
    criadaEm: AGORA,
    expiraEm: "2026-08-22T12:30:00.000Z",
    autoridade: "ditado",
    ...extra,
  } as PropostaPersistida;
}

test("risco alto: outro usuário do MESMO tenant não executa", () => {
  const v = podeExecutar(proposta({}), "loja-A", AGORA, {}, "bruno");
  assert.deepEqual(v, { pode: false, impedimento: { motivo: "outro_usuario" } });
});

test("risco alto: quem criou executa", () => {
  assert.deepEqual(podeExecutar(proposta({}), "loja-A", AGORA, {}, "ana"), { pode: true });
});

test("risco crítico (preço) segue a mesma regra", () => {
  const v = podeExecutar(proposta({ tipo: "preco", risco: "critico" }), "loja-A", AGORA, {}, "bruno");
  assert.equal(v.pode, false);
});

test("risco médio (título/descrição): outro usuário do tenant executa — é reversível", () => {
  const v = podeExecutar(proposta({ tipo: "titulo", risco: "medio" }), "loja-A", AGORA, {}, "bruno");
  assert.deepEqual(v, { pode: true });
});

test("tenant vem ANTES de autoria: outro tenant responde outro_tenant, não outro_usuario", () => {
  const v = podeExecutar(proposta({}), "loja-B", AGORA, {}, "bruno");
  assert.deepEqual(v, { pode: false, impedimento: { motivo: "outro_tenant" } });
});

test("sem usuário na sessão (demo) ou sem informar, a checagem não roda — declarado, não escondido", () => {
  assert.deepEqual(podeExecutar(proposta({}), "loja-A", AGORA, {}, null), { pode: true });
  assert.deepEqual(podeExecutar(proposta({}), "loja-A", AGORA, {}), { pode: true });
});

test("proposta legada sem criadaPor não é bloqueada", () => {
  assert.deepEqual(podeExecutar(proposta({ criadaPor: "" }), "loja-A", AGORA, {}, "bruno"), { pode: true });
});

test("a frase manda pedir de novo na própria conversa, sem revelar quem criou", () => {
  const f = explicarImpedimento({ motivo: "outro_usuario" });
  assert.match(f, /outra pessoa/);
  assert.doesNotMatch(f, /ana/);
});

test("a rota passa o usuário da sessão para podeExecutar", () => {
  const rota = readFileSync(new URL("../../../app/api/assistente/proposta/route.ts", import.meta.url), "utf8")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.match(rota, /podeExecutar\(\s*proposta,\s*clienteDaSessao,\s*new Date\(\)\.toISOString\(\),\s*estadoAtual,\s*usuario\s*\)/);
});
