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
  opcoes: {
    pararNoOffset?: number;
    /**
     * MLBs que o multiget SEMPRE recusa, com ou sem filtro de campos.
     *
     * A versão anterior quebrava por ORDEM DE CHAMADA (`lotesQuebrados: [1]`),
     * e isso deixou de descrever a realidade quando a leitura passou a repetir
     * o lote sem o filtro: a repetição recebia outro número de chamada e
     * passava. O teste media uma falha TRANSITÓRIA sem querer.
     *
     * Quebrar por CONTEÚDO é o que o nome do teste sempre prometeu.
     */
    idsQuebrados?: string[];
    /** O ML recusa a lista COMPLETA de campos, mas aceita a mínima. */
    recusaFiltro?: boolean;
    /** O `fetch` LANÇA no pedido completo — sem status, sem corpo. */
    lancaExcecao?: boolean;
  } = {}
) {
  const ids = Array.from({ length: total }, (_, i) => `MLB${1000 + i}`);
  globalThis.fetch = (async (entrada: unknown) => {
    const url = typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url);
    if (url.includes("/items/search")) {
      const offset = Number(new URL(url).searchParams.get("offset") ?? 0);
      const parar = opcoes.pararNoOffset;
      const pagina = parar != null && offset >= parar ? [] : ids.slice(offset, offset + 50);
      return new Response(JSON.stringify({ results: pagina, paging: { total } }), { status: 200 });
    }
    const params = new URL(url).searchParams;
    const pedidos = (params.get("ids") ?? "").split(",");
    const campos = (params.get("attributes") ?? "").split(",");
    // O ML recusa a lista COMPLETA (31 campos) e aceita a mínima (14).
    if (opcoes.recusaFiltro && campos.length > 20) {
      return new Response('{"message":"invalid attribute"}', { status: 400 });
    }
    // O `fetch` LANÇANDO — foi o que aconteceu em 02/08/2026 e o `catch`
    // externo apagou o motivo.
    if (opcoes.lancaExcecao && campos.length > 20) {
      throw Object.assign(new Error("fetch failed"), { cause: { code: "ECONNRESET" } });
    }
    if (pedidos.some((id) => opcoes.idsQuebrados?.includes(id))) {
      return new Response("erro do ML", { status: 500 });
    }
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

test("lote que falha nas DUAS tentativas é contado, com o erro do ML junto", async () => {
  // `if (!r.ok) return []` derrubava até 20 anúncios sem uma linha de aviso — e
  // em 02/08/2026 derrubou 781 de 781 sem dizer por quê.
  mlFalso(60, { idsQuebrados: ["MLB1020"] }); // cai no 2º lote de 20
  const r = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(r.ids, 60);
  assert.equal(r.anuncios.length, 40);
  assert.equal(r.perdidos, 20, "os 20 do lote quebrado precisam aparecer");
  assert.match(r.erroDoMultiget, /500/, "o erro do ML precisa chegar a quem chamou");
  // A listagem foi completa: a perda é do multiget, não da paginação.
  assert.equal(r.parede, "nenhuma");
});

test("filtro de campos recusado: a leitura REFAZ sem ele e traz tudo", async () => {
  // O caso real de 02/08/2026: pedir 31 campos em vez de 14 fez o ML recusar
  // TODOS os lotes e a importação trouxe ZERO anúncio. Pedir o item inteiro é
  // mais pesado e funciona — muito melhor que zerar.
  mlFalso(60, { recusaFiltro: true });
  const r = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(r.anuncios.length, 60, "a recusa do filtro não pode zerar a leitura");
  assert.equal(r.perdidos, 0);
  assert.equal(r.filtroDeCamposRecusado, true, "a recusa precisa ser DITA");
  assert.match(r.erroDoMultiget, /400/);
});

test("`fetch` que LANÇA também é registrado — foi o caso de 02/08/2026", async () => {
  // Os 781 lotes falharam com `erroDoMultiget` VAZIO. Só é possível se a
  // exceção veio de fora do caminho do `!r.ok` — e o `catch` externo devolvia
  // `[]` apagando o motivo. Quarta vez no dia que um catch mudo vira silêncio.
  mlFalso(60, { lancaExcecao: true });
  const r = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(r.anuncios.length, 60, "a exceção no pedido completo não pode zerar a leitura");
  assert.match(r.erroDoMultiget, /exce[çc][ãa]o/i);
  assert.match(r.erroDoMultiget, /ECONNRESET/, "a causa do undici precisa aparecer");
  assert.equal(r.filtroDeCamposRecusado, true);
});

test("a degradação vai para a lista MÍNIMA, não para sem filtro", async () => {
  // Sem filtro, o ML devolve o item inteiro — 781 itens inteiros é o caminho
  // mais curto para estourar o `maxDuration` de novo.
  const pedidos: string[] = [];
  mlFalso(40, { recusaFiltro: true });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((entrada: unknown) => {
    const url = typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url);
    if (url.includes("/items?")) pedidos.push(url);
    return originalFetch(entrada as never);
  }) as unknown as typeof fetch;

  await buscarAnunciosDoVendedor("tok", "123");
  assert.ok(pedidos.length > 0, "nenhum multiget foi observado");
  assert.ok(
    pedidos.every((u) => u.includes("attributes=")),
    "algum lote foi pedido SEM filtro — o item inteiro estoura o tempo"
  );
});

test("sem recusa, o filtro NÃO é abandonado", async () => {
  // O caminho normal continua pedindo só os campos que interessam: a
  // degradação é exceção, não o padrão.
  mlFalso(20);
  const r = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(r.filtroDeCamposRecusado, false);
  assert.equal(r.erroDoMultiget, "");
});

test("`max` explícito ainda para, e se identifica como teto de quem chamou", async () => {
  mlFalso(561);
  const r = await buscarAnunciosDoVendedor("tok", "123", { max: 100 });
  assert.equal(r.parede, "teto");
  assert.ok(r.ids <= 150, `leu ${r.ids} pedindo no máximo 100`);
});

// ---------------------------------------------------------------------------
// A FALHA FOI DELE OU FOI NOSSA?
// ---------------------------------------------------------------------------

test("exceção NOSSA não é registrada como recusa do ML", async () => {
  // 02/08/2026: `family_id` vem como NÚMERO e eu chamei `.trim()` nele. A
  // exceção estourava no mapeador, era capturada como "lote recusado", e a tela
  // disse que o Mercado Livre havia recusado a lista de campos. Ele nunca
  // recusou. Culpar a fonte por defeito próprio manda procurar no lugar errado.
  mlFalso(20, { lancaExcecao: true });
  const r = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(r.falhaDaLeituraFoiNossa, true);
  assert.match(r.erroDoMultiget, /nosso c[óo]digo/i);
});

test("recusa do ML (HTTP) NÃO é atribuída a nós", async () => {
  mlFalso(20, { recusaFiltro: true });
  const r = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(r.falhaDaLeituraFoiNossa, false);
  assert.match(r.erroDoMultiget, /HTTP 400/);
});

test("leitura sem falha não acusa ninguém", async () => {
  mlFalso(20);
  const r = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(r.falhaDaLeituraFoiNossa, false);
  assert.equal(r.erroDoMultiget, "");
});
