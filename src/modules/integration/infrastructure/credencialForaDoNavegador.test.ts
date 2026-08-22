// ZION-AGENCY-001 + ZION-SECRET-001 — a credencial do ML fora do navegador.
//
// O QUE ESTE TESTE PROVA
//
// A auditoria de 2026-08-21 mediu duas vias pelas quais `refresh_token`
// chegava ao navegador: a política `agencia_escopo` (054) na tabela de
// credencial, e `cliente_escopo` (011) `for all` — ambas via PostgREST com a
// anon key, sem rota nenhuma no meio.
//
// O fechamento tem DOIS lados que precisam andar juntos, e é isso que se
// testa aqui: a migração 059 tira o GRANT da coluna para `authenticated`; o
// código troca o cliente do usuário pelo admin em toda leitura/escrita da
// credencial. Um sem o outro é pior que nenhum: só a migração quebra a
// publicação; só o código deixa a exposição aberta.
//
// Não há banco neste teste. O que dá para provar sem ele é a INVARIANTE
// estrutural — o padrão desta base (ver reconexaoDoCanal.test.ts). Cada
// asserção abaixo FALHAVA no commit 106f95a.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

// ---------------------------------------------------------------------------
// A MIGRAÇÃO
// ---------------------------------------------------------------------------

const MIGRACAO = "database/migrations/059-a-credencial-do-ml-sai-do-alcance-do-navegador.sql";

test("059 existe e tira agencia_escopo de canais_marketplace", () => {
  assert.ok(existsSync(join(RAIZ, MIGRACAO)), "a migração 059 sumiu");
  const sql = ler(MIGRACAO).replace(/^\s*--.*$/gm, "");
  assert.match(
    sql,
    /drop\s+policy\s+if\s+exists\s+agencia_escopo\s+on\s+public\.canais_marketplace/i,
    "a agência voltou a alcançar a tabela de credencial (ZION-AGENCY-001)"
  );
});

test("059 revoga a coluna refresh_token de authenticated — via revoke-tabela + grant por coluna", () => {
  const sql = ler(MIGRACAO).replace(/^\s*--.*$/gm, "");
  // REVOKE de coluna sobre um GRANT de tabela inteira é IGNORADO pelo Postgres.
  // O único jeito é revogar a tabela e devolver por coluna — sem a coluna.
  assert.match(sql, /revoke\s+all\s+on\s+table\s+public\.canais_marketplace\s+from\s+authenticated/i);
  const grants = [...sql.matchAll(/grant\s+(select|insert|update)\s*\(([^)]*)\)\s+on\s+table\s+public\.canais_marketplace\s+to\s+authenticated/gi)];
  assert.ok(grants.length >= 3, "faltou devolver select/insert/update por coluna");
  for (const g of grants) {
    assert.ok(!/refresh_token/i.test(g[2]), `o grant de ${g[1]} devolveu refresh_token ao navegador`);
  }
  assert.ok(
    !/grant\s+all\s+on\s+table\s+public\.canais_marketplace\s+to\s+authenticated/i.test(sql),
    "um GRANT ALL reabriria a coluna por cima do revoke"
  );
});

