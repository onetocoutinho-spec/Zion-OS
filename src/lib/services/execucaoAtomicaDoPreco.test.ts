// INC-002 camada 5 — o modelo das 045/046, agora para PREÇO.
//
// ===========================================================================
// O QUE DIFERE, E É O PONTO DO CICLO
// ===========================================================================
//
// A escrita toca DUAS colunas: `preco_venda` e `margem`. A margem NÃO está na
// Proposal — é `margemLiquida(custo, preco, taxas)`, calculada em TypeScript
// sobre o modelo de tarifas do ML (~470 linhas com a tabela de frete). Portar
// isso para SQL criaria duas implementações da mesma conta.
//
// Então ela viaja como PARÂMETRO. A distinção que sustenta o desenho:
//
//   `valor`  é o FATO AUTORIZADO. Passá-lo por parâmetro permitiria "esta
//            proposta com outro preço" — é o que a 045 fechou.
//   `margem` NÃO é autorizada por ninguém. Subproduto do cálculo: não é
//            precondição, não é revalidada, e não decide nada.
//
// Verificado antes de escrever a migração, não presumido: `CAMPO_MARGEM` não
// existe no repositório; as precondições de preço são quatro e nenhuma é
// margem; `podeExecutar` não a menciona. Os testes de guarda abaixo congelam
// isso.
//
// ===========================================================================
// O QUE ESTE ARQUIVO NÃO PROVA
// ===========================================================================
//
// O comportamento transacional foi demonstrado em transação revertida no banco
// real — inclusive "alvo inexistente ⇒ status permanece `pendente`" e
// "margem NULL é gravada como NULL, não como 0". Um teste em Node não commita.
//
// Concorrência real continua NÃO OBSERVADA: sem harness de duas sessões.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { executarPrecoAtomico } from "./copilotPropostas.ts";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "chave-de-teste-nao-e-segredo";

const PROPOSTA = "33333333-4444-4444-8444-555555555555";
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

test("chama a RPC da 047", async () => {
  await executarPrecoAtomico(PROPOSTA, CLIENTE, 22.5);
  assert.match(capturado!.url, /\/rest\/v1\/rpc\/copilot_executar_preco/);
});

test("manda proposta, cliente e margem — e NADA do que a Proposal já carrega", async () => {
  await executarPrecoAtomico(PROPOSTA, CLIENTE, 22.5);
  assert.deepEqual(Object.keys(capturado!.corpo).sort(), ["p_cliente", "p_margem", "p_proposta"]);
  // O preço e o alvo NÃO viajam: são os fatos autorizados, e saem da Proposal
  // sob lock dentro da função.
  for (const proibido of ["p_valor", "p_preco", "p_alvos", "p_produto"]) {
    assert.ok(!(proibido in capturado!.corpo), `${proibido} viajou como argumento`);
  }
});

test("margem NULL atravessa como null — nunca vira 0", async () => {
  await executarPrecoAtomico(PROPOSTA, CLIENTE, null);
  assert.equal(capturado!.corpo.p_margem, null);
});

test("o desfecho atravessa", async () => {
  assert.deepEqual(await executarPrecoAtomico(PROPOSTA, CLIENTE, 10), { motivo: "ok", afetados: 1 });
});

