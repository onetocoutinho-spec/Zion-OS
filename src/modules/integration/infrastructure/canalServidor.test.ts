// Linha de base da R2 — Persistência do vínculo do canal.
// Puros: o cliente de persistência é injetado por parâmetro, então nenhum
// teste toca rede ou banco. Nenhum segredo real é usado.
// Rodar: node --test src/lib/marketplaces/canalServidor.test.ts
//
// Estes testes registram o comportamento ATUAL, não o desejado. Não dependem
// de nenhuma responsabilidade já migrada nem de dependência externa: o tipo do
// cliente é derivado da própria assinatura das funções.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lerCanalServidor,
  salvarRefreshTokenServidor,
  atualizarRefreshTokenServidor,
} from "./canalServidor.ts";

// ---- Substituto em memória do cliente de persistência ----

type Resposta = { data?: unknown; error?: { message: string } | null };

type Chamada = {
  tabela: string;
  operacao: "select" | "upsert" | "update";
  colunas?: string;
  linha?: Record<string, unknown>;
  opcoes?: unknown;
  patch?: Record<string, unknown>;
  filtros: Array<[string, unknown]>;
  maybeSingle: boolean;
};

class ClienteFake {
  readonly chamadas: Chamada[] = [];

  constructor(private readonly resposta: Resposta = {}) {}

  get ultima(): Chamada {
    assert.ok(this.chamadas.length > 0, "nenhuma chamada foi registrada");
    return this.chamadas[this.chamadas.length - 1];
  }

  from(tabela: string) {
    const resposta = this.resposta;
    const chamadas = this.chamadas;

    const registrar = (operacao: Chamada["operacao"], extra: Partial<Chamada>): Chamada => {
      const chamada: Chamada = { tabela, operacao, filtros: [], maybeSingle: false, ...extra };
      chamadas.push(chamada);
      return chamada;
    };

    // O construtor de consulta do Supabase é encadeável E aguardável: `.eq()`
    // devolve a si mesmo e o próprio objeto resolve quando aguardado.
    const encadeavel = (chamada: Chamada) => {
      const alvo = {
        eq(coluna: string, valor: unknown) {
          chamada.filtros.push([coluna, valor]);
          return alvo;
        },
        maybeSingle() {
          chamada.maybeSingle = true;
          return Promise.resolve(resposta);
        },
        then<T>(ok: (v: Resposta) => T, falha?: (e: unknown) => T) {
          return Promise.resolve(resposta).then(ok, falha);
        },
      };
      return alvo;
    };

    return {
      select: (colunas: string) => encadeavel(registrar("select", { colunas })),
      upsert: (linha: Record<string, unknown>, opcoes: unknown) =>
        encadeavel(registrar("upsert", { linha, opcoes })),
      update: (patch: Record<string, unknown>) => encadeavel(registrar("update", { patch })),
    };
  }
}

/** Tipo do cliente derivado da própria assinatura — sem dependência externa. */
type Cliente = Parameters<typeof lerCanalServidor>[0];

