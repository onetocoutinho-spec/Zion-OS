// INC-005 / B11 — `ultimaApresentacao` e `draftAbertoDaConversa`.
//
// ===========================================================================
// O QUE ESTE ARQUIVO FECHA, E O QUE ELE NÃO PODE FECHAR
// ===========================================================================
//
// As duas funções eram INERTES POR CONSTRUÇÃO: `conversaId` nunca chegava ao
// servidor, então ambas filtravam por uma conversa recém-criada e devolviam
// vazio — indistinguível de "não havia nada". O INC-005 corrigiu o fio, e elas
// voltaram a ser ALCANÇÁVEIS. Nunca foram exercitadas.
//
// A cadeia da referência estruturada é esta:
//
//   gerenciar_cadastro apresenta
//     → paraMetadata            ✅ testado (referenciasDaConversa.test)
//     → gravarTurno grava       ✅ testado (gravarTurno.test)
//     → ultimaApresentacao lê   ← ESTE ARQUIVO
//     → conjuntoVigente         ✅ testado
//     → resolverEscolha → id    ✅ testado
//
// Só as duas leitoras não tinham teste nenhum. Com elas, a cadeia fica provada
// POR CONSTRUÇÃO de ponta a ponta.
//
// O QUE CONTINUA IMPOSSÍVEL: observar em produção. Medido em 2026-08-01 —
// `copilot_cadastros` tem ZERO linhas e `copilot_mensagens` tem ZERO com
// `metadata`. Produzir uma exigiria iniciar um cadastro de produto na área de
// trabalho da lojista com uma intenção inventada, deixando resíduo operacional
// visível para ela. Isso não se faz por causa de um teste.
//
// Então: PROVADO POR TESTE, e segue NÃO OBSERVADO EM PRODUÇÃO. A distinção é o
// ponto — não a apago escrevendo "validado".

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "chave-de-teste-nao-e-segredo";

import { ultimaApresentacao } from "./copilotConversas.ts";
import { draftAbertoDaConversa } from "./copilotCadastros.ts";

const CLIENTE = "5074ae56-5f3a-4bc2-a3ad-d9f79ac8d53c";
const CONVERSA = "2c2801e4-a284-4fde-91a8-fc86c414b6d7";
const OUTRO_CLIENTE = "11111111-2222-4333-8444-555555555555";

const fetchOriginal = globalThis.fetch;
const erroOriginal = console.error;
let urls: string[] = [];
let logado: unknown[][] = [];
let responder: () => Response = () =>
  new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });

const json = (corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const recusa = () =>
  new Response(JSON.stringify({ code: "42501", message: "permission denied" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  urls = [];
  logado = [];
  responder = () => json([]);
  globalThis.fetch = (async (entrada: unknown) => {
    urls.push(typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url));
    return responder();
  }) as unknown as typeof fetch;
  console.error = (...a: unknown[]) => void logado.push(a);
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
  console.error = erroOriginal;
});

const decodificada = () => decodeURIComponent(urls[0] ?? "");

// ---------------------------------------------------------------------------
// ultimaApresentacao — a lista que faz "o segundo" ter referente
// ---------------------------------------------------------------------------

test("filtra por TENANT e por conversa — os dois, sempre", () => {
  // O tenant na consulta é o que torna verdadeira a frase do INC-005: "uma
  // conversa de outro cliente não devolve candidatos — devolve nada, que é
  // indistinguível de não haver". Sem ele, bastaria adivinhar um uuid.
  return ultimaApresentacao(CLIENTE, CONVERSA).then(() => {
    const u = decodificada();
    assert.match(u, /copilot_mensagens/);
    assert.match(u, new RegExp(`cliente_id=eq\\.${CLIENTE}`));
    assert.match(u, new RegExp(`conversa_id=eq\\.${CONVERSA}`));
  });
});

test("só a fala do ASSISTENTE, e só a ÚLTIMA", async () => {
  // A apresentação é do assistente; a fala do lojista nunca tem `metadata`.
  // E é a última porque "o segundo" se refere ao que acabou de ser mostrado —
  // uma lista de três turnos atrás resolveria contra o conjunto errado.
  await ultimaApresentacao(CLIENTE, CONVERSA);
  const u = decodificada();
  assert.match(u, /papel=eq\.assistente/);
  assert.match(u, /order=criada_em\.desc/);
  assert.match(u, /limit=1/);
});

test("devolve o metadata da linha — o elo que estava sem teste", async () => {
  const conjunto = { tipo: "produtos", itens: [{ id: "p1" }, { id: "p2" }] };
  responder = () => json([{ papel: "assistente", metadata: conjunto }]);
  const r = await ultimaApresentacao(CLIENTE, CONVERSA);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].metadata, conjunto);
});

