// INC-003 — a primeira ação de um turno é uma CONSULTA, e não uma frase.
//
// O caso que originou isto: o agente respondeu à Leilane que a Rasteira Vizzano
// tinha "2 variações sem peso", que o peso médio era "300 g" e que havia
// "preparado um cartão". O real era 3, 410 g e nenhuma proposta — e ele não
// chamou ferramenta nenhuma. O prompt já proibia; proibir não impede.
//
// A prova aqui é ESTRUTURAL, e é de propósito. Procurar "2", "300" ou "cartão"
// no texto fecharia a reprodução, não a classe: o modelo pode inventar sem
// dígito, e o operador pode citar um número legítimo. O que fecha a classe é
// não deixar o primeiro movimento ser texto.

import { test } from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../../../testing/lerFonte.ts";
import {
  FERRAMENTAS,
  FERRAMENTAS_DE_LEITURA,
  FERRAMENTAS_DE_PROPOSTA,
  FERRAMENTAS_DE_RASCUNHO,
  PRIMEIRA_ACAO,
} from "./ferramentasDoAssistente.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) => lerFonte(new URL(rel, raiz), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ROTA = semComentarios(ler("app/api/assistente/conversa/route.ts"));
const CLIENTE = semComentarios(ler("lib/agentes/conversaComFerramentas.ts"));

/** As seis que produzem efeito — proposta persistida ou rascunho gravado. */
const COM_EFEITO = [...FERRAMENTAS_DE_PROPOSTA, ...FERRAMENTAS_DE_RASCUNHO].map((f) => f.nome);

// ---------------------------------------------------------------------------
// T2 · T3 — o conjunto da primeira ação
// ---------------------------------------------------------------------------

test("T2: a primeira ação admite exatamente as 10 ferramentas de leitura", () => {
  assert.equal(PRIMEIRA_ACAO.length, 10);
  assert.deepEqual([...PRIMEIRA_ACAO].sort(), [...FERRAMENTAS_DE_LEITURA.map((f) => f.nome)].sort());
});

test("T2: são exatamente estas dez — a matriz que autorizou a decisão", () => {
  assert.deepEqual([...PRIMEIRA_ACAO].sort(), [
    "achar_produto",
    "contar",
    "estado_da_loja",
    "o_que_falta_no_produto",
    "o_que_impede",
    "pendencias",
    "preparacao_de_anuncio",
    "pricing",
    "procedencia",
    "proximo_passo",
  ]);
});

test("T3: NENHUMA das seis com efeito pode ser a primeira ação", () => {
  assert.equal(COM_EFEITO.length, 6);
  for (const nome of COM_EFEITO) {
    assert.ok(
      !PRIMEIRA_ACAO.includes(nome),
      `"${nome}" tem efeito e entrou na primeira ação — um "obrigado" poderia deixar um cartão na tela`
    );
  }
});

test("T3: a lista é DERIVADA de `efeito`, não copiada à mão", () => {
  // Uma ferramenta nova classificada como `propoe` tem que ficar de fora
  // sozinha, sem ninguém lembrar de editar uma segunda lista.
  for (const nome of PRIMEIRA_ACAO) {
    assert.equal(FERRAMENTAS.find((f) => f.nome === nome)?.efeito, "le");
  }
});

test("PRIMEIRA_ACAO ⊂ nomes das 16", () => {
  const todas = new Set(FERRAMENTAS.map((f) => f.nome));
  for (const nome of PRIMEIRA_ACAO) assert.ok(todas.has(nome));
});

// ---------------------------------------------------------------------------
// T1 · T4 · T5 — a configuração por passo
// ---------------------------------------------------------------------------

test("T1: o passo 0 é `obrigado` com as leituras", () => {
  assert.match(ROTA, /passo === 0\s*\?\s*\{\s*modo:\s*"obrigado",\s*permitidas:\s*PRIMEIRA_ACAO\s*\}/);
});

test("T4: os passos seguintes são `livre`", () => {
  assert.match(ROTA, /:\s*\{\s*modo:\s*"livre"\s*\}/);
});

test("T1: `obrigado` vira ANY + allowedFunctionNames no corpo da requisição", () => {
  assert.match(CLIENTE, /mode:\s*"ANY"/);
  assert.match(CLIENTE, /allowedFunctionNames:/);
});

