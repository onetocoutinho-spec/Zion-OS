// Testes do progresso parcial da geração.
//
// O defeito: a esteira roda 10 agentes de IA em sequência no navegador e só
// grava o anúncio no fim. Sair no meio perdia tudo — com a cota já consumida.
// Rodar: npx tsx --test src/modules/publication/domain/progressoGeracao.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  chaveProgresso,
  etapasRetomaveis,
  impressaoDoBriefing,
  lerProgresso,
  prefixoDaOrdem,
  VALIDADE_HORAS,
  type ProgressoGeracao,
} from "./progressoGeracao.ts";

const ORDEM = ["A0", "A1", "A2", "A9", "A3"];
const AGORA = "2026-07-27T12:00:00.000Z";
const IMPRESSAO = impressaoDoBriefing("briefing do produto");

function alvo(over: Partial<Parameters<typeof etapasRetomaveis>[1]> = {}) {
  return { produtoId: "p1", impressaoBriefing: IMPRESSAO, ordem: ORDEM, agora: AGORA, ...over };
}

function progresso(over: Partial<ProgressoGeracao> = {}): ProgressoGeracao {
  return {
    produtoId: "p1",
    impressaoBriefing: IMPRESSAO,
    atualizadoEm: "2026-07-27T11:30:00.000Z",
    etapas: [
      { codigo: "A0", markdown: "diagnóstico" },
      { codigo: "A1", markdown: "pesquisa" },
      { codigo: "A2", markdown: "título" },
    ],
    ...over,
  };
}

test("sem progresso guardado, começa do zero", () => {
  assert.deepEqual(etapasRetomaveis(null, alvo()), []);
});

test("retoma o que já ficou pronto", () => {
  const r = etapasRetomaveis(progresso(), alvo());
  assert.deepEqual(
    r.map((e) => e.codigo),
    ["A0", "A1", "A2"]
  );
  assert.equal(r[2].markdown, "título");
});

test("progresso de OUTRO produto não é aproveitado", () => {
  assert.deepEqual(etapasRetomaveis(progresso({ produtoId: "p2" }), alvo()), []);
});

test("briefing mudou → o trabalho guardado descreve outro produto", () => {
  // Mesmo id, mas preço/nome/estoque mudaram: costurar o anúncio novo em cima
  // do dossiê velho produziria texto sobre dados que não existem mais.
  const outro = impressaoDoBriefing("briefing do produto com preço novo");
  assert.notEqual(outro, IMPRESSAO);
  assert.deepEqual(etapasRetomaveis(progresso(), alvo({ impressaoBriefing: outro })), []);
});

test("passou da validade → refaz", () => {
  const velho = progresso({ atualizadoEm: "2026-07-26T11:00:00.000Z" }); // 25h
  assert.ok(25 > VALIDADE_HORAS);
  assert.deepEqual(etapasRetomaveis(velho, alvo()), []);
});

test("dentro da validade, mesmo por pouco, aproveita", () => {
  const limite = progresso({ atualizadoEm: "2026-07-26T12:30:00.000Z" }); // 23h30
  assert.equal(etapasRetomaveis(limite, alvo()).length, 3);
});

test("data no futuro é tão suspeita quanto data velha", () => {
  const futuro = progresso({ atualizadoEm: "2026-07-28T12:00:00.000Z" });
  assert.deepEqual(etapasRetomaveis(futuro, alvo()), []);
});

test("data ilegível não vira retomada", () => {
  assert.deepEqual(etapasRetomaveis(progresso({ atualizadoEm: "ontem" }), alvo()), []);
});

test("buraco no meio corta ali — só se aproveita PREFIXO", () => {
  // A9 existe, mas A2 falta. A entrega de A9 foi escrita respondendo a um
  // dossiê que continha A2; sem A2 ela vira resposta a uma pergunta que ninguém
  // fez. Melhor refazer A2 em diante do que montar um dossiê inédito.
  const furado = progresso({
    etapas: [
      { codigo: "A0", markdown: "d" },
      { codigo: "A1", markdown: "p" },
      { codigo: "A9", markdown: "fora de contexto" },
    ],
  });
  assert.deepEqual(
    etapasRetomaveis(furado, alvo()).map((e) => e.codigo),
    ["A0", "A1"]
  );
});

test("entrega vazia conta como não-feita", () => {
  const vazio = progresso({
    etapas: [
      { codigo: "A0", markdown: "d" },
      { codigo: "A1", markdown: "   " },
      { codigo: "A2", markdown: "t" },
    ],
  });
  assert.deepEqual(
    etapasRetomaveis(vazio, alvo()).map((e) => e.codigo),
    ["A0"]
  );
});

