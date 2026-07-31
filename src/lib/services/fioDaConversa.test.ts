// INC-005 — a conversa do banco precisa ser um FIO, não uma linha por request.
//
// Oito conversas, um cliente, e `atualizada_em = criada_em` nas oito: o ramo de
// reúso de `garantirConversa` nunca executou. Não porque ele falhe — porque
// nunca recebia o id. O servidor devolvia `conversaId`, o serviço fazia parse, e
// o componente descartava.
//
// O que se prova aqui é o CORPO que sai na requisição, capturado por um `fetch`
// de mentira — o mesmo método do `gravarTurno.test.ts`. As propriedades que só
// existem dentro do React (hidratação, toggle, logout) estão declaradas no
// relatório como provadas por construção: `.test.tsx` é typechecado e NUNCA
// executado por `npm test`, então um teste de componente aqui daria uma
// segurança que não existe.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { conversar } from "./conversaDoAssistente.ts";
import {
  chaveDaConversa,
  chaveDoFio,
  lerGuardada,
  paraGuardar,
  VERSAO_ATUAL,
} from "../../modules/assistant/domain/conversaGuardada.ts";

const CLIENTE = "5074ae56-5f3a-4bc2-a3ad-d9f79ac8d53c";
const FIO = "2c2801e4-a284-4fde-91a8-fc86c414b6d7";
const OUTRO_FIO = "3d8af477-bad6-42c5-917b-84b71252718b";

const fetchOriginal = globalThis.fetch;
let corpo: Record<string, unknown> | null = null;
/** O `conversaId` que o servidor devolve neste teste. */
let idDoServidor: string | null = FIO;

/** Uma resposta em NDJSON, como a rota emite. */
function respostaDoServidor(): Response {
  const fim = {
    tipo: "fim",
    texto: "De nada!",
    falas: [{ role: "user", parts: [{ text: "obrigado" }] }],
    ferramentas: ["proximo_passo"],
    tokens: 10692,
    ...(idDoServidor ? { conversaId: idDoServidor } : {}),
  };
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(JSON.stringify(fim) + "\n"));
        c.close();
      },
    }),
    { status: 200 }
  );
}

