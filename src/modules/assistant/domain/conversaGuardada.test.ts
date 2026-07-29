import test from "node:test";
import assert from "node:assert/strict";

import {
  chaveDaConversa,
  lerGuardada,
  paraGuardar,
  TURNOS_GUARDADOS,
  VERSAO_ATUAL,
  type TurnoGuardado,
} from "./conversaGuardada";

const turno = (n: number): TurnoGuardado => ({ pergunta: `p${n}`, texto: `r${n}` });

test("a chave separa clientes", () => {
  assert.notEqual(chaveDaConversa("a"), chaveDaConversa("b"));
  assert.match(chaveDaConversa("a"), /zion:conversa:/);
});

test("guarda ida e volta", () => {
  const g = paraGuardar([turno(1), turno(2)], [{ role: "user" }]);
  const lida = lerGuardada(JSON.stringify(g));
  assert.ok(lida);
  assert.equal(lida.turnos.length, 2);
  assert.equal(lida.turnos[1].pergunta, "p2");
  assert.equal(lida.falas.length, 1);
});

test("a PROPOSTA não atravessa o recarregamento", () => {
  // Um convite a gravar guardado em disco pode ser aceito amanhã, contra um
  // produto que mudou. Confirmação é coisa da sessão em que foi oferecida.
  const comProposta = {
    pergunta: "o chinelo pesa 300g",
    proposta: { tipo: "pronta", valor: 300 },
  } as unknown as TurnoGuardado;
  const g = paraGuardar([comProposta], []);
  assert.equal(JSON.stringify(g).includes("proposta"), false);
});

test("o desfecho de uma gravação atravessa — ele já aconteceu", () => {
  const t: TurnoGuardado = {
    pergunta: "grava",
    desfecho: { ok: true, mensagem: "Pronto. 300 g gravados." },
  };
  const lida = lerGuardada(JSON.stringify(paraGuardar([t], [])));
  assert.equal(lida?.turnos[0].desfecho?.ok, true);
});

test("conversa longa é cortada pelo começo, não estourada", () => {
  // Cota estourada faz a gravação falhar em silêncio e a pessoa perde TUDO.
  // Perder os turnos velhos é melhor que perder a conversa inteira.
  const muitos = Array.from({ length: TURNOS_GUARDADOS + 25 }, (_, i) => turno(i));
  const g = paraGuardar(muitos, []);
  assert.equal(g.turnos.length, TURNOS_GUARDADOS);
  // Os que sobram são os RECENTES — o começo é o que se perde.
  assert.equal(g.turnos[g.turnos.length - 1].pergunta, `p${TURNOS_GUARDADOS + 24}`);
});

test("versão diferente é descartada em vez de tentar migrar", () => {
  const antiga = JSON.stringify({ versao: VERSAO_ATUAL - 1, turnos: [turno(1)], falas: [] });
  assert.equal(lerGuardada(antiga), null);
});

test("lixo no storage não derruba a tela", () => {
  // Uma conversa perdida é aborrecimento; uma tela que não abre por causa de
  // lixo de três meses atrás é chamado de suporte.
  for (const lixo of [null, "", "{", "null", "[]", '{"versao":1}', '{"versao":1,"turnos":"x","falas":[]}']) {
    assert.doesNotThrow(() => lerGuardada(lixo));
    assert.equal(lerGuardada(lixo), null, String(lixo));
  }
});

test("turno sem pergunta é descartado, não vira bolha vazia", () => {
  const cru = JSON.stringify({
    versao: VERSAO_ATUAL,
    turnos: [{ texto: "resposta órfã" }, turno(1)],
    falas: [],
  });
  const lida = lerGuardada(cru);
  assert.equal(lida?.turnos.length, 1);
  assert.equal(lida?.turnos[0].pergunta, "p1");
});

test("campos ausentes não viram undefined explícito no JSON", () => {
  // `{"texto":undefined}` não existe em JSON, mas `{"texto":null}` sim — e
  // `null` chegaria na tela como conteúdo.
  const g = paraGuardar([{ pergunta: "só a pergunta" }], []);
  const bruto = JSON.stringify(g);
  assert.equal(bruto.includes("null"), false);
});
