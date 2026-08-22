// Persistência do vínculo do canal — o contrato depois da 061.
//
// Puros: o cliente de persistência é injetado, nenhum teste toca rede ou
// banco, nenhum segredo real é usado.
//
// O QUE MUDOU EM RELAÇÃO À LINHA DE BASE ANTERIOR
//
// Até a 059 estas funções liam e gravavam `refresh_token` direto na tabela,
// com o token do usuário. A 059 fechou a coluna para o navegador; a 061 a
// cifrou e pôs QUATRO FUNÇÕES na frente (`ml_credencial_*`), executáveis só
// por service_role. O servidor deixa de tocar na coluna: os campos públicos
// continuam vindo da tabela, a credencial vem de um RPC que decifra com a
// chave do Vault no momento do uso.
//
// A invariante que estes testes protegem, além do comportamento: NENHUMA
// destas funções seleciona, grava ou atualiza `refresh_token` nem
// `refresh_token_cifrado`. Se voltar, o token volta a passar pela tabela.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  lerCanalServidor,
  salvarRefreshTokenServidor,
  atualizarRefreshTokenServidor,
  limparCredencialServidor,
} from "./canalServidor.ts";

// ---- Substituto em memória ----

type Resposta = { data?: unknown; error?: { message: string } | null };

type Chamada =
  | { tipo: "select"; tabela: string; colunas: string; filtros: Array<[string, unknown]>; maybeSingle: boolean }
  | { tipo: "rpc"; fn: string; args: Record<string, unknown> };

class ClienteFake {
  readonly chamadas: Chamada[] = [];
  constructor(
    private readonly tabela: Resposta = {},
    private readonly rpcs: Record<string, Resposta> = {}
  ) {}

  get ultima(): Chamada {
    assert.ok(this.chamadas.length > 0, "nenhuma chamada foi registrada");
    return this.chamadas[this.chamadas.length - 1];
  }

  from(tabela: string) {
    const chamadas = this.chamadas;
    const resposta = this.tabela;
    return {
      select: (colunas: string) => {
        const c: Extract<Chamada, { tipo: "select" }> = { tipo: "select", tabela, colunas, filtros: [], maybeSingle: false };
        chamadas.push(c);
        const alvo = {
          eq(col: string, v: unknown) { c.filtros.push([col, v]); return alvo; },
          maybeSingle() { c.maybeSingle = true; return Promise.resolve(resposta); },
        };
        return alvo;
      },
      // Se alguém voltar a escrever na tabela, o dublê acusa — não existe.
      upsert: () => { throw new Error("o servidor não grava mais em canais_marketplace"); },
      update: () => { throw new Error("o servidor não grava mais em canais_marketplace"); },
    };
  }

  rpc(fn: string, args: Record<string, unknown>) {
    this.chamadas.push({ tipo: "rpc", fn, args });
    return Promise.resolve(this.rpcs[fn] ?? { data: null, error: null });
  }
}

type Cliente = Parameters<typeof lerCanalServidor>[0];
function cliente(tabela: Resposta = {}, rpcs: Record<string, Resposta> = {}) {
  const fake = new ClienteFake(tabela, rpcs);
  return { fake, injetado: fake as unknown as Cliente };
}

// ---- a invariante: a coluna não aparece no código ----

