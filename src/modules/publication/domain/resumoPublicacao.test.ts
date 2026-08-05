// Testes do resumo humano da publicação (B).
//
// O que se prova: o lojista descobre o que impede a publicação ANTES de clicar,
// e nenhum "bloqueio" é inventado sobre algo que o sistema resolve sozinho.
// Rodar: npx tsx --test src/modules/publication/domain/resumoPublicacao.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  resumirPublicacao,
  impedimentosDaPublicacao,
  podePublicar,
} from "./resumoPublicacao.ts";

/** Payload completo, como montarItemML entrega quando está tudo certo. */
const ok: Record<string, unknown> = {
  title: "Sandália Feminina Salto Bloco Confortável",
  category_id: "MLB273770",
  price: 129.9,
  currency_id: "BRL",
  available_quantity: 12,
  pictures: [{ source: "https://x/1.jpg" }, { source: "https://x/2.jpg" }],
  description: { plain_text: "Descrição que vende." },
  shipping: { mode: "me2", local_pick_up: false, free_shipping: true },
  attributes: [],
};

// ── Leitura humana ───────────────────────────────────────────────────────────

test("resume o que vai ao ar em termos de quem vende", () => {
  const r = resumirPublicacao(ok);
  assert.equal(r.titulo, "Sandália Feminina Salto Bloco Confortável");
  assert.equal(r.preco, 129.9);
  assert.equal(r.quantidadeFotos, 2);
  assert.equal(r.estoque, 12);
  assert.equal(r.temDescricao, true);
  assert.equal(r.freteGratis, true);
  assert.equal(r.categoriaId, "MLB273770");
});

test("com variações, o estoque é a soma — não o do item pai", () => {
  const r = resumirPublicacao({
    ...ok,
    available_quantity: undefined,
    variations: [
      { available_quantity: 3, price: 129.9 },
      { available_quantity: 5, price: 129.9 },
    ],
  });
  assert.equal(r.estoque, 8);
  assert.equal(r.quantidadeVariacoes, 2);
});

test("categoria vazia vira null — será prevista pelo título no envio", () => {
  assert.equal(resumirPublicacao({ ...ok, category_id: "" }).categoriaId, null);
  assert.equal(resumirPublicacao({ ...ok, category_id: "   " }).categoriaId, null);
});

test("preço zero não é preço", () => {
  assert.equal(resumirPublicacao({ ...ok, price: 0 }).preco, null);
});

// ── Impedimentos ─────────────────────────────────────────────────────────────

test("anúncio completo: nada impede e nada assusta", () => {
  assert.deepEqual(impedimentosDaPublicacao(ok), []);
  assert.equal(podePublicar(ok), true);
});

test("sem preço BLOQUEIA — preço é obrigatório", () => {
  const imp = impedimentosDaPublicacao({ ...ok, price: 0 });
  const preco = imp.find((i) => i.campo === "preco");
  assert.ok(preco);
  assert.equal(preco.gravidade, "bloqueia");
  assert.equal(podePublicar({ ...ok, price: 0 }), false);
});

test("sem fotos BLOQUEIA — o ML exige imagem", () => {
  const imp = impedimentosDaPublicacao({ ...ok, pictures: [] });
  assert.equal(imp.find((i) => i.campo === "fotos")?.gravidade, "bloqueia");
  assert.equal(podePublicar({ ...ok, pictures: [] }), false);
});

test("estoque zerado BLOQUEIA — publicar pausado não vende", () => {
  assert.equal(podePublicar({ ...ok, available_quantity: 0 }), false);
  // e com variações todas zeradas, idem
  const zeradas = { ...ok, available_quantity: undefined, variations: [{ available_quantity: 0 }] };
  assert.equal(podePublicar(zeradas), false);
});

test("sem título BLOQUEIA", () => {
  assert.equal(podePublicar({ ...ok, title: "" }), false);
});

