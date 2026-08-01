// INC-002 camada 5 — o modelo das 045/046/047, agora para TÍTULO.
//
// ===========================================================================
// O CASO MAIS LIMPO DOS QUATRO
// ===========================================================================
//
// Nada extra viaja: o título proposto está na Proposal, em `texto`, e o alvo em
// `alvos[0]` — que aqui é o ID DO ANÚNCIO, não do produto. A função recebe
// `(proposta, cliente)`, como as 045 e 046.
//
// ===========================================================================
// O MERGE DO JSONB NÃO É PORTE DE DOMÍNIO
// ===========================================================================
//
// O caminho antigo fazia `{ ...atual, tituloOtimizado: titulo }` em TypeScript.
// `jsonb_set(anuncio, '{tituloOtimizado}', ...)` é a MESMA substituição de uma
// chave de topo. A distinção importa: rejeitamos portar `margemLiquida` porque
// seriam duas implementações de uma CONTA; aqui é a mesma operação estrutural,
// escrita onde o dado mora.
//
// Provado em transação revertida no banco real: as 16 chaves do anúncio
// sobreviveram, o `trim` foi aplicado, e texto em branco devolveu `sem_texto`
// com a proposta permanecendo `pendente`.
//
// Concorrência real continua NÃO OBSERVADA: sem harness de duas sessões.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { executarTituloAtomico } from "./copilotPropostas.ts";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "chave-de-teste-nao-e-segredo";

const PROPOSTA = "66666666-5555-4555-8555-555555555555";
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

test("chama a RPC da 048", async () => {
  await executarTituloAtomico(PROPOSTA, CLIENTE);
  assert.match(capturado!.url, /\/rest\/v1\/rpc\/copilot_executar_titulo/);
});

test("manda SÓ proposta e cliente — o TEXTO está na Proposal", async () => {
  await executarTituloAtomico(PROPOSTA, CLIENTE);
  assert.deepEqual(Object.keys(capturado!.corpo).sort(), ["p_cliente", "p_proposta"]);
  for (const proibido of ["p_texto", "p_titulo", "p_anuncio", "p_alvos"]) {
    assert.ok(!(proibido in capturado!.corpo), `${proibido} viajou como argumento`);
  }
});

