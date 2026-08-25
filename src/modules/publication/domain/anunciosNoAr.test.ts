// O retrato dos anúncios da loja — o que está no ar, o que não está, e o que
// não sabemos. A regra que este arquivo guarda é uma só: desconhecido NUNCA
// vira ativo.

import test from "node:test";
import assert from "node:assert/strict";
import {
  ATIVOS_LISTADOS,
  DIAS_PARA_ENVELHECER,
  retratoDosAnuncios,
  type AnuncioLido,
} from "./anunciosNoAr";

const AGORA = Date.parse("2026-08-24T12:00:00Z");
const dias = (n: number) => new Date(AGORA - n * 86_400_000).toISOString();

const linha = (p: Partial<AnuncioLido> & { mlItemId: string | null }): AnuncioLido => ({
  titulo: "Chinelo",
  permalink: null,
  statusMarketplace: null,
  statusMarketplaceEm: null,
  subStatusMarketplace: null,
  ...p,
});

test("os três eixos não se misturam: ativo, outro estado, e SEM LEITURA", () => {
  const r = retratoDosAnuncios(
    [
      linha({ mlItemId: "MLB1", statusMarketplace: "active", statusMarketplaceEm: dias(1) }),
      linha({ mlItemId: "MLB2", statusMarketplace: "paused", statusMarketplaceEm: dias(1) }),
      linha({ mlItemId: "MLB3", statusMarketplace: null }),
      // Sem MLB não é anúncio no marketplace — é produto sem publicação.
      linha({ mlItemId: null, statusMarketplace: "active" }),
    ],
    AGORA
  );
  assert.equal(r.comMlb, 3, "o produto sem MLB não entra no universo");
  assert.equal(r.totalAtivos, 1);
  assert.equal(r.semLeitura, 1);
  assert.deepEqual(
    r.outros.map((o) => [o.estado, o.quantos]),
    [["paused", 1]]
  );
  // A soma fecha: nada some e nada é contado duas vezes.
  assert.equal(r.totalAtivos + r.outros.reduce((t, o) => t + o.quantos, 0) + r.semLeitura, r.comMlb);
});

test("um anúncio sem leitura NÃO é inativo nem ativo — é desconhecido", () => {
  const r = retratoDosAnuncios([linha({ mlItemId: "MLB1", statusMarketplace: "  " })], AGORA);
  assert.equal(r.totalAtivos, 0);
  assert.equal(r.semLeitura, 1, "string em branco é ausência de leitura, não estado");
  assert.deepEqual(r.outros, []);
});

test("a idade da leitura vem junto — um 'active' de três semanas não é 'hoje'", () => {
  const r = retratoDosAnuncios(
    [
      linha({ mlItemId: "MLB1", statusMarketplace: "active", statusMarketplaceEm: dias(21) }),
      linha({ mlItemId: "MLB2", statusMarketplace: "active", statusMarketplaceEm: dias(1) }),
    ],
    AGORA
  );
  assert.equal(r.ativos[0].lidoHaDias, 21);
  assert.equal(r.leituraMaisAntigaEmDias, 21);
  assert.equal(r.desatualizados, 1, `só o de 21 dias passa de ${DIAS_PARA_ENVELHECER}`);
});

test("os estados vêm do maior para o menor, com a palavra do ML e os motivos dele", () => {
  const r = retratoDosAnuncios(
    [
      ...Array.from({ length: 3 }, (_, i) =>
        linha({ mlItemId: `P${i}`, statusMarketplace: "paused", subStatusMarketplace: i === 0 ? ["out_of_stock"] : null })
      ),
      linha({ mlItemId: "R1", statusMarketplace: "under_review", subStatusMarketplace: ["forbidden", "forbidden"] }),
    ],
    AGORA
  );
  assert.deepEqual(
    r.outros.map((o) => o.estado),
    ["paused", "under_review"]
  );
  assert.deepEqual(r.outros[0].motivos, ["out_of_stock"], "motivo de UM não vira motivo de todos");
  assert.deepEqual(r.outros[1].motivos, ["forbidden"], "motivo repetido conta uma vez");
  assert.equal(r.outros[0].exemplos.length, 3);
});

test("a lista de ativos é recortada, mas o TOTAL não — a contagem não mente", () => {
  const muitos = Array.from({ length: ATIVOS_LISTADOS + 15 }, (_, i) =>
    linha({ mlItemId: `MLB${i}`, statusMarketplace: "active", statusMarketplaceEm: dias(0) })
  );
  const r = retratoDosAnuncios(muitos, AGORA);
  assert.equal(r.ativos.length, ATIVOS_LISTADOS);
  assert.equal(r.totalAtivos, ATIVOS_LISTADOS + 15);
});

test("ACTIVE em maiúscula é o mesmo estado — a caixa do ML não cria um grupo novo", () => {
  const r = retratoDosAnuncios([linha({ mlItemId: "MLB1", statusMarketplace: "ACTIVE" })], AGORA);
  assert.equal(r.totalAtivos, 1);
});

test("data ilegível não vira idade zero — vira ausência de data", () => {
  const r = retratoDosAnuncios(
    [linha({ mlItemId: "MLB1", statusMarketplace: "active", statusMarketplaceEm: "ontem" })],
    AGORA
  );
  assert.equal(r.ativos[0].lidoHaDias, null);
  assert.equal(r.leituraMaisAntigaEmDias, null);
  assert.equal(r.desatualizados, 0);
});

test("loja sem anúncio nenhum devolve zeros, não erro", () => {
  const r = retratoDosAnuncios([], AGORA);
  assert.deepEqual(r, {
    comMlb: 0,
    ativos: [],
    totalAtivos: 0,
    outros: [],
    semLeitura: 0,
    desatualizados: 0,
    leituraMaisAntigaEmDias: null,
  });
});

test("o retrato da loja real de 24/08/2026 fecha nos números que o banco tem", () => {
  // 489 active, 155 under_review, 123 paused, 12 closed, 2 inactive, 11 sem
  // leitura — medidos em produção. O teste existe para o dia em que alguém
  // mudar a regra e os números pararem de fechar.
  const monta = (estado: string | null, quantos: number, quandoDias: number | null) =>
    Array.from({ length: quantos }, (_, i) =>
      linha({
        mlItemId: `${estado ?? "sem"}-${i}`,
        statusMarketplace: estado,
        statusMarketplaceEm: quandoDias === null ? null : dias(quandoDias),
      })
    );
  const r = retratoDosAnuncios(
    [
      ...monta("active", 489, 10),
      ...monta("under_review", 155, 11),
      ...monta("paused", 123, 10),
      ...monta("closed", 12, 14),
      ...monta("inactive", 2, 14),
      ...monta(null, 11, null),
    ],
    AGORA
  );
  assert.equal(r.comMlb, 792);
  assert.equal(r.totalAtivos, 489);
  assert.equal(r.semLeitura, 11);
  assert.deepEqual(
    r.outros.map((o) => `${o.estado}:${o.quantos}`),
    ["under_review:155", "paused:123", "closed:12", "inactive:2"]
  );
  // Todas as leituras têm 10 dias ou mais: a resposta PRECISA dizer isso.
  assert.equal(r.desatualizados, 781);
  assert.equal(r.leituraMaisAntigaEmDias, 14);
});