test("sem categoria NÃO bloqueia: o servidor a prevê pelo título", () => {
  // Assustar com algo que o sistema resolve sozinho é ruído, não cuidado.
  const imp = impedimentosDaPublicacao({ ...ok, category_id: "" });
  assert.deepEqual(imp, []);
  assert.equal(podePublicar({ ...ok, category_id: "" }), true);
});

test("sem descrição é AVISO, não bloqueio: o anúncio sai, só converte menos", () => {
  const semDesc = { ...ok, description: { plain_text: "  " } };
  const imp = impedimentosDaPublicacao(semDesc);
  assert.equal(imp.length, 1);
  assert.equal(imp[0].campo, "descricao");
  assert.equal(imp[0].gravidade, "aviso");
  assert.equal(podePublicar(semDesc), true);
});

test("vários problemas: todos aparecem juntos, não um por vez", () => {
  // Descobrir os problemas em série (publica, erra, corrige, repete) é o que
  // faz o lojista desistir. Tudo o que falta é dito de uma vez.
  const ruim = { ...ok, price: 0, pictures: [], available_quantity: 0, description: {} };
  const imp = impedimentosDaPublicacao(ruim);
  const campos = imp.map((i) => i.campo).sort();
  assert.deepEqual(campos, ["descricao", "estoque", "fotos", "preco"]);
});

test("payload vazio não explode — bloqueia por tudo o que falta", () => {
  const imp = impedimentosDaPublicacao({});
  assert.ok(imp.some((i) => i.campo === "titulo" && i.gravidade === "bloqueia"));
  assert.equal(podePublicar({}), false);
});

// ── Limites do Mercado Envios ────────────────────────────────────────────────

/** A cama: maior lado 202 cm e soma 450 cm. Nenhum dos dois cabe no ME2. */
const CAMA = { pesoGramas: 40_000, alturaCm: 202, larguraCm: 93, comprimentoCm: 155 };
const CAIXA_DE_SAPATO = { pesoGramas: 800, alturaCm: 12, larguraCm: 20, comprimentoCm: 32 };

test("embalagem grande demais para o ME2 BLOQUEIA, e diz por quê", () => {
  const imp = impedimentosDaPublicacao(ok, CAMA);
  const envio = imp.find((i) => i.campo === "envio");
  assert.ok(envio, "a lojista precisa saber disso antes de clicar, não no primeiro pedido");
  assert.equal(envio.gravidade, "bloqueia");
  assert.match(envio.texto, /maior lado/);
  assert.match(envio.texto, /somam/);
  assert.equal(podePublicar(ok, CAMA), false);
});

test("embalagem que cabe não gera aviso nenhum", () => {
  assert.deepEqual(impedimentosDaPublicacao(ok, CAIXA_DE_SAPATO), []);
  assert.equal(podePublicar(ok, CAIXA_DE_SAPATO), true);
});

test("SEM medidas não bloqueia — ausência de prova não é prova de excesso", () => {
  // O caminho de hoje: quem chama sem o pacote continua com o resultado de
  // sempre. Se isto virar bloqueio, todo produto sem embalagem cadastrada para
  // de publicar — um bloqueio novo em cima de gente que publica hoje.
  assert.deepEqual(impedimentosDaPublicacao(ok), []);
  assert.deepEqual(impedimentosDaPublicacao(ok, null), []);
  assert.equal(podePublicar(ok), true);
});

test("fora do me2 os limites do ME2 não regem — e não são invocados", () => {
  // Assustar com um limite que não se aplica é o mesmo defeito de "falta
  // categoria": ruído vestido de cuidado.
  const outroModo = { ...ok, shipping: { mode: "custom", free_shipping: false } };
  assert.deepEqual(impedimentosDaPublicacao(outroModo, CAMA), []);
  assert.equal(podePublicar(outroModo, CAMA), true);
});

test("o modo de envio aparece na leitura humana", () => {
  assert.equal(resumirPublicacao(ok).modoEnvio, "me2");
  assert.equal(resumirPublicacao({ ...ok, shipping: {} }).modoEnvio, null);
  assert.equal(resumirPublicacao({}).modoEnvio, null);
});