function cliente(resposta: Resposta = {}): { fake: ClienteFake; injetado: Cliente } {
  const fake = new ClienteFake(resposta);
  return { fake, injetado: fake as unknown as Cliente };
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// ---- lerCanalServidor ----

test("lerCanalServidor: consulta a tabela e as colunas exatas, com marketplace padrão", async () => {
  const { fake, injetado } = cliente({ data: null, error: null });
  await lerCanalServidor(injetado, "cli-1");

  const c = fake.ultima;
  assert.equal(c.tabela, "canais_marketplace");
  assert.equal(c.operacao, "select");
  assert.equal(c.colunas, "refresh_token, seller_id, tipo_anuncio, ativo");
  assert.deepEqual(c.filtros, [
    ["cliente_id", "cli-1"],
    ["marketplace", "Mercado Livre"], // padrão
  ]);
  assert.equal(c.maybeSingle, true); // ausência não é erro
});

test("lerCanalServidor: marketplace explícito substitui o padrão", async () => {
  const { fake, injetado } = cliente({ data: null, error: null });
  await lerCanalServidor(injetado, "cli-1", "Shopee");
  assert.deepEqual(fake.ultima.filtros, [
    ["cliente_id", "cli-1"],
    ["marketplace", "Shopee"],
  ]);
});

test("lerCanalServidor: registro encontrado é mapeado campo a campo", async () => {
  const { injetado } = cliente({
    data: {
      refresh_token: "TG-fake-1",
      seller_id: "123456",
      tipo_anuncio: "Clássico",
      ativo: false,
    },
    error: null,
  });
  const canal = await lerCanalServidor(injetado, "cli-1");
  assert.deepEqual(canal, {
    refreshToken: "TG-fake-1",
    sellerId: "123456",
    tipoAnuncio: "Clássico",
    ativo: false,
  });
});

test("lerCanalServidor: campos nulos recebem os padrões — Premium e ativo", async () => {
  const { injetado } = cliente({
    data: { refresh_token: null, seller_id: null, tipo_anuncio: null, ativo: null },
    error: null,
  });
  const canal = await lerCanalServidor(injetado, "cli-1");
  assert.deepEqual(canal, {
    refreshToken: null,
    sellerId: null,
    tipoAnuncio: "Premium", // padrão quando ausente
    ativo: true, // padrão quando ausente
  });
});

test("lerCanalServidor: sem registro devolve null, não lança", async () => {
  const { injetado } = cliente({ data: null, error: null });
  assert.equal(await lerCanalServidor(injetado, "cli-inexistente"), null);
});

test("lerCanalServidor: erro do cliente vira Error com a mensagem original", async () => {
  const { injetado } = cliente({ data: null, error: { message: "permissão negada" } });
  await assert.rejects(() => lerCanalServidor(injetado, "cli-1"), {
    name: "Error",
    message: "permissão negada",
  });
});

// ---- salvarRefreshTokenServidor ----

test("salvarRefreshTokenServidor: upsert com a chave de conflito e a linha completa", async () => {
  const { fake, injetado } = cliente({ error: null });
  await salvarRefreshTokenServidor(injetado, "cli-1", "TG-fake-2");

  const c = fake.ultima;
  assert.equal(c.tabela, "canais_marketplace");
  assert.equal(c.operacao, "upsert");
  assert.deepEqual(c.opcoes, { onConflict: "cliente_id,marketplace" });
  assert.equal(c.linha?.cliente_id, "cli-1");
  assert.equal(c.linha?.marketplace, "Mercado Livre");
  assert.equal(c.linha?.refresh_token, "TG-fake-2");
  assert.equal(c.linha?.ativo, true); // gravar sempre reativa o canal
  assert.match(String(c.linha?.atualizado_em), ISO);
});

test("salvarRefreshTokenServidor: seller_id só entra na linha quando informado", async () => {
  const comSeller = cliente({ error: null });
  await salvarRefreshTokenServidor(comSeller.injetado, "cli-1", "TG-fake-3", "Mercado Livre", {
    sellerId: "987",
  });
  assert.equal(comSeller.fake.ultima.linha?.seller_id, "987");

  const semSeller = cliente({ error: null });
  await salvarRefreshTokenServidor(semSeller.injetado, "cli-1", "TG-fake-3");
  assert.equal("seller_id" in (semSeller.fake.ultima.linha ?? {}), false);

  const sellerNulo = cliente({ error: null });
  await salvarRefreshTokenServidor(sellerNulo.injetado, "cli-1", "TG-fake-3", "Mercado Livre", {
    sellerId: null,
  });
  assert.equal("seller_id" in (sellerNulo.fake.ultima.linha ?? {}), false);
});

test("salvarRefreshTokenServidor: marketplace explícito e erro propagado", async () => {
  const ok = cliente({ error: null });
  await salvarRefreshTokenServidor(ok.injetado, "cli-1", "TG-fake-4", "Shopee");
  assert.equal(ok.fake.ultima.linha?.marketplace, "Shopee");

  const falha = cliente({ error: { message: "violação de unicidade" } });
  await assert.rejects(() => salvarRefreshTokenServidor(falha.injetado, "cli-1", "TG-fake-4"), {
    message: "violação de unicidade",
  });
});

// ---- atualizarRefreshTokenServidor ----

test("atualizarRefreshTokenServidor: atualiza apenas token e carimbo, filtrando por cliente e canal", async () => {
  const { fake, injetado } = cliente({ error: null });
  await atualizarRefreshTokenServidor(injetado, "cli-1", "TG-fake-5");

  const c = fake.ultima;
  assert.equal(c.tabela, "canais_marketplace");
  assert.equal(c.operacao, "update");
  assert.equal(c.patch?.refresh_token, "TG-fake-5");
  assert.match(String(c.patch?.atualizado_em), ISO);
  // A rotação NÃO mexe em `ativo` — diferentemente da gravação inicial.
  assert.deepEqual(Object.keys(c.patch ?? {}).sort(), ["atualizado_em", "refresh_token"]);
  assert.deepEqual(c.filtros, [
    ["cliente_id", "cli-1"],
    ["marketplace", "Mercado Livre"],
  ]);
});

test("atualizarRefreshTokenServidor: token vazio é no-op — nenhuma chamada ao cliente", async () => {
  const vazio = cliente({ error: null });
  await atualizarRefreshTokenServidor(vazio.injetado, "cli-1", "");
  assert.equal(vazio.fake.chamadas.length, 0);

  // Mesmo com erro configurado, o no-op não lança: sequer chega ao cliente.
  const comErro = cliente({ error: { message: "nunca deveria ocorrer" } });
  await atualizarRefreshTokenServidor(comErro.injetado, "cli-1", "");
  assert.equal(comErro.fake.chamadas.length, 0);
});

test("atualizarRefreshTokenServidor: marketplace explícito e erro propagado", async () => {
  const ok = cliente({ error: null });
  await atualizarRefreshTokenServidor(ok.injetado, "cli-1", "TG-fake-6", "Shopee");
  assert.deepEqual(ok.fake.ultima.filtros, [
    ["cliente_id", "cli-1"],
    ["marketplace", "Shopee"],
  ]);

  const falha = cliente({ error: { message: "linha bloqueada" } });
  await assert.rejects(() => atualizarRefreshTokenServidor(falha.injetado, "cli-1", "TG-fake-6"), {
    message: "linha bloqueada",
  });
});