beforeEach(() => {
  corpo = null;
  idDoServidor = FIO;
  globalThis.fetch = (async (_entrada: unknown, init?: { body?: unknown }) => {
    corpo = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
    return respostaDoServidor();
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

const CONTEXTO = { pergunta: { loja: {} }, produtos: [] } as never;

// ---------------------------------------------------------------------------
// T14 · T15 — o request
// ---------------------------------------------------------------------------

test("T14: o primeiro turno vai SEM conversaId — e a chave nem aparece", async () => {
  // `undefined` num JSON some, mas quero que a ausência seja intencional e não
  // um `conversaId: null` que o servidor teria de interpretar.
  await conversar("obrigado", [], CONTEXTO);
  assert.ok(corpo);
  assert.ok(!("conversaId" in corpo!), "mandou a chave sem ter id");
});

test("T15: com id em mãos, o request o envia", async () => {
  await conversar("obrigado", [], CONTEXTO, undefined, undefined, FIO);
  assert.equal(corpo!.conversaId, FIO);
});

test("T2: o segundo turno reenvia o MESMO id — é isto que junta o fio", async () => {
  const primeiro = await conversar("obrigado", [], CONTEXTO);
  assert.equal(primeiro.conversaId, FIO);
  // O componente guarda o que veio e devolve no turno seguinte.
  await conversar("e agora?", primeiro.falas, CONTEXTO, undefined, undefined, primeiro.conversaId);
  assert.equal(corpo!.conversaId, FIO);
});

test("o resto do corpo continua igual — nada foi deslocado", async () => {
  await conversar("obrigado", [], CONTEXTO, "Rasteira", undefined, FIO);
  assert.deepEqual(Object.keys(corpo!).sort(), [
    "contexto",
    "conversaId",
    "falas",
    "mensagem",
    "produtoAberto",
  ]);
  assert.equal(corpo!.mensagem, "obrigado");
  assert.equal(corpo!.produtoAberto, "Rasteira");
});

// ---------------------------------------------------------------------------
// T1 · T11 — o servidor é a autoridade sobre o id
// ---------------------------------------------------------------------------

test("T1: a resposta entrega o conversaId para o cliente guardar", async () => {
  const r = await conversar("obrigado", [], CONTEXTO);
  assert.equal(r.conversaId, FIO);
});

test("T11: id recusado pelo servidor é SUBSTITUÍDO pelo que ele devolveu", async () => {
  // É o caso do id inexistente, malformado ou de outro cliente:
  // `garantirConversa` ignora e cria — e o cliente tem que adotar o novo.
  idDoServidor = OUTRO_FIO;
  const r = await conversar("obrigado", [], CONTEXTO, undefined, undefined, FIO);
  assert.equal(corpo!.conversaId, FIO, "não foi o id antigo que viajou");
  assert.equal(r.conversaId, OUTRO_FIO, "o cliente não recebeu o id efetivo");
  assert.notEqual(r.conversaId, FIO);
});

test("servidor sem conversaId não inventa um", async () => {
  idDoServidor = null;
  const r = await conversar("obrigado", [], CONTEXTO);
  assert.equal(r.conversaId, undefined);
});

// ---------------------------------------------------------------------------
// T4 · T12 · T13 — a identidade fica FORA do histórico
// ---------------------------------------------------------------------------

test("T4: o cache de histórico não tem onde guardar conversaId", async () => {
  const guardado = paraGuardar([{ pergunta: "obrigado", texto: "De nada!" }], [{ x: 1 }]);
  assert.deepEqual(Object.keys(guardado).sort(), ["falas", "turnos", "versao"]);
  assert.ok(!JSON.stringify(guardado).includes(FIO));
});

test("T4: as duas chaves são distintas e nenhuma é prefixo ambíguo da outra", () => {
  // `localStorage` é compartilhado por abas; `sessionStorage` não. Guardar o id
  // na chave errada faria duas abas escreverem na MESMA conversa do banco.
  assert.equal(chaveDaConversa(CLIENTE), `zion:conversa:${CLIENTE}`);
  assert.equal(chaveDoFio(CLIENTE), `zion:conversa-id:${CLIENTE}`);
  assert.notEqual(chaveDaConversa(CLIENTE), chaveDoFio(CLIENTE));
});

test("as duas chaves são por CLIENTE — nunca globais", () => {
  const outro = "00000000-0000-4000-8000-000000000001";
  assert.notEqual(chaveDoFio(CLIENTE), chaveDoFio(outro));
  assert.ok(chaveDoFio(CLIENTE).endsWith(CLIENTE));
});

test("T12/T13: cache gravado ANTES do INC-005 continua legível, sem migração", () => {
  const antigo = JSON.stringify({
    versao: 1,
    turnos: [{ pergunta: "quantos sem custo?", texto: "43." }],
    falas: [{ role: "user", parts: [{ text: "quantos sem custo?" }] }],
  });
  const lido = lerGuardada(antigo);
  assert.ok(lido, "o cache antigo deixou de ser lido");
  assert.equal(lido!.turnos.length, 1);
  assert.equal(VERSAO_ATUAL, 1, "a versão mudou e invalidaria histórico sem necessidade");
});

// ---------------------------------------------------------------------------
// O que esta fase NÃO podia tocar
// ---------------------------------------------------------------------------

const raiz = new URL("../../", import.meta.url);
const ler = (rel: string) => readFileSync(new URL(rel, raiz), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ROTA = semComentarios(ler("app/api/assistente/conversa/route.ts"));
const CONVERSAS = semComentarios(ler("lib/services/copilotConversas.ts"));
const CHAT = semComentarios(ler("components/client-portal/ChatDaOperacao.tsx"));

test("T16: o backend não mudou — a rota continua lendo o id do corpo e devolvendo", () => {
  assert.match(ROTA, /garantirConversa\(clienteDaSessao, usuarioId, corpo\.conversaId \?\? null/);
  assert.match(ROTA, /\.\.\.\(conversaId \? \{ conversaId \} : \{\}\)/);
});

test("T17: o INC-004 continua de pé — payload homogêneo e erro lido", () => {
  assert.match(CONVERSAS, /ferramentas: \[\]/);
  assert.match(CONVERSAS, /const \{ error \} = await getSupabaseAdmin\(\)/);
  assert.match(CONVERSAS, /if \(error\)/);
  assert.match(ROTA, /void gravarTurno\(/);
});

test("T18: o C1R continua intacto", () => {
  assert.match(ROTA, /passo === 0\s*\?\s*\{\s*modo:\s*"obrigado",\s*permitidas:\s*PRIMEIRA_ACAO\s*\}/);
  assert.match(ROTA, /passo === 0 && turno\.chamadas\.length === 0/);
});

test("T20: nenhuma proposta ou execução nasceu desta mudança", () => {
  // O cartão continua atrelado ao `propostaId` do turno, e o id do FIO não
  // participa disso em lugar nenhum.
  assert.match(CHAT, /t\.proposta && t\.propostaId/);
  assert.ok(!/conversaId.*propostaId|propostaId.*conversaId/.test(CHAT));
});

test("M2 fora do escopo: nenhuma sincronização entre abas foi introduzida", () => {
  for (const proibido of ["BroadcastChannel", '"storage"', "navigator.locks", "tabId"]) {
    assert.ok(!CHAT.includes(proibido), `apareceu "${proibido}" — M2 entrou de carona`);
  }
});

test("o id vive em sessionStorage, nunca em localStorage", () => {
  // É a invariante que sustenta M1. Se alguém mover a chave do fio para
  // `localStorage`, duas abas independentes passam a escrever na mesma conversa.
  assert.match(CHAT, /sessionStorage\.setItem\(chaveDoFio/);
  assert.match(CHAT, /sessionStorage\.getItem\(chaveDoFio/);
  assert.match(CHAT, /sessionStorage\.removeItem\(chaveDoFio/);
  assert.ok(!/localStorage\.\w+\(chaveDoFio/.test(CHAT), "o id do fio foi parar no localStorage");
});