test("sem apresentação anterior devolve vazio — e isso é uma resposta", async () => {
  // Vazio significa "a última fala não mostrou lista". O certo, então, é o
  // assistente perguntar — não inventar um referente.
  assert.deepEqual(await ultimaApresentacao(CLIENTE, CONVERSA), []);
});

test("erro de banco devolve vazio e LOGA — nunca derruba o turno", async () => {
  // Lançar aqui transformaria uma consulta de referência num erro de servidor,
  // no meio de um turno que já estava respondendo.
  responder = recusa;
  assert.deepEqual(await ultimaApresentacao(CLIENTE, CONVERSA), []);
});

test("tenant diferente é OUTRA consulta — não há vazamento por conversa", async () => {
  await ultimaApresentacao(OUTRO_CLIENTE, CONVERSA);
  assert.match(decodificada(), new RegExp(`cliente_id=eq\\.${OUTRO_CLIENTE}`));
  assert.ok(!decodificada().includes(CLIENTE));
});

// ---------------------------------------------------------------------------
// draftAbertoDaConversa — o rascunho daquele fio
// ---------------------------------------------------------------------------

const LINHA = {
  id: "d1",
  cliente_id: CLIENTE,
  conversa_id: CONVERSA,
  criado_por: null,
  status: "ativo",
  fatos: { nome: "Tênis" },
  variantes: [],
  conflitos: [],
  proposta_id: null,
  produto_id: null,
  criado_em: "2026-08-01T12:00:00.000Z",
  atualizado_em: "2026-08-01T12:05:00.000Z",
  versao: 3,
};

test("draft: filtra por tenant, conversa e pelos três estados ABERTOS", async () => {
  // `criado` e `cancelado` ficam de fora de propósito: um cadastro que virou
  // produto, ou que a pessoa descartou, não é rascunho aberto.
  await draftAbertoDaConversa(CLIENTE, CONVERSA);
  const u = decodificada();
  assert.match(u, /copilot_cadastros/);
  assert.match(u, new RegExp(`cliente_id=eq\\.${CLIENTE}`));
  assert.match(u, new RegExp(`conversa_id=eq\\.${CONVERSA}`));
  for (const s of ["ativo", "pronto_para_finalizar", "aguardando_confirmacao"]) {
    assert.ok(u.includes(s), `o estado ${s} saiu da consulta`);
  }
  assert.ok(!/status.*\bcriado\b/.test(u), "`criado` entrou na busca por rascunho aberto");
  assert.match(u, /order=atualizado_em\.desc/);
  assert.match(u, /limit=1/);
});

test("draft: converte a linha para o domínio, com a versão numérica", async () => {
  responder = () => json([LINHA]);
  const d = await draftAbertoDaConversa(CLIENTE, CONVERSA);
  assert.equal(d?.id, "d1");
  assert.equal(d?.conversaId, CONVERSA);
  assert.equal(d?.status, "ativo");
  // `versao` numérica importa: é ela que sustenta a trava otimista de
  // `salvarDraft` (`lt("versao", …)`). Uma string ali quebraria a comparação.
  assert.equal(d?.versao, 3);
  assert.equal(typeof d?.versao, "number");
});

test("draft: sem rascunho aberto devolve null, não um objeto vazio", async () => {
  // `null` diz "não há". Um draft vazio diria "há um, e está em branco" — e o
  // assistente continuaria um cadastro que ninguém começou.
  assert.equal(await draftAbertoDaConversa(CLIENTE, CONVERSA), null);
});

test("draft: erro de banco devolve null e não lança", async () => {
  responder = recusa;
  assert.equal(await draftAbertoDaConversa(CLIENTE, CONVERSA), null);
});

// O limite fica no cabeçalho deste arquivo e no INC-005, não num teste. Um
// teste que afirma que o próprio arquivo contém uma frase prova a frase, não o
// código — é teatro de rigor, e num repositório onde o verde tem peso isso
// custa mais do que rende.