test("o servidor nunca seleciona nem grava a coluna da credencial", () => {
  const fonte = readFileSync(new URL("./canalServidor.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/refresh_token/.test(fonte), "`refresh_token` voltou a aparecer em canalServidor.ts");
  assert.ok(!/\.upsert\(|\.update\(/.test(fonte), "o servidor voltou a escrever na tabela");
  for (const fn of ["ml_credencial_ler", "ml_credencial_gravar", "ml_credencial_rotacionar", "ml_credencial_limpar"]) {
    assert.ok(fonte.includes(`"${fn}"`), `faltou o RPC ${fn}`);
  }
});

// ---- lerCanalServidor ----

test("lerCanalServidor: campos públicos da tabela, credencial pelo RPC — nesta ordem", async () => {
  const { fake, injetado } = cliente(
    { data: { seller_id: "123456", tipo_anuncio: "Clássico", ativo: false }, error: null },
    { ml_credencial_ler: { data: "TG-fake-1", error: null } }
  );
  const canal = await lerCanalServidor(injetado, "cli-1");

  assert.equal(fake.chamadas.length, 2);
  const [sel, rpc] = fake.chamadas;
  assert.equal(sel.tipo, "select");
  if (sel.tipo === "select") {
    assert.equal(sel.tabela, "canais_marketplace");
    assert.equal(sel.colunas, "seller_id, tipo_anuncio, ativo");
    assert.deepEqual(sel.filtros, [["cliente_id", "cli-1"], ["marketplace", "Mercado Livre"]]);
    assert.equal(sel.maybeSingle, true);
  }
  assert.deepEqual(rpc, { tipo: "rpc", fn: "ml_credencial_ler", args: { p_cliente: "cli-1", p_marketplace: "Mercado Livre" } });
  assert.deepEqual(canal, { refreshToken: "TG-fake-1", sellerId: "123456", tipoAnuncio: "Clássico", ativo: false });
});

test("lerCanalServidor: marketplace explícito vai para a tabela E para o RPC", async () => {
  const { fake, injetado } = cliente({ data: { seller_id: null, tipo_anuncio: null, ativo: null }, error: null });
  await lerCanalServidor(injetado, "cli-1", "Shopee");
  const rpc = fake.ultima;
  assert.equal(rpc.tipo === "rpc" && rpc.args.p_marketplace, "Shopee");
});

test("lerCanalServidor: sem linha devolve null e NÃO chama o RPC", async () => {
  const { fake, injetado } = cliente({ data: null, error: null });
  assert.equal(await lerCanalServidor(injetado, "cli-inexistente"), null);
  assert.equal(fake.chamadas.length, 1, "decifrou a credencial de um canal que não existe");
});

test("lerCanalServidor: nulos recebem os padrões (Premium, ativo); credencial nula fica nula", async () => {
  const { injetado } = cliente(
    { data: { seller_id: null, tipo_anuncio: null, ativo: null }, error: null },
    { ml_credencial_ler: { data: null, error: null } }
  );
  assert.deepEqual(await lerCanalServidor(injetado, "cli-1"), {
    refreshToken: null, sellerId: null, tipoAnuncio: "Premium", ativo: true,
  });
});

test("lerCanalServidor: erro da tabela e erro do RPC propagam com a mensagem", async () => {
  const t = cliente({ data: null, error: { message: "permissão negada" } });
  await assert.rejects(() => lerCanalServidor(t.injetado, "cli-1"), { message: "permissão negada" });

  const r = cliente(
    { data: { seller_id: null, tipo_anuncio: null, ativo: null }, error: null },
    { ml_credencial_ler: { data: null, error: { message: "chave ausente no Vault" } } }
  );
  await assert.rejects(() => lerCanalServidor(r.injetado, "cli-1"), { message: "chave ausente no Vault" });
});

// ---- salvarRefreshTokenServidor ----

test("salvarRefreshTokenServidor: RPC de gravar com tenant, marketplace, token e seller", async () => {
  const { fake, injetado } = cliente();
  await salvarRefreshTokenServidor(injetado, "cli-1", "TG-fake-2", "Mercado Livre", { sellerId: "987" });
  assert.deepEqual(fake.ultima, {
    tipo: "rpc", fn: "ml_credencial_gravar",
    args: { p_cliente: "cli-1", p_marketplace: "Mercado Livre", p_token: "TG-fake-2", p_seller_id: "987" },
  });
});

test("salvarRefreshTokenServidor: sem seller manda null (a função preserva o existente)", async () => {
  const { fake, injetado } = cliente();
  await salvarRefreshTokenServidor(injetado, "cli-1", "TG-fake-3");
  assert.equal(fake.ultima.tipo === "rpc" && fake.ultima.args.p_seller_id, null);
});

test("salvarRefreshTokenServidor: erro propagado", async () => {
  const { injetado } = cliente({}, { ml_credencial_gravar: { error: { message: "token vazio" } } });
  await assert.rejects(() => salvarRefreshTokenServidor(injetado, "cli-1", "x"), { message: "token vazio" });
});

// ---- atualizarRefreshTokenServidor ----

test("atualizarRefreshTokenServidor: RPC de rotacionar", async () => {
  const { fake, injetado } = cliente();
  await atualizarRefreshTokenServidor(injetado, "cli-1", "TG-fake-5", "Shopee");
  assert.deepEqual(fake.ultima, {
    tipo: "rpc", fn: "ml_credencial_rotacionar",
    args: { p_cliente: "cli-1", p_marketplace: "Shopee", p_token: "TG-fake-5" },
  });
});

test("atualizarRefreshTokenServidor: token vazio é no-op — nenhuma chamada", async () => {
  const { fake, injetado } = cliente({}, { ml_credencial_rotacionar: { error: { message: "nunca" } } });
  await atualizarRefreshTokenServidor(injetado, "cli-1", "");
  assert.equal(fake.chamadas.length, 0);
});

test("atualizarRefreshTokenServidor: erro propagado", async () => {
  const { injetado } = cliente({}, { ml_credencial_rotacionar: { error: { message: "linha bloqueada" } } });
  await assert.rejects(() => atualizarRefreshTokenServidor(injetado, "cli-1", "t"), { message: "linha bloqueada" });
});

// ---- limparCredencialServidor ----

test("limparCredencialServidor: RPC de limpar, e só", async () => {
  const { fake, injetado } = cliente();
  await limparCredencialServidor(injetado, "cli-1");
  assert.deepEqual(fake.chamadas, [
    { tipo: "rpc", fn: "ml_credencial_limpar", args: { p_cliente: "cli-1", p_marketplace: "Mercado Livre" } },
  ]);
});