test("`nada_gravado` é desfecho, não erro", async () => {
  resposta = () =>
    new Response(JSON.stringify([{ motivo: "nada_gravado", afetados: 0 }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  const r = await executarPrecoAtomico(PROPOSTA, CLIENTE, 10);
  assert.equal(r.motivo, "nada_gravado");
  assert.equal(r.afetados, 0);
});

test("erro de banco LANÇA — não vira desfecho de negócio", async () => {
  resposta = () =>
    new Response(JSON.stringify({ code: "57014", message: "canceling statement" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  await assert.rejects(() => executarPrecoAtomico(PROPOSTA, CLIENTE, 10), /executar a proposta de preço/);
});

// ---------------------------------------------------------------------------
// FIAÇÃO — a rota
// ---------------------------------------------------------------------------

const ROTA = readFileSync(
  new URL("../../app/api/assistente/proposta/route.ts", import.meta.url),
  "utf8"
);

test("PREÇO entrou no caminho atômico", () => {
  assert.match(ROTA, /const atomico = p\.tipo === "peso" \|\| p\.tipo === "custo" \|\| p\.tipo === "preco"/);
  assert.match(ROTA, /executarPrecoNaTransacao\(p, clienteDaSessao\)/);
});

test("PREÇO não passa mais por `reservarParaExecucao` — nem por `gravar`", () => {
  // `gravar` perdeu o ramo de preço: ele agora LANÇA, porque cair nos ramos
  // seguintes gravaria PESO num produto.
  assert.match(ROTA, /preço não passa mais por `gravar`/);
  assert.ok(!/aplicarPreco\(/.test(ROTA), "a rota ainda chama `aplicarPreco`: há dois caminhos");
});

test("a margem é calculada NA ROTA, imediatamente antes da chamada", () => {
  const bloco = ROTA.slice(
    ROTA.indexOf("async function executarPrecoNaTransacao"),
    ROTA.indexOf("/** Executa a escrita pelo mesmo caminho")
  );
  assert.match(bloco, /estadoParaRevalidar\(clienteId, p\.alvos\[0\]\)/);
  assert.match(bloco, /margemLiquida\(atual\.custo, p\.valor, atual\.taxas\)/);
  // Produto sumido: `nada_gravado` SEM chamar a RPC — e sem tocar no status.
  assert.match(bloco, /if \(!atual\) return \{ motivo: "nada_gravado"/);
});

test("o `depois` do preço mantém a forma que a auditoria e a procedência leem", () => {
  assert.match(ROTA, /\{ preco: p\.valor, margem: rpc!\.margem \?\? null \}/);
});

test("zero linhas NÃO queima a proposta — vale para os três tipos atômicos", () => {
  assert.match(ROTA, /if \(!atomico\) await marcarProposta\(p\.id, "falhou"/);
});

test("título e cadastro continuam fora", () => {
  for (const tipo of ["titulo", "cadastro"]) {
    assert.ok(
      !new RegExp(`p\\.tipo === "${tipo}"[\\s\\S]{0,80}executar\\w+Atomico`).test(ROTA),
      `${tipo} encostou numa primitiva atômica`
    );
  }
});

// ---------------------------------------------------------------------------
// GUARDA ESTRUTURAL — a migração 047
// ---------------------------------------------------------------------------

const SQL = readFileSync(
  new URL("../../../database/migrations/047-execucao-atomica-do-preco.sql", import.meta.url),
  "utf8"
);
const semComentarios = SQL.replace(/^\s*--.*$/gm, "");

test("047: A MARGEM NUNCA É CRITÉRIO — aparece só no SET do UPDATE", () => {
  // O coração deste ciclo. Se alguém usar `p_margem` num `if`, num filtro ou
  // numa comparação, ela deixa de ser valor derivado e vira decisão.
  // Sobre o CORPO da função — não sobre o arquivo. Fora do corpo, `p_margem`
  // aparece legitimamente na assinatura e no texto do `comment on function`,
  // que é string SQL e não comentário `--`.
  const corpo = semComentarios.slice(
    semComentarios.indexOf("as $$"),
    semComentarios.indexOf("$$;")
  );
  const usos = corpo.match(/p_margem/g) ?? [];
  assert.equal(usos.length, 1, `p_margem aparece ${usos.length} vezes no corpo; deve aparecer 1`);
  assert.match(corpo, /margem\s*=\s*p_margem/);
  for (const proibido of [/if[^;]*p_margem/i, /where[^;]*p_margem/i, /p_margem\s*(<|>|<>|is )/]) {
    assert.ok(!proibido.test(corpo), `p_margem virou critério: ${proibido}`);
  }
});

test("047: a transição de status vem DEPOIS da mutação", () => {
  const mutacao = SQL.indexOf("update public.produtos");
  const status = SQL.indexOf("set status = 'executada'");
  assert.ok(mutacao > 0 && status > 0);
  assert.ok(status > mutacao, "a transição voltou a acontecer ANTES da mutação: o T1 renasceu");
});

test("047: zero linhas retorna sem tocar no status", () => {
  const ini = SQL.indexOf("if v_afetados = 0");
  const bloco = SQL.slice(ini, SQL.indexOf("end if;", ini));
  assert.match(bloco, /nada_gravado/);
  assert.ok(!/update public\.copilot_propostas/.test(bloco));
});

test("047: trava a proposta antes de qualquer decisão", () => {
  const ate = SQL.slice(0, SQL.indexOf("update public.produtos"));
  assert.match(ate, /from public\.copilot_propostas[\s\S]{0,80}for update/);
});

test("047: o PREÇO vem da Proposal, não do parâmetro", () => {
  const update = SQL.slice(SQL.indexOf("update public.produtos"), SQL.indexOf("get diagnostics"));
  assert.match(update, /preco_venda = v_valor/);
  assert.match(update, /where id = v_produto/);
  assert.match(update, /and cliente_id = p_cliente/);
});

test("047: recusa proposta que não seja de preço", () => {
  assert.match(SQL, /v_tipo is distinct from 'preco'[\s\S]{0,60}tipo_invalido/);
});

test("047: SECURITY INVOKER e execute só para service_role", () => {
  const declaracao = SQL.slice(
    SQL.indexOf("create or replace function public.copilot_executar_preco"),
    SQL.indexOf("as $$")
  );
  assert.match(declaracao, /security invoker/i);
  assert.ok(!/security definer/i.test(declaracao));
  for (const papel of ["public", "anon", "authenticated"]) {
    assert.match(SQL, new RegExp(`revoke all on function[\\s\\S]{0,140}from ${papel}`, "i"));
  }
  assert.match(SQL, /grant execute on function[\s\S]{0,140}to service_role/i);
});

test("047: aditiva — sem tabela, coluna, RLS, policy ou backfill", () => {
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

test("047: confere que as funções das 045 e 046 continuam existindo", () => {
  assert.match(SQL, /copilot_executar_peso[\s\S]{0,120}copilot_executar_custo/);
  assert.match(SQL, /as funcoes das 045\/046 nao estao ambas presentes/);
});

test("047: registra a si mesma no ledger — regra da 043", () => {
  assert.match(SQL, /insert into public\.migracoes_aplicadas[\s\S]*'047'/);
});

// ---------------------------------------------------------------------------
// A VERIFICAÇÃO QUE AUTORIZOU O DESENHO — congelada
// ---------------------------------------------------------------------------

test("margem NÃO é precondição em lugar nenhum do domínio", () => {
  const conversa = readFileSync(
    new URL("../../modules/pricing/domain/conversaDePreco.ts", import.meta.url),
    "utf8"
  );
  const ini = conversa.indexOf("export function precondicoesDePreco");
  // Até o `];` do return — o `\n}` fechava a assinatura, não a função.
  const precond = conversa.slice(ini, conversa.indexOf("];", ini));
  const campos = precond.match(/campo:\s*(CAMPO_\w+)/g) ?? [];
  assert.equal(campos.length, 4, `esperava 4 precondições de preço, achei ${campos.length}`);
  for (const c of campos) {
    assert.ok(!/MARGEM/i.test(c), `margem virou precondição: ${c}`);
  }
});

test("`podeExecutar` não conhece margem", () => {
  const fonte = readFileSync(
    new URL("../../modules/assistant/domain/propostaPersistida.ts", import.meta.url),
    "utf8"
  );
  const corpo = fonte
    .slice(fonte.indexOf("export function podeExecutar"))
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/margem/i.test(corpo));
});
