// A leitura do vendedor lê TUDO — e conta o que não conseguiu ler.
//
// ===========================================================================
// O DEFEITO, OBSERVADO EM PRODUÇÃO
// ===========================================================================
//
// Até 2026-08-01 `buscarAnunciosDoVendedor` tinha `const teto = opcoes.max ?? 500`
// e o único chamador não passava `opcoes`. O laço parava nos 500, CALADO.
//
// Naquele dia a importação da Chinelaria trouxe 489 já conhecidos + 11 novos =
// 500 exatos, e a tela disse "489 já existiam" — que se lê como "está tudo em
// dia". O export do ERP listava 561. O `paging.total` estava em toda resposta
// do ML; o laço lia esse campo só para parar mais cedo e jogava fora.
//
// O que estes testes protegem não é o número 500. É a diferença entre o que o
// ML DIZ ter e o que nós lemos ter chegado a quem clicou.

import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buscarAnunciosDoVendedor } from "./mercadolivre.ts";

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

const item = (id: string) => ({
  id,
  title: `Anúncio ${id}`,
  category_id: "MLB273770",
  price: 10,
  available_quantity: 1,
  status: "active",
  permalink: `https://x/${id}`,
  attributes: [],
  pictures: [],
  variations: [],
});

/**
 * Um ML de mentira com `total` anúncios.
 *
 * `paginasVazias` faz o search devolver `[]` a partir de certo offset mesmo
 * havendo mais — é o ML parando sem dizer por quê. `lotesQuebrados` faz o
 * multiget responder 500 nos lotes indicados (0-based).
 */
function mlFalso(
  total: number,
  opcoes: { pararNoOffset?: number; lotesQuebrados?: number[] } = {}
) {
  const ids = Array.from({ length: total }, (_, i) => `MLB${1000 + i}`);
  let loteAtual = -1;
  globalThis.fetch = (async (entrada: unknown) => {
    const url = typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url);
    if (url.includes("/items/search")) {
      const offset = Number(new URL(url).searchParams.get("offset") ?? 0);
      const parar = opcoes.pararNoOffset;
      const pagina = parar != null && offset >= parar ? [] : ids.slice(offset, offset + 50);
      return new Response(JSON.stringify({ results: pagina, paging: { total } }), { status: 200 });
    }
    loteAtual++;
    if (opcoes.lotesQuebrados?.includes(loteAtual)) {
      return new Response("erro do ML", { status: 500 });
    }
    const pedidos = (new URL(url).searchParams.get("ids") ?? "").split(",");
    return new Response(
      JSON.stringify(pedidos.map((id) => ({ code: 200, body: item(id) }))),
      { status: 200 }
    );
  }) as unknown as typeof fetch;
}

// ---------------------------------------------------------------------------
// O TETO DE 500 NÃO EXISTE MAIS
// ---------------------------------------------------------------------------

test("lê os 561 da conta — o teto de 500 sumiu", async () => {
  mlFalso(561);
  const r = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(r.anuncios.length, 561, "parou antes do fim");
  assert.equal(r.ids, 561);
  assert.equal(r.total, 561);
  assert.equal(r.parede, "nenhuma");
  assert.equal(r.perdidos, 0);
});

test("o `paging.total` do ML chega a quem chamou — antes era descartado", async () => {
  mlFalso(561);
  const r = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(r.total, 561);
});

test("conta pequena continua funcionando, e sem inventar parede", async () => {
  mlFalso(7);
  const r = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(r.anuncios.length, 7);
  assert.equal(r.parede, "nenhuma");
});

test("conta vazia: zero anúncios, zero parede, total 0", async () => {
  mlFalso(0);
  const r = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(r.anuncios.length, 0);
  assert.equal(r.total, 0);
  assert.equal(r.parede, "nenhuma");
});

// ---------------------------------------------------------------------------
// AS PAREDES SÃO NOMEADAS, NÃO ENGOLIDAS
// ---------------------------------------------------------------------------

test("acima de 1.000 o ML trava — e a parede é DITA, não escondida", async () => {
  // O `/items/search` clássico recusa offset >= 1000. Ler além exige
  // `search_type=scan`, que não está implementado. Enquanto não estiver, a
  // resposta precisa dizer que faltou — senão volta o defeito de 2026-08-01
  // em outro número.
  mlFalso(1200);
  const r = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(r.parede, "offset-1000");
  assert.equal(r.ids, 1000);
  assert.equal(r.total, 1200, "o total real precisa sobreviver à parede");
});

test("o ML parar de devolver páginas antes do total é uma parede", async () => {
  mlFalso(561, { pararNoOffset: 300 });
  const r = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(r.parede, "paginacao-parou");
  assert.equal(r.ids, 300);
  assert.equal(r.total, 561);
});

test("lote do multiget que falha é CONTADO — antes sumia calado", async () => {
  // `if (!r.ok) continue` derrubava até 20 anúncios sem uma linha de aviso.
  mlFalso(60, { lotesQuebrados: [1] });
  const r = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(r.ids, 60);
  assert.equal(r.anuncios.length, 40);
  assert.equal(r.perdidos, 20, "os 20 do lote quebrado precisam aparecer");
  // A listagem foi completa: a perda é do multiget, não da paginação.
  assert.equal(r.parede, "nenhuma");
});

test("`max` explícito ainda para, e se identifica como teto de quem chamou", async () => {
  mlFalso(561);
  const r = await buscarAnunciosDoVendedor("tok", "123", { max: 100 });
  assert.equal(r.parede, "teto");
  assert.ok(r.ids <= 150, `leu ${r.ids} pedindo no máximo 100`);
});
