// INC-002 camada 5 — o mesmo modelo transacional da 045, agora para CUSTO.
//
// ===========================================================================
// O QUE MUDA EM RELAÇÃO AO PESO — E O QUE NÃO MUDA
// ===========================================================================
//
// NÃO muda: a proposta é lida sob lock, `valor` e `alvos` vêm dela e não de
// argumento, o tenant vem da sessão e é conferido, e a transição de status é a
// ÚLTIMA escrita da MESMA transação.
//
// MUDA: custo atinge UM produto e SUBSTITUI. Trocar um custo é o objetivo, não
// preencher um vazio — não existe predicado equivalente ao `peso <= 0`, não há
// conjunto congelado, e não há `elegiveis`. Devolver um `elegiveis` aqui faria
// `ressalvaDoPreenchimento` falar de uma parcialidade que este tipo não tem.
//
// ===========================================================================
// O QUE ESTE ARQUIVO NÃO PROVA
// ===========================================================================
//
// O comportamento transacional foi demonstrado em transações revertidas no
// banco real — inclusive "alvo inexistente ⇒ status permanece `pendente`,
// `executada_em` NULL". Um teste em Node não commita nada.
//
// Concorrência real continua NÃO OBSERVADA: sem harness de duas sessões.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { executarCustoAtomico } from "./copilotPropostas.ts";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "chave-de-teste-nao-e-segredo";

const PROPOSTA = "11111111-3333-4333-8444-555555555555";
const CLIENTE = "5074ae56-5f3a-4bc2-a3ad-d9f79ac8d53c";