test("T4: `livre` vira AUTO", () => {
  assert.match(CLIENTE, /mode:\s*"AUTO"/);
});

test("T5: as 16 DECLARAÇÕES continuam em todo passo — muda a escolha, não a oferta", () => {
  assert.match(CLIENTE, /functionDeclarations:\s*paraDeclaracoesGemini\(ferramentas\)/);
  assert.match(ROTA, /FERRAMENTAS,/);
});

// ---------------------------------------------------------------------------
// T6 · T7 — a trajetória leitura → proposta continua viva
// ---------------------------------------------------------------------------

test("T6: o functionResponse da leitura volta ao modelo", () => {
  assert.match(ROTA, /respostas\.push\(\{\s*functionResponse:/);
  assert.match(ROTA, /historico\.push\(\{\s*role:\s*"user",\s*parts:\s*respostas\s*\}\)/);
});

test("T7: a restrição vale SÓ no passo 0 — depois a proposta é alcançável", () => {
  // Se a condição fosse por outra coisa que não `passo === 0`, a trajetória
  // leitura → proposta morreria e o C1R reprovaria.
  const ocorrencias = ROTA.match(/modo:\s*"obrigado"/g) ?? [];
  assert.equal(ocorrencias.length, 1, "a obrigação apareceu em mais de um lugar");
  assert.match(ROTA, /passo === 0\s*\?/);
});

// ---------------------------------------------------------------------------
// T9 · T10 · T12 — o que NÃO mudou
// ---------------------------------------------------------------------------

test("T10: o teto de passos continua 6", async () => {
  const { MAXIMO_DE_PASSOS } = await import("../../../lib/agentes/conversaComFerramentas.ts");
  assert.equal(MAXIMO_DE_PASSOS, 6);
});

test("T12: nenhuma ferramenta foi removida, acrescentada ou reclassificada", () => {
  assert.equal(FERRAMENTAS.length, 16);
  assert.equal(FERRAMENTAS_DE_LEITURA.length, 10);
  assert.equal(FERRAMENTAS_DE_RASCUNHO.length, 1);
  assert.equal(FERRAMENTAS_DE_PROPOSTA.length, 5);
});

test("T12: modelo e temperatura intactos", () => {
  assert.match(CLIENTE, /GEMINI_MODELO_CONVERSA\s*\?\?\s*"gemini-2\.5-flash"/);
  assert.match(CLIENTE, /temperature:\s*0/);
});

// ---------------------------------------------------------------------------
// T11 — defesa quando ANY não entrega chamada
// ---------------------------------------------------------------------------

test("T11: passo 0 sem chamada NÃO entrega o texto do modelo", () => {
  assert.match(ROTA, /passo === 0 && turno\.chamadas\.length === 0/);
  const bloco = ROTA.slice(ROTA.indexOf("passo === 0 && turno.chamadas.length === 0"));
  const ate = bloco.slice(0, bloco.indexOf("controlador.close()"));
  assert.ok(!ate.includes("turno.texto"), "o texto inventado vazou para a resposta");
});

test("T11: a frase de defesa não afirma nada sobre a loja", () => {
  const bloco = ROTA.slice(ROTA.indexOf("passo === 0 && turno.chamadas.length === 0"));
  const frase = bloco.slice(bloco.indexOf("texto:"), bloco.indexOf("falas:"));
  assert.ok(!/\d/.test(frase), "a frase de defesa tem número");
  for (const proibido of ["cartão", "produto", "pendência", "encontrei", "variaç"]) {
    assert.ok(!frase.toLowerCase().includes(proibido), `a frase afirma "${proibido}"`);
  }
});

// ---------------------------------------------------------------------------
// T8 · T9 — o cartão continua vindo do estado, não do texto
// ---------------------------------------------------------------------------

test("T8/T9: a proposta só atravessa COM id — texto nenhum cria cartão", () => {
  assert.match(ROTA, /proposta && propostaId \? \{ proposta, propostaId \}/);
  assert.match(ROTA, /escopoDoLote && propostaId/);
});

test("a correção não introduziu regex sobre a prosa do modelo", () => {
  // A fronteira é de protocolo. Se alguém acrescentar uma varredura textual
  // como enforcement, este teste é o lugar de discutir isso primeiro.
  const suspeitas = ROTA.match(/turno\.texto\.(match|includes|test|replace|search)/g) ?? [];
  assert.deepEqual(suspeitas, []);
});
