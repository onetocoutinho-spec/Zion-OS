// INC-004 — o turno do Copilot precisa CHEGAR a `copilot_mensagens`.
//
// Durante meses nenhum chegou, e a tela respondia normalmente. As duas falas
// iam num único `.insert([...])` com chaves diferentes: a do lojista não
// trazia `ferramentas`. O PostgREST monta UMA lista de colunas com a UNIÃO das
// chaves e preenche a que falta com NULL EXPLÍCITO — nunca com o DEFAULT da
// coluna. Como `ferramentas` é NOT NULL, o Postgres recusava o insert INTEIRO
// com 23502.
//
// E sumia: o cliente Supabase não lança em erro de banco, devolve
// `{ data, error }`. O retorno era descartado, então o `catch` nunca era
// atingido e nada era logado.
//
// O QUE SE PROVA AQUI é o payload REAL que sai na requisição — o corpo
// serializado, capturado por um `fetch` de mentira. Procurar `ferramentas: []`
// no fonte provaria que alguém escreveu o texto certo, não que o contrato saiu
// certo do outro lado.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { gravarTurno } from "./copilotConversas.ts";

// `getSupabaseAdmin` lê o ambiente na CHAMADA, não no import — e memoiza o
// cliente depois. Definir aqui basta, e sem isso ele lança em vez de montar a
// requisição. Nenhum segredo real: a requisição nunca sai (ver o fetch abaixo).
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "chave-de-teste-nao-e-segredo";

const CONVERSA = "3d8af477-bad6-42c5-917b-84b71252718b";
const CLIENTE = "5074ae56-5f3a-4bc2-a3ad-d9f79ac8d53c";

interface Linha {
  conversa_id?: string;
  cliente_id?: string;
  papel?: string;
  texto?: string;
  ferramentas?: unknown;
  tokens?: unknown;
  metadata?: unknown;
}

const fetchOriginal = globalThis.fetch;
const erroOriginal = console.error;

/** O que a requisição levou, e o que o console registrou. */
let capturado: { url: string; linhas: Linha[] } | null = null;
let logado: unknown[][] = [];
/** Como o PostgREST vai responder neste teste. */
let resposta: () => Response = () => new Response("", { status: 201 });

beforeEach(() => {
  capturado = null;
  logado = [];
  resposta = () => new Response("", { status: 201 });
  globalThis.fetch = (async (entrada: unknown, init?: { body?: unknown }) => {
    const url = typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url);
    const corpo = typeof init?.body === "string" ? init.body : "[]";
    capturado = { url, linhas: JSON.parse(corpo) as Linha[] };
    return resposta();
  }) as unknown as typeof fetch;
  console.error = (...args: unknown[]) => {
    logado.push(args);
  };
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  console.error = erroOriginal;
});

const TURNO = {
  pergunta: "completa o peso que falta na Rasteira Feminina Vizzano 6371.1005",
  resposta: "Preparei uma proposta para aplicar 410 gramas às 3 variantes.",
  ferramentas: ["achar_produto", "pendencias", "preparar_resolucao"] as const,
  tokens: 4321,
  metadata: { conjunto: [{ id: "faaed47d" }] },
};

async function gravar(turno = TURNO) {
  await gravarTurno(CLIENTE, CONVERSA, turno);
  assert.ok(capturado, "nenhuma requisição saiu");
  return capturado!;
}

const lojista = (l: Linha[]) => l.find((x) => x.papel === "lojista")!;
const assistente = (l: Linha[]) => l.find((x) => x.papel === "assistente")!;

// ---------------------------------------------------------------------------
// T1–T5 — o payload que o PostgREST recebe
// ---------------------------------------------------------------------------

test("T1: a fala do lojista leva `ferramentas` como array vazio", async () => {
  const { linhas } = await gravar();
  assert.deepEqual(lojista(linhas).ferramentas, []);
});

test("T2: ela NÃO depende do DEFAULT — a chave viaja na requisição", async () => {
  // O DEFAULT da coluna é inalcançável aqui: com a chave ausente numa das
  // linhas, o PostgREST manda NULL, não o default. É essa a armadilha.
  const { linhas } = await gravar();
  assert.ok("ferramentas" in lojista(linhas));
});

test("T5: `ferramentas` do lojista nunca é null", async () => {
  const { linhas } = await gravar();
  assert.notEqual(lojista(linhas).ferramentas, null);
});

test("T3: a fala do assistente preserva as ferramentas reais", async () => {
  const { linhas } = await gravar();
  assert.deepEqual(assistente(linhas).ferramentas, [
    "achar_produto",
    "pendencias",
    "preparar_resolucao",
  ]);
});

test("T4: as duas linhas têm EXATAMENTE o mesmo conjunto de chaves", async () => {
  // Esta é a invariante que fecha a CLASSE, não só a reprodução: enquanto os
  // conjuntos forem iguais, a união do PostgREST não inventa NULL em ninguém.
  const { linhas } = await gravar();
  assert.equal(linhas.length, 2);
  const chaves = linhas.map((l) => Object.keys(l).sort());
  assert.deepEqual(chaves[0], chaves[1]);
});