test("`sem_texto` é desfecho, não erro", async () => {
  resposta = () =>
    new Response(JSON.stringify([{ motivo: "sem_texto", afetados: 0 }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  const r = await executarTituloAtomico(PROPOSTA, CLIENTE);
  assert.equal(r.motivo, "sem_texto");
  assert.equal(r.afetados, 0);
});

test("`nada_gravado` é desfecho, não erro", async () => {
  resposta = () =>
    new Response(JSON.stringify([{ motivo: "nada_gravado", afetados: 0 }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  assert.equal((await executarTituloAtomico(PROPOSTA, CLIENTE)).motivo, "nada_gravado");
});

test("erro de banco LANÇA — não vira desfecho de negócio", async () => {
  resposta = () =>
    new Response(JSON.stringify({ code: "57014", message: "canceling statement" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  await assert.rejects(() => executarTituloAtomico(PROPOSTA, CLIENTE), /executar a proposta de título/);
});

// ---------------------------------------------------------------------------
// FIAÇÃO — a rota
// ---------------------------------------------------------------------------

const ROTA = readFileSync(
  new URL("../../app/api/assistente/proposta/route.ts", import.meta.url),
  "utf8"
);

test("TÍTULO entrou no caminho atômico", () => {
  assert.match(ROTA, /p\.tipo === "peso" \|\| p\.tipo === "custo" \|\| p\.tipo === "preco" \|\| p\.tipo === "titulo"/);
  assert.match(ROTA, /executarTituloAtomico\(p\.id, clienteDaSessao\)/);
});

test("TÍTULO não passa mais por `gravar` — nem por `aplicarTitulo`", () => {
  assert.match(ROTA, /título não passa mais por `gravar`/);
  assert.ok(!/aplicarTitulo\(/.test(ROTA), "a rota ainda chama `aplicarTitulo`: há dois caminhos");
});

test("o `depois` do título mantém a forma que a procedência lê", () => {
  // `rastroDaEscrita` lê `depois.titulo` para gravar a origem `zion`.
  assert.match(ROTA, /\{ titulo: \(p\.texto \?\? ""\)\.trim\(\) \}/);
});

test("o retrato de ANTES do título lê o tituloOtimizado atual", () => {
  const ini = ROTA.indexOf("async function retratoAntesDaEscrita");
  const bloco = ROTA.slice(ini, ROTA.indexOf('p.tipo === "preco"', ini));
  assert.match(bloco, /from\("anuncios_gerados"\)/);
  assert.match(bloco, /tituloOtimizado/);
});

test("CADASTRO é o último fora — e continua fora", () => {
  assert.ok(
    !/p\.tipo === "cadastro"[\s\S]{0,80}executar\w+Atomico/.test(ROTA),
    "cadastro encostou numa primitiva atômica"
  );
  // Cada primitiva é chamada de UM lugar só.
  for (const f of ["executarPesoAtomico", "executarCustoAtomico", "executarPrecoAtomico", "executarTituloAtomico"]) {
    assert.equal((ROTA.match(new RegExp(`${f}\\(`, "g")) ?? []).length, 1, `${f} é chamada mais de uma vez`);
  }
});

// ---------------------------------------------------------------------------
// GUARDA ESTRUTURAL — a migração 048
// ---------------------------------------------------------------------------

const SQL = readFileSync(
  new URL("../../../database/migrations/048-execucao-atomica-do-titulo.sql", import.meta.url),
  "utf8"
);

test("048: o merge preserva o resto do jsonb — `jsonb_set`, nunca substituição inteira", () => {
  // Um `set anuncio = jsonb_build_object(...)` apagaria as outras 15 chaves do
  // anúncio. O caminho antigo fazia spread; `jsonb_set` é o equivalente exato.
  const update = SQL.slice(SQL.indexOf("update public.anuncios_gerados"), SQL.indexOf("get diagnostics"));
  assert.match(update, /jsonb_set\(anuncio, '\{tituloOtimizado\}', to_jsonb\(v_texto\)/);
  assert.ok(!/jsonb_build_object/.test(update), "o merge virou construção do objeto inteiro");
});

test("048: a transição de status vem DEPOIS da mutação", () => {
  const mutacao = SQL.indexOf("update public.anuncios_gerados");
  const status = SQL.indexOf("set status = 'executada'");
  assert.ok(mutacao > 0 && status > 0);
  assert.ok(status > mutacao, "a transição voltou a acontecer ANTES da mutação: o T1 renasceu");
});

test("048: texto em branco não grava e não queima a proposta", () => {
  const ini = SQL.indexOf("if v_texto = ''");
  const bloco = SQL.slice(ini, SQL.indexOf("end if;", ini));
  assert.match(bloco, /sem_texto/);
  assert.ok(!/update public\./.test(bloco));
  assert.match(SQL, /btrim\(coalesce\(v_texto, ''\)\)/);
});

test("048: zero linhas retorna sem tocar no status", () => {
  const ini = SQL.indexOf("if v_afetados = 0");
  const bloco = SQL.slice(ini, SQL.indexOf("end if;", ini));
  assert.match(bloco, /nada_gravado/);
  assert.ok(!/update public\.copilot_propostas/.test(bloco));
});

test("048: trava a proposta antes de qualquer decisão", () => {
  const ate = SQL.slice(0, SQL.indexOf("update public.anuncios_gerados"));
  assert.match(ate, /from public\.copilot_propostas[\s\S]{0,80}for update/);
});

test("048: a mutação é escopada por id E tenant", () => {
  const update = SQL.slice(SQL.indexOf("update public.anuncios_gerados"), SQL.indexOf("get diagnostics"));
  assert.match(update, /where id = v_anuncio/);
  assert.match(update, /and cliente_id = p_cliente/);
});

test("048: recusa proposta que não seja de título", () => {
  assert.match(SQL, /v_tipo is distinct from 'titulo'[\s\S]{0,60}tipo_invalido/);
});

test("048: SECURITY INVOKER e execute só para service_role", () => {
  const declaracao = SQL.slice(
    SQL.indexOf("create or replace function public.copilot_executar_titulo"),
    SQL.indexOf("as $$")
  );
  assert.match(declaracao, /security invoker/i);
  assert.ok(!/security definer/i.test(declaracao));
  for (const papel of ["public", "anon", "authenticated"]) {
    assert.match(SQL, new RegExp(`revoke all on function[\\s\\S]{0,130}from ${papel}`, "i"));
  }
  assert.match(SQL, /grant execute on function[\s\S]{0,130}to service_role/i);
});

test("048: aditiva — sem tabela, coluna, RLS, policy ou backfill", () => {
  for (const proibido of [/alter table/i, /add column/i, /create policy/i, /alter policy/i, /enable row level security/i]) {
    assert.ok(!proibido.test(SQL), `a migração passou a fazer: ${proibido}`);
  }
});

test("048: confere que as três funções anteriores continuam existindo", () => {
  assert.match(SQL, /as funcoes das 045\/046\/047 nao estao todas presentes/);
});

test("048: registra a si mesma no ledger — regra da 043", () => {
  assert.match(SQL, /insert into public\.migracoes_aplicadas[\s\S]*'048'/);
});