test("059 confere o próprio efeito e aborta se não estiver lá (padrão da 041)", () => {
  const sql = ler(MIGRACAO);
  assert.match(sql, /raise\s+exception\s+'MIGRACAO 059 INCOMPLETA/i);
  assert.match(sql, /column_privileges/i, "a prova precisa olhar o privilégio da COLUNA, não só a política");
});

// ---------------------------------------------------------------------------
// O CÓDIGO — quem toca na credencial usa o admin
// ---------------------------------------------------------------------------

const CANAL = "src/modules/integration/infrastructure/canalServidor.ts";
const FUNCOES_DE_CREDENCIAL = [
  "lerCanalServidor",
  "salvarRefreshTokenServidor",
  "atualizarRefreshTokenServidor",
  "limparCredencialServidor",
];

test("canalServidor exporta clienteDaCredencial, e ele é o admin", () => {
  const fonte = ler(CANAL);
  assert.match(fonte, /export\s+function\s+clienteDaCredencial\s*\(/);
  assert.match(fonte, /getSupabaseAdmin\(\)/, "clienteDaCredencial precisa devolver o service_role");
});

test("nenhuma rota /api passa ctx.supabase (papel do usuário) para uma função de credencial", () => {
  const raizApi = join(RAIZ, "src/app/api");
  const rotas: string[] = [];
  (function andar(d: string) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.name === "route.ts") rotas.push(p);
    }
  })(raizApi);

  const ofensores: string[] = [];
  for (const rota of rotas) {
    const fonte = readFileSync(rota, "utf8").replace(/^\s*\/\/.*$/gm, "");
    for (const fn of FUNCOES_DE_CREDENCIAL) {
      // A chamada pode estar quebrada em linhas; o 1º argumento é o que importa.
      const re = new RegExp(`${fn}\\(\\s*ctx\\.supabase`, "g");
      if (re.test(fonte)) ofensores.push(`${rota.slice(RAIZ.length + 1)} → ${fn}(ctx.supabase…)`);
    }
  }
  assert.deepEqual(
    ofensores,
    [],
    "depois da 059 o token do usuário não alcança a coluna: essas chamadas voltariam vazias ou falhariam"
  );
});

test("toda rota que lê a credencial a lê pelo admin", () => {
  // O inverso da asserção anterior: não basta NÃO usar ctx.supabase — tem que
  // usar clienteDaCredencial(). Uma rota que inventasse um terceiro jeito
  // (createClient com anon, por exemplo) passaria no teste de cima.
  const rotasML = readdirSync(join(RAIZ, "src/app/api/ml"))
    .map((d) => `src/app/api/ml/${d}/route.ts`)
    .filter((f) => existsSync(join(RAIZ, f)));
  for (const rota of rotasML) {
    const fonte = ler(rota).replace(/^\s*\/\/.*$/gm, "");
    const usa = FUNCOES_DE_CREDENCIAL.some((fn) => new RegExp(`\\b${fn}\\(`).test(fonte));
    if (!usa) continue; // autorizar só cria ticket; não toca na credencial
    assert.match(fonte, /clienteDaCredencial\(\)/, `${rota} lê a credencial sem o admin`);
  }
});

// ---------------------------------------------------------------------------
// O NAVEGADOR — não escreve a coluna
// ---------------------------------------------------------------------------

test("o serviço do navegador não grava refresh_token (nem para apagar)", () => {
  // Sem comentários de linha E de bloco: os dois que explicam a correção citam
  // `refresh_token: null`, e a asserção acusaria o texto que existe para
  // impedir a regressão (mesmo cuidado de reconexaoDoCanal.test.ts).
  const fonte = ler("src/lib/services/canaisMarketplace.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(
    !/refresh_token\s*[:=]/.test(fonte),
    "o navegador voltou a escrever refresh_token — depois da 059 isso é 'permission denied'"
  );
});

test("desconectar passa por /api/ml/desconectar, não por escrita direta", () => {
  const pagina = ler("src/app/cliente/conectar-ml/page.tsx").replace(/^\s*\/\/.*$/gm, "");
  assert.match(pagina, /fetch\("\/api\/ml\/desconectar"/);
  assert.ok(!/salvarCanal\(\s*\{[^}]*ativo:\s*false/.test(pagina), "o desconectar voltou para o navegador");

  const rota = ler("src/app/api/ml/desconectar/route.ts");
  assert.match(rota, /exigirAcessoAoCliente\(request,\s*clienteId\)/, "a rota precisa da mesma parede das outras");
  assert.match(rota, /limparCredencialServidor\(clienteDaCredencial\(\)/);
});
