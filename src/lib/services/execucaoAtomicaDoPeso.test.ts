// INC-002 camada 5 / H3 — `executada` passa a implicar mutação commitada.
//
// ===========================================================================
// O DEFEITO
// ===========================================================================
//
// `reservarParaExecucao` fazia o CAS `pendente -> executada` e carimbava
// `executada_em` ANTES da mutação, em transação separada — três idas ao
// PostgREST antes da escrita. Morte no intervalo:
//
//     Proposal = executada · catálogo = INTACTO · copilot_acoes = vazio
//     nova tentativa = HTTP 200 "Isso já foi feito"
//
// A autorização é consumida, nada é gravado, e o sistema afirma o contrário.
//
// ===========================================================================
// O QUE ESTE ARQUIVO PROVA — E O QUE NÃO PROVA
// ===========================================================================
//
// PROVA: o porto manda só o que deve, não engole erro, e a rota de PESO deixou
// de usar o par antigo. E congela, no SQL, a ordem que sustenta a invariante:
// a transição de status vem DEPOIS da mutação.
//
// NÃO PROVA: o comportamento transacional em si — isso foi demonstrado em
// transações revertidas no banco real (mutação sem efeito ⇒ status permanece
// `pendente`, `executada_em` NULL). Um teste em Node não commita nada.
//
// NÃO PROVA concorrência: continua sem harness de duas sessões.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { executarPesoAtomico } from "./copilotPropostas.ts";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "chave-de-teste-nao-e-segredo";

const PROPOSTA = "903c1830-6cb3-488b-962f-c1edb018a60a";
const CLIENTE = "5074ae56-5f3a-4bc2-a3ad-d9f79ac8d53c";