const fetchOriginal = globalThis.fetch;
let capturado: { url: string; corpo: Record<string, unknown> } | null = null;
const ok = () =>
  new Response(JSON.stringify([{ motivo: "ok", afetados: 1 }]), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
let resposta: () => Response = ok;

beforeEach(() => {
  capturado = null;
  resposta = ok;
  globalThis.fetch = (async (entrada: unknown, init?: { body?: unknown }) => {
    const url = typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url);
    capturado = { url, corpo: typeof init?.body === "string" ? JSON.parse(init.body) : {} };
    return resposta();
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

// ---------------------------------------------------------------------------
// COMPORTAMENTO — o porto
// ---------------------------------------------------------------------------

test("chama a RPC da 046, e não uma escrita direta", async () => {
  await executarCustoAtomico(PROPOSTA, CLIENTE);
  assert.match(capturado!.url, /\/rest\/v1\/rpc\/copilot_executar_custo/);
});

test("manda SÓ proposta e cliente — nem valor, nem alvo", async () => {
  // A Proposal é a autorização. Com `valor` no corpo daria para combinar "esta
  // proposta com outro custo" e a função executaria.
  await executarCustoAtomico(PROPOSTA, CLIENTE);
  assert.deepEqual(Object.keys(capturado!.corpo).sort(), ["p_cliente", "p_proposta"]);
  assert.equal(capturado!.corpo.p_proposta, PROPOSTA);
  assert.equal(capturado!.corpo.p_cliente, CLIENTE);
});

test("o desfecho atravessa — e NÃO carrega `elegiveis`", async () => {
  const r = await executarCustoAtomico(PROPOSTA, CLIENTE);
  assert.deepEqual(r, { motivo: "ok", afetados: 1 });
  assert.ok(!("elegiveis" in r), "custo ganhou `elegiveis`: a ressalva passaria a mentir");
});

test("`nada_gravado` é desfecho, não erro", async () => {
  resposta = () =>
    new Response(JSON.stringify([{ motivo: "nada_gravado", afetados: 0 }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  const r = await executarCustoAtomico(PROPOSTA, CLIENTE);
  assert.equal(r.motivo, "nada_gravado");
  assert.equal(r.afetados, 0);
});

test("erro de banco LANÇA — não vira desfecho de negócio", async () => {
  resposta = () =>
    new Response(JSON.stringify({ code: "57014", message: "canceling statement" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  await assert.rejects(() => executarCustoAtomico(PROPOSTA, CLIENTE), /executar a proposta de custo/);
});

// ---------------------------------------------------------------------------
// FIAÇÃO — a rota
// ---------------------------------------------------------------------------

const ROTA = readFileSync(
  new URL("../../app/api/assistente/proposta/route.ts", import.meta.url),
  "utf8"
);

test("CUSTO entrou no caminho atômico, junto do peso", () => {
  assert.match(ROTA, /const atomico = p\.tipo === "peso" \|\| p\.tipo === "custo"/);
  assert.match(ROTA, /executarCustoAtomico\(p\.id, clienteDaSessao\)/);
});

test("custo NÃO manda `elegiveis` adiante", () => {
  // `ressalvaDoPreenchimento` devolve string vazia com `undefined`, e a
  // mensagem continua exatamente a de antes deste ciclo.
  // Sem exigir o `}` logo depois: a 047 acrescentou `margem: undefined` à mesma
  // linha. O que importa é que `elegiveis` sai indefinido do ramo de custo.
  assert.match(ROTA, /executarCustoAtomico\(p\.id, clienteDaSessao\)\), elegiveis: undefined/);
});

test("o `depois` de cada tipo mantém a forma que já ia para a auditoria", () => {
  assert.match(ROTA, /variacoesAtualizadas: rpc!\.afetados, pesoKg: p\.valor \/ 1000/);
  assert.match(ROTA, /\{ id: p\.alvos\[0\], custo: p\.valor \}/);
});

test("o retrato de ANTES do custo lê o valor anterior, e só", () => {
  const bloco = ROTA.slice(
    ROTA.indexOf("async function retratoAntesDaEscrita"),
    ROTA.indexOf("if (p.alvos.length > 1)", ROTA.indexOf("async function retratoAntesDaEscrita"))
  );
  assert.match(bloco, /p\.tipo === "custo"/);
  assert.match(bloco, /\.from\("produtos"\)[\s\S]{0,60}\.select\("custo"\)/);
});

test("zero linhas NÃO queima a proposta — vale para os dois tipos atômicos", () => {
  assert.match(ROTA, /if \(!atomico\) await marcarProposta\(p\.id, "falhou"/);
});

// ---------------------------------------------------------------------------
// GUARDA ESTRUTURAL — a migração 046
// ---------------------------------------------------------------------------

const SQL = readFileSync(
  new URL("../../../database/migrations/046-execucao-atomica-do-custo.sql", import.meta.url),
  "utf8"
);

test("046: a transição de status vem DEPOIS da mutação — a invariante inteira", () => {
  const mutacao = SQL.indexOf("update public.produtos");
  const status = SQL.indexOf("set status = 'executada'");
  assert.ok(mutacao > 0 && status > 0);
  assert.ok(status > mutacao, "a transição voltou a acontecer ANTES da mutação: o T1 renasceu");
});

test("046: zero linhas retorna sem tocar no status", () => {
  const ini = SQL.indexOf("if v_afetados = 0");
  const bloco = SQL.slice(ini, SQL.indexOf("end if;", ini));
  assert.match(bloco, /nada_gravado/);
  assert.ok(!/update public\.copilot_propostas/.test(bloco));
});

test("046: trava a proposta antes de qualquer decisão", () => {
  const ate = SQL.slice(0, SQL.indexOf("update public.produtos"));
  assert.match(ate, /from public\.copilot_propostas[\s\S]{0,80}for update/);
});

test("046: a mutação é escopada por id E tenant", () => {
  const update = SQL.slice(SQL.indexOf("update public.produtos"), SQL.indexOf("get diagnostics"));
  assert.match(update, /where id = v_produto/);
  assert.match(update, /and cliente_id = p_cliente/);
});

test("046: recusa proposta que não seja de custo", () => {
  assert.match(SQL, /v_tipo is distinct from 'custo'[\s\S]{0,60}tipo_invalido/);
});

test("046: SECURITY INVOKER e execute só para service_role", () => {
  const declaracao = SQL.slice(
    SQL.indexOf("create or replace function public.copilot_executar_custo"),
    SQL.indexOf("as $$")
  );
  assert.match(declaracao, /security invoker/i);
  assert.ok(!/security definer/i.test(declaracao));
  for (const papel of ["public", "anon", "authenticated"]) {
    assert.match(SQL, new RegExp(`revoke all on function[\\s\\S]{0,120}from ${papel}`, "i"));
  }
  assert.match(SQL, /grant execute on function[\s\S]{0,120}to service_role/i);
});

test("046: NÃO inventa predicado de vazio — custo SUBSTITUI", () => {
  // Um `custo <= 0` aqui mudaria a semântica do domínio: trocar um custo é o
  // objetivo, e o caminho que esta função substitui nunca teve esse predicado.
  const update = SQL.slice(SQL.indexOf("update public.produtos"), SQL.indexOf("get diagnostics"));
  assert.ok(!/custo\s*<=\s*0/.test(update));
});

test("046: aditiva — sem tabela, coluna, RLS, policy ou backfill", () => {
  for (const proibido of [
    /alter table/i,
    /add column/i,
    /create policy/i,
    /alter policy/i,
    /enable row level security/i,
  ]) {
    assert.ok(!proibido.test(SQL), `a migração passou a fazer: ${proibido}`);
  }
});

test("046: confere que a 045 continua existindo", () => {
  assert.match(SQL, /copilot_executar_peso[\s\S]{0,200}a funcao da 045 sumiu/);
});

test("046: registra a si mesma no ledger — regra da 043", () => {
  assert.match(SQL, /insert into public\.migracoes_aplicadas[\s\S]*'046'/);
});
