// O TURNO NÃO PODE MORRER EM SILÊNCIO.
//
// ===========================================================================
// O QUE ACONTECEU EM 24/08/2026
// ===========================================================================
//
// A lojista digitou "Analisa a papete modare" e leu:
//
//     ⚠️ A resposta foi interrompida no meio.
//
// Medido no banco logo depois: NENHUMA linha em `ia_execucoes`, NENHUMA
// mensagem em `copilot_mensagens`. O turno não falhou — ele desapareceu. A
// plataforma matou a função no `maxDuration` de 60 s, e a função morre sem
// passar por catch nenhum: o stream fecha sem o evento `fim`, e o cliente só
// sabe dizer que a resposta acabou no meio.
//
// Duas coisas do mesmo dia empurraram o turno para além dos 60 s: o catálogo
// de ferramentas foi de 28 para 34 (todas viajam em toda chamada ao modelo) e
// o modelo passou a ser o gpt-5, que raciocina antes de responder.
//
// O mecanismo de parada honesta JÁ EXISTIA e não teve chance de disparar: ele
// tinha 45 s de orçamento contra 60 de teto, e a corrida foi ganha pela
// plataforma. E ele só olhava o relógio ENTRE passos — um passo com quatro
// ferramentas rodava as quatro sem verificar nada.
//
// Este arquivo guarda as duas correções.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROTA = readFileSync(
  new URL("../../../app/api/assistente/conversa/route.ts", import.meta.url),
  "utf8"
);

function numeroDe(nome: string): number {
  const m = new RegExp(`${nome} = ([0-9_]+)`).exec(ROTA);
  if (!m) throw new Error(`não achei ${nome}`);
  return Number(m[1].replace(/_/g, ""));
}

test("o orçamento do laço cabe DENTRO do teto da função, com folga real", () => {
  const teto = numeroDe("export const maxDuration") * 1000;
  const orcamento = numeroDe("const ORCAMENTO_DO_LACO_MS");
  assert.ok(orcamento < teto, "o orçamento precisa ser menor que o teto — senão quem para é a plataforma");
  // A folga precisa caber a chamada de modelo mais longa que ainda pode
  // COMEÇAR depois da última verificação. Medida em ~35 s com o gpt-5.
  const folga = teto - orcamento;
  assert.ok(folga >= 40_000, `folga de ${folga}ms é curta para uma chamada de modelo que já começou`);
});

test("o relógio é olhado ANTES DE CADA FERRAMENTA, não só entre passos", () => {
  // O buraco de 24/08: um passo com quatro ferramentas rodava as quatro sem
  // verificar. Se a terceira fosse lenta, o turno atravessava o teto inteiro
  // dentro de um passo que já tinha sido autorizado.
  const dentroDoLaco = ROTA.slice(ROTA.indexOf("for (const c of turno.chamadas)"));
  const iVerificacao = dentroDoLaco.indexOf("estourouOTempo(relogio.ms())");
  const iExecucao = dentroDoLaco.indexOf("await executarFerramenta(");
  assert.ok(iVerificacao > 0, "sumiu a verificação por ferramenta");
  assert.ok(iVerificacao < iExecucao, "a verificação precisa vir antes de executar a ferramenta");
  assert.match(dentroDoLaco.slice(0, iExecucao), /semTempo = true;\s*\n\s*break;/);
});

test("as duas verificações usam a MESMA regra — duas cópias divergiriam", () => {
  assert.match(ROTA, /function estourouOTempo\(msDecorridos: number\): boolean \{\s*\n\s*return msDecorridos > ORCAMENTO_DO_LACO_MS;/);
  const usos = [...ROTA.matchAll(/estourouOTempo\(relogio\.ms\(\)\)/g)];
  assert.equal(usos.length, 2, "entre passos e antes de cada ferramenta");
  // E nenhuma comparação solta sobrou.
  assert.doesNotMatch(ROTA, /relogio\.ms\(\) > ORCAMENTO_DO_LACO_MS/, "voltou uma comparação à mão");
});

test("estourar o tempo GRAVA o turno e registra a execução — é o que faltou no caso real", () => {
  const estouro = ROTA.slice(ROTA.indexOf("const textoDoEstouro"));
  assert.match(estouro, /registrar\(\s*\n?\s*semTempo \? "timeout" : "parcial"/);
  assert.match(estouro, /gravarTurno\(/);
  assert.match(estouro, /tipo: "fim"/, "o cliente precisa do `fim`, senão lê 'interrompida no meio'");
});
