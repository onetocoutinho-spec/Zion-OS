// A falha de um turno sobrevive ao recarregamento.
//
// ===========================================================================
// O MESMO DEFEITO, UM CAMPO AO LADO
// ===========================================================================
//
// O cabeçalho de `conversaGuardada` já registra este defeito uma vez: `resposta`
// não era gravada, então toda resposta do caminho barato sumia no F5 e a tela
// ficava com o spinner girando para sempre. Foi visto num print da conta real
// em 03/08/2026 — quatro perguntas travadas.
//
// Em 05/08/2026, outro print, quatro perguntas, e a linha cinza:
//
//     A resposta desta pergunta não chegou. Pergunte de novo.
//
// `erro` não era gravado. Um turno que falhava recebia uma mensagem que DIZIA o
// que aconteceu — "A resposta foi interrompida no meio", ou o que o provedor
// devolveu — e o primeiro recarregamento a trocava por aquela linha, que não
// diz nada e manda digitar tudo de novo.
//
// O custo real é duplo:
//
//   1. para a lojista, uma recusa sem motivo e sem caminho;
//   2. para quem conserta, a evidência apagada pelo próprio cache. O diagnóstico
//      de 05/08 foi feito por eliminação porque a mensagem já não existia.
//
// E há a outra metade: a gravação roda A CADA MUDANÇA, então a pergunta entra no
// disco ANTES de existir resposta. Recarregar naquele intervalo deixava um turno
// sem resposta e sem erro — permanentemente cinza, culpando a PERGUNTA por algo
// que aconteceu com a PÁGINA.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  paraGuardar,
  lerGuardada,
  INTERROMPIDO,
  VERSAO_ATUAL,
  type TurnoGuardado,
} from "./conversaGuardada.ts";

/** Grava e lê de volta, como o navegador faz. */
function ida_e_volta(turnos: readonly TurnoGuardado[]) {
  const bruto = JSON.stringify(paraGuardar(turnos, []));
  const lido = lerGuardada(bruto);
  assert.ok(lido, "a conversa não voltou do disco");
  return lido.turnos;
}

// ── O erro sobrevive ────────────────────────────────────────────────────────

test("a mensagem de falha atravessa o disco", () => {
  const [t] = ida_e_volta([
    { pergunta: "o que falta no Moleca 5556?", erro: "A resposta foi interrompida no meio." },
  ]);
  assert.equal(t.erro, "A resposta foi interrompida no meio.");
});

test("a mensagem do PROVEDOR atravessa — é a que diz o motivo real", () => {
  // Uma falha de saldo, de limite ou de modelo indisponível chega como texto do
  // provedor. Perder isso é perder o único diagnóstico que existia.
  const [t] = ida_e_volta([{ pergunta: "quantos sem peso?", erro: "Sem crédito na conta." }]);
  assert.match(String(t.erro), /crédito/);
});

test("um turno que FALHOU não volta como a linha cinza", () => {
  const [t] = ida_e_volta([{ pergunta: "x", erro: "Não consegui responder agora." }]);
  assert.notEqual(t.erro, INTERROMPIDO, "o erro real foi trocado pela mensagem genérica");
});

// ── O turno pego no meio do voo ─────────────────────────────────────────────

test("sem resposta e sem erro, a leitura diz que foi a PÁGINA", () => {
  // Não é palpite: um turno que terminou tem texto, resposta ou erro. Não ter
  // nenhum dos três só acontece de um jeito.
  const [t] = ida_e_volta([{ pergunta: "quantos produtos estão sem peso?" }]);
  assert.equal(t.erro, INTERROMPIDO);
  assert.match(String(t.erro), /página/, "a mensagem culpa a pergunta em vez da página");
});

test("a pergunta digitada NÃO é jogada fora", () => {
  // Descartar o turno resolveria a mentira e perderia o que ela escreveu.
  const [t] = ida_e_volta([{ pergunta: "muda o preço do Moleca para 89,90" }]);
  assert.equal(t.pergunta, "muda o preço do Moleca para 89,90");
});

// ── O que NÃO pode ser marcado como interrompido ────────────────────────────

test("um turno com TEXTO está terminado", () => {
  const [t] = ida_e_volta([{ pergunta: "x", texto: "48 de 80 produtos." }]);
  assert.equal(t.erro, undefined);
});

test("texto VAZIO conta como terminado — o cartão respondeu", () => {
  // `""` é o modelo que respondeu só com cartão. Tratar como interrompido poria
  // "a página saiu do ar" embaixo de uma resposta que está ali na tela.
  const [t] = ida_e_volta([{ pergunta: "x", texto: "", resposta: undefined }]);
  assert.equal(t.erro, undefined, "um turno com texto vazio foi chamado de interrompido");
});

test("um turno com RESPOSTA (o cartão) está terminado", () => {
  const [t] = ida_e_volta([
    { pergunta: "x", resposta: { tipo: "numero", frase: "48 de 80", quantos: 48, total: 80 } },
  ]);
  assert.equal(t.erro, undefined);
});

test("uma conversa inteira volta com cada turno no seu estado", () => {
  const turnos = ida_e_volta([
    { pergunta: "1", texto: "respondi" },
    { pergunta: "2", erro: "falhei, e por isto" },
    { pergunta: "3" },
    { pergunta: "4", resposta: { tipo: "nada_travado", frase: "Nada travado." } },
  ]);
  assert.equal(turnos[0].erro, undefined);
  assert.equal(turnos[1].erro, "falhei, e por isto");
  assert.equal(turnos[2].erro, INTERROMPIDO);
  assert.equal(turnos[3].erro, undefined);
});

// ── O que já era garantido continua ─────────────────────────────────────────

test("versão antiga continua sendo descartada inteira", () => {
  assert.equal(lerGuardada(JSON.stringify({ versao: VERSAO_ATUAL - 1, turnos: [], falas: [] })), null);
});

test("uma conversa gravada SEM o campo erro continua abrindo", () => {
  // O formato não mudou de versão de propósito: `erro` é opcional, então o que
  // está no disco de quem já usava o sistema continua válido. Subir a versão
  // apagaria a conversa de todo mundo para acrescentar um campo.
  const antiga = { versao: VERSAO_ATUAL, turnos: [{ pergunta: "x", texto: "y" }], falas: [] };
  const lido = lerGuardada(JSON.stringify(antiga));
  assert.ok(lido);
  assert.equal(lido.turnos[0].texto, "y");
});

test("a proposta continua NÃO atravessando", () => {
  // Um convite a gravar não pode ser aceito amanhã contra um produto que mudou.
  const bruto = JSON.stringify(
    paraGuardar([{ pergunta: "x", texto: "y", ...{ proposta: { campo: "peso" } } }], [])
  );
  assert.ok(!/proposta/.test(bruto), "a proposta voltou a ser gravada");
});