test("T4: nenhuma coluna NOT NULL viaja como null", async () => {
  const { linhas } = await gravar();
  for (const l of linhas) {
    for (const coluna of ["conversa_id", "cliente_id", "papel", "texto", "ferramentas"]) {
      assert.notEqual(l[coluna as keyof Linha], null, `"${coluna}" foi como null`);
    }
  }
});

// ---------------------------------------------------------------------------
// T6–T11 — o que já funcionava continua
// ---------------------------------------------------------------------------

test("T6/T7: os papéis continuam `lojista` e `assistente`", async () => {
  const { linhas } = await gravar();
  assert.deepEqual(linhas.map((l) => l.papel), ["lojista", "assistente"]);
});

test("T8/T9: conversa_id e cliente_id vão nas duas linhas", async () => {
  const { linhas } = await gravar();
  for (const l of linhas) {
    assert.equal(l.conversa_id, CONVERSA);
    assert.equal(l.cliente_id, CLIENTE);
  }
});

test("T10/T11: os dois textos atravessam intactos", async () => {
  const { linhas } = await gravar();
  assert.equal(lojista(linhas).texto, TURNO.pergunta);
  assert.equal(assistente(linhas).texto, TURNO.resposta);
});

test("tokens e metadata pertencem à fala do assistente", async () => {
  // Nulos por SIGNIFICADO: as colunas são nuláveis, e "não se aplica" é
  // diferente de "custou zero".
  const { linhas } = await gravar();
  assert.equal(lojista(linhas).tokens, null);
  assert.equal(lojista(linhas).metadata, null);
  assert.equal(assistente(linhas).tokens, 4321);
  assert.deepEqual(assistente(linhas).metadata, TURNO.metadata);
});

test("a requisição vai para copilot_mensagens", async () => {
  const { url } = await gravar();
  assert.match(url, /copilot_mensagens/);
});

// ---------------------------------------------------------------------------
// T12–T16 — o erro deixou de ser invisível
// ---------------------------------------------------------------------------

test("T12: sem erro, nada é registrado", async () => {
  await gravar();
  assert.deepEqual(logado, []);
});

test("T13: erro do Postgres NÃO passa como sucesso silencioso", async () => {
  // Exatamente a recusa observada em produção.
  resposta = () =>
    new Response(
      JSON.stringify({
        code: "23502",
        message: 'null value in column "ferramentas" of relation "copilot_mensagens" violates not-null constraint',
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  await gravarTurno(CLIENTE, CONVERSA, TURNO);
  assert.equal(logado.length, 1, "a recusa não foi registrada");
});

test("T14: o registro diz ONDE falhou e carrega o erro do banco", async () => {
  resposta = () =>
    new Response(JSON.stringify({ code: "23502", message: "violates not-null constraint" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  await gravarTurno(CLIENTE, CONVERSA, TURNO);
  const [rotulo, erro] = logado[0];
  assert.match(String(rotulo), /copilot_mensagens/);
  assert.match(JSON.stringify(erro), /23502|not-null/);
});

test("T15: a falha não vira dado falso — gravarTurno não devolve sucesso", async () => {
  // O contrato local é `Promise<void>`: ela não afirma nada sobre ter gravado,
  // e continua não derrubando a resposta do lojista. O que mudou é que a
  // recusa passou a existir para quem lê os logs.
  resposta = () =>
    new Response(JSON.stringify({ code: "23502", message: "x" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  const r = await gravarTurno(CLIENTE, CONVERSA, TURNO);
  assert.equal(r, undefined);
  assert.equal(logado.length, 1);
});

test("T16: falha de REDE também é registrada — e quem a registra é o `error`", async () => {
  // Descoberto ao rodar este teste contra o código anterior, onde ele FALHOU.
  //
  // O `catch` parecia a rede de segurança do módulo, e não é: o postgrest-js
  // converte falha de fetch em `{ error }` como faz com erro de banco, em vez
  // de propagar a exceção. Antes desta correção o `catch` era, na prática,
  // código morto — nem recusa do Postgres nem queda de rede chegavam nele.
  globalThis.fetch = (async () => {
    throw new Error("rede caiu");
  }) as unknown as typeof fetch;
  await gravarTurno(CLIENTE, CONVERSA, TURNO);
  assert.equal(logado.length, 1);
  assert.match(String(logado[0][0]), /copilot_mensagens/);
});

// ---------------------------------------------------------------------------
// Controle de regressão — o que esta fase não podia tocar
// ---------------------------------------------------------------------------

test("a rota continua NÃO aguardando gravarTurno — `void` permanece", async () => {
  const { readFileSync } = await import("node:fs");
  const rota = readFileSync(
    new URL("../../app/api/assistente/conversa/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(rota, /void gravarTurno\(/);
  for (const proibido of ["await gravarTurno(", "waitUntil", "after("]) {
    assert.ok(!rota.includes(proibido), `apareceu "${proibido}" — mudou o dono da Promise`);
  }
});