const fetchOriginal = globalThis.fetch;
let capturado: { url: string; corpo: Record<string, unknown> } | null = null;
let resposta: () => Response = () =>
  new Response(JSON.stringify([{ motivo: "ok", afetados: 3, elegiveis: 3 }]), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  capturado = null;
  globalThis.fetch = (async (entrada: unknown, init?: { body?: unknown }) => {
    const url = typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url);
    capturado = { url, corpo: typeof init?.body === "string" ? JSON.parse(init.body) : {} };
    return resposta();
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
  resposta = () =>
    new Response(JSON.stringify([{ motivo: "ok", afetados: 3, elegiveis: 3 }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
});

// ---------------------------------------------------------------------------
// COMPORTAMENTO — o porto
// ---------------------------------------------------------------------------

test("chama a RPC da 045, e não uma escrita direta", async () => {
  await executarPesoAtomico(PROPOSTA, CLIENTE);
  assert.match(capturado!.url, /\/rest\/v1\/rpc\/copilot_executar_peso/);
});

test("manda SÓ proposta e cliente — nem valor, nem alvos, nem ids", async () => {
  // A Proposal é a autorização. Se `valor` ou `alvos` viajassem daqui, daria
  // para combinar "esta proposta com outro peso" e a função executaria.
  await executarPesoAtomico(PROPOSTA, CLIENTE);
  assert.deepEqual(Object.keys(capturado!.corpo).sort(), ["p_cliente", "p_proposta"]);
  assert.equal(capturado!.corpo.p_proposta, PROPOSTA);
  assert.equal(capturado!.corpo.p_cliente, CLIENTE);
});

test("o desfecho atravessa com os números", async () => {
  const r = await executarPesoAtomico(PROPOSTA, CLIENTE);
  assert.deepEqual(r, { motivo: "ok", afetados: 3, elegiveis: 3 });
});

test("`nada_gravado` NÃO é erro — é desfecho", async () => {
  resposta = () =>
    new Response(JSON.stringify([{ motivo: "nada_gravado", afetados: 0, elegiveis: 2 }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  const r = await executarPesoAtomico(PROPOSTA, CLIENTE);
  assert.equal(r.motivo, "nada_gravado");
  assert.equal(r.afetados, 0);
});

test("erro de banco LANÇA — não vira desfecho de negócio", async () => {
  // Lançar é o certo: a transação do banco já reverteu tudo, inclusive o
  // status. Traduzir para `nada_gravado` faria a rota auditar como zero linhas
  // uma execução cujo desfecho ninguém conhece.
  resposta = () =>
    new Response(JSON.stringify({ code: "57014", message: "canceling statement" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  await assert.rejects(() => executarPesoAtomico(PROPOSTA, CLIENTE), /executar a proposta de peso/);
});

// ---------------------------------------------------------------------------
// FIAÇÃO — a rota
// ---------------------------------------------------------------------------

const ROTA = readFileSync(
  new URL("../../app/api/assistente/proposta/route.ts", import.meta.url),
  "utf8"
);

test("PESO usa a primitiva atômica", () => {
  // O gate lista vários tipos e cresce a cada ciclo. O que este teste guarda é
  // que PESO está nele — não a forma literal da expressão.
  assert.match(ROTA, /const atomico =[\s\S]{0,200}p\.tipo === "peso"/);
  assert.match(ROTA, /executarPesoAtomico\(p\.id, clienteDaSessao\)/);
});

test("PESO não passa mais por `reservarParaExecucao` + `gravar`", () => {
  // O par continua no arquivo — é o caminho dos OUTROS tipos. O que não pode
  // existir é peso passando por ele: as duas chamadas ficam atrás de `atomico`.
  assert.match(ROTA, /atomico\s*\?[\s\S]{0,200}:\s*await reservarParaExecucao\(p\.id\)/);
  assert.match(ROTA, /:\s*await gravar\(p\)/);
});

test("zero linhas NÃO queima a proposta de peso", () => {
  // Marcar `falhou` aqui desfaria exatamente o que a 045 preservou: a proposta
  // continua `pendente` e pode ser tentada de novo com a mesma autorização.
  assert.match(ROTA, /if \(!atomico\) await marcarProposta\(p\.id, "falhou"/);
});

test("cadastro continua fora da primitiva", () => {
  // CUSTO saiu desta lista na 046, PREÇO na 047 e TÍTULO na 048 — cada um
  // ganhou primitiva própria. Sobrou `cadastro`: multi-statement, não
  // idempotente e valida em TypeScript.
  for (const tipo of ["cadastro"]) {
    assert.ok(
      !new RegExp(`p\\.tipo === "${tipo}"[\\s\\S]{0,80}executar\\w+Atomico`).test(ROTA),
      `${tipo} encostou numa primitiva atômica`
    );
  }
  // Cada primitiva é chamada de UM lugar só.
  assert.equal((ROTA.match(/executarPesoAtomico\(/g) ?? []).length, 1);
  assert.equal((ROTA.match(/executarCustoAtomico\(/g) ?? []).length, 1);
});

test("o retrato de ANTES fica FORA da transação", () => {
  // Ele alimenta auditoria e consequência, não a invariante. Movê-lo para
  // dentro aumentaria a seção crítica sem fechar nada.
  assert.match(ROTA, /async function retratoAntesDaEscrita/);
  assert.match(ROTA, /atomico \? await retratoAntesDaEscrita\(p\) : null/);
});

// ---------------------------------------------------------------------------
// GUARDA ESTRUTURAL — a migração 045
// ---------------------------------------------------------------------------

const SQL = readFileSync(
  new URL("../../../database/migrations/045-execucao-atomica-do-peso.sql", import.meta.url),
  "utf8"
);

test("045: a transição de status vem DEPOIS da mutação — a invariante inteira", () => {
  const mutacao = SQL.indexOf("update public.produto_variantes");
  const status = SQL.indexOf("set status = 'executada'");
  assert.ok(mutacao > 0 && status > 0, "sumiu a mutação ou a transição");
  assert.ok(
    status > mutacao,
    "a transição de status voltou a acontecer ANTES da mutação: o T1 renasceu"
  );
});

test("045: zero linhas retorna sem tocar no status", () => {
  // O bloco INTEIRO do `if`, até o `end if` — antes eu recortava até o
  // `set status`, e a fatia engolia o `update` da linha anterior.
  const ini = SQL.indexOf("if v_afetados = 0");
  const bloco = SQL.slice(ini, SQL.indexOf("end if;", ini));
  assert.match(bloco, /nada_gravado/);
  assert.ok(
    !/update public\.copilot_propostas/.test(bloco),
    "o caminho de zero linhas passou a mexer no status"
  );
});

test("045: SECURITY INVOKER e execute só para service_role", () => {
  // Sobre a DECLARAÇÃO, não sobre o arquivo: a própria migração menciona
  // "SECURITY DEFINER" na mensagem da guarda que reprova esse modo, e procurar
  // a string solta acusava o texto que existe para impedir o defeito.
  const declaracao = SQL.slice(
    SQL.indexOf("create or replace function public.copilot_executar_peso"),
    SQL.indexOf("as $$")
  );
  assert.match(declaracao, /security invoker/i);
  assert.ok(!/security definer/i.test(declaracao));
  for (const papel of ["public", "anon", "authenticated"]) {
    assert.match(SQL, new RegExp(`revoke all on function[\\s\\S]{0,120}from ${papel}`, "i"));
  }
  assert.match(SQL, /grant execute on function[\s\S]{0,120}to service_role/i);
});

test("045: LEGACY — ausência de idsAprovados é predicado neutro, não conjunto vazio", () => {
  const aplicacoes = SQL.match(/v_ids is null or v\./g) ?? [];
  assert.equal(aplicacoes.length, 2, "a neutralidade do legacy sumiu de alguma das duas queries");
});

test("045: as barreiras dos ciclos anteriores continuam na mutação", () => {
  const update = SQL.slice(SQL.indexOf("update public.produto_variantes"), SQL.indexOf("get diagnostics"));
  assert.match(update, /cliente_id = p_cliente/);
  assert.match(update, /produto_id = any\(v_alvos\)/);
  assert.match(update, /peso <= 0/);
  assert.match(update, /v_ids is null or v\.id = any\(v_ids\)/);
});

test("045: trava a proposta antes de qualquer decisão", () => {
  const ate = SQL.slice(0, SQL.indexOf("update public.produto_variantes"));
  assert.match(ate, /from public\.copilot_propostas[\s\S]{0,80}for update/);
});

test("045: aditiva — sem tabela, coluna, RLS, policy ou backfill", () => {
  for (const proibido of [
    /alter table/i,
    /add column/i,
    /create policy/i,
    /alter policy/i,
    /enable row level security/i,
    /update public\.copilot_propostas set autoridade/i,
  ]) {
    assert.ok(!proibido.test(SQL), `a migração passou a fazer: ${proibido}`);
  }
});

test("045: registra a si mesma no ledger — regra da 043", () => {
  assert.match(SQL, /insert into public\.migracoes_aplicadas[\s\S]*'045'/);
});

test("045: NÃO revalida precondições — camada 4 continua fora", () => {
  assert.ok(!/pesoConhecido/i.test(SQL.replace(/--[^\n]*/g, "")));
});