test("a ordem de gravação não manda — a ordem canônica manda", () => {
  const embaralhado = progresso({
    etapas: [
      { codigo: "A2", markdown: "t" },
      { codigo: "A0", markdown: "d" },
      { codigo: "A1", markdown: "p" },
    ],
  });
  assert.deepEqual(
    etapasRetomaveis(embaralhado, alvo()).map((e) => e.codigo),
    ["A0", "A1", "A2"]
  );
});

test("esteira inteira guardada retoma inteira", () => {
  const tudo = progresso({ etapas: ORDEM.map((c) => ({ codigo: c, markdown: c })) });
  assert.equal(etapasRetomaveis(tudo, alvo()).length, ORDEM.length);
});

test("lerProgresso não confia no que veio do storage", () => {
  assert.equal(lerProgresso(null), null);
  assert.equal(lerProgresso(""), null);
  assert.equal(lerProgresso("{não é json"), null);
  assert.equal(lerProgresso("[]"), null);
  assert.equal(lerProgresso('"texto"'), null);
  assert.equal(lerProgresso("null"), null);
  assert.equal(lerProgresso(JSON.stringify({ produtoId: "p1" })), null); // sem o resto
  assert.equal(lerProgresso(JSON.stringify({ ...progresso(), etapas: "x" })), null);
});

test("lerProgresso descarta etapas malformadas mas mantém as boas", () => {
  const bruto = JSON.stringify({
    ...progresso(),
    etapas: [{ codigo: "A0", markdown: "d" }, { codigo: 7 }, null, { markdown: "sem código" }],
  });
  const lido = lerProgresso(bruto);
  assert.deepEqual(lido?.etapas, [{ codigo: "A0", markdown: "d" }]);
});

test("ida e volta pelo JSON preserva o que importa", () => {
  const p = progresso();
  assert.deepEqual(lerProgresso(JSON.stringify(p)), p);
});

test("a impressão do briefing é estável e ignora espaços das pontas", () => {
  assert.equal(impressaoDoBriefing("abc"), impressaoDoBriefing("abc"));
  assert.equal(impressaoDoBriefing("  abc  "), impressaoDoBriefing("abc"));
  assert.notEqual(impressaoDoBriefing("abc"), impressaoDoBriefing("abd"));
  assert.match(impressaoDoBriefing("qualquer coisa"), /^[0-9a-f]{8}$/);
});

// A peneira do prefixo é aplicada DUAS vezes: em quem monta a retomada e no
// motor da esteira, que recebe a lista de fora. Testada aqui, vale nos dois.
test("prefixoDaOrdem corta na primeira ausência, mesmo com etapas depois", () => {
  const soltas = [
    { codigo: "A0", markdown: "d" },
    { codigo: "A3", markdown: "solta" },
    { codigo: "A9", markdown: "solta" },
  ];
  assert.deepEqual(
    prefixoDaOrdem(soltas, ORDEM).map((e) => e.codigo),
    ["A0"]
  );
});

test("prefixoDaOrdem: lista vazia e ordem vazia não inventam nada", () => {
  assert.deepEqual(prefixoDaOrdem([], ORDEM), []);
  assert.deepEqual(prefixoDaOrdem([{ codigo: "A0", markdown: "d" }], []), []);
});

test("prefixoDaOrdem ignora código que não está na ordem", () => {
  // Uma esteira antiga gravou um agente que não existe mais: não pode entrar
  // no dossiê nem interromper o que é válido.
  const r = prefixoDaOrdem(
    [
      { codigo: "AX", markdown: "aposentado" },
      { codigo: "A0", markdown: "d" },
      { codigo: "A1", markdown: "p" },
    ],
    ORDEM
  );
  assert.deepEqual(
    r.map((e) => e.codigo),
    ["A0", "A1"]
  );
});

test("prefixoDaOrdem: código repetido usa a primeira entrega", () => {
  const r = prefixoDaOrdem(
    [
      { codigo: "A0", markdown: "primeira" },
      { codigo: "A0", markdown: "segunda" },
    ],
    ORDEM
  );
  assert.deepEqual(r, [{ codigo: "A0", markdown: "primeira" }]);
});

test("a chave de storage separa clientes no mesmo navegador", () => {
  assert.notEqual(chaveProgresso("cli-a"), chaveProgresso("cli-b"));
  assert.equal(chaveProgresso(""), "zion:esteira:progresso:sem-cliente");
});
